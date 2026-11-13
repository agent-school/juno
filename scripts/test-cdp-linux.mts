/** Linux equivalent harness; this is not evidence of Windows or Docker Desktop compatibility. */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { waitForCdp } from '../packages/browser/src/cdp-readiness.js';

const allocate = () => new Promise<number>((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject).listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(() => typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port')));
  });
});
const port = await allocate(), fixturePort = await allocate();
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'juno-cdp-owned-'));
const dockerMode = process.argv.includes('--docker');
const project = `juno-cdp-linux-${process.pid}`;
let runner: ChildProcess | undefined, relay: net.Server | undefined;
const connections = new Set<net.Socket>();
const signals = (signal: NodeJS.Signals) => { runner?.kill(signal); browser.kill(signal); };
const browser = spawn(process.env.JUNO_TEST_CHROME ?? '/opt/google/chrome/chrome', [
  '--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const exited = new Promise<void>(resolve => { browser.once('exit', () => resolve()); browser.once('error', () => resolve()); });
process.once('SIGINT', signals); process.once('SIGTERM', signals);
try {
  await waitForCdp({ endpoint: `http://127.0.0.1:${port}` });
  if (dockerMode) {
    // Diagnostic transport for Linux only: desktop Chrome binds loopback, unlike Docker Desktop's host forwarding.
    // This bridge-bound relay is owned by this smoke run and is not part of the production Windows runtime.
    const gateway = JSON.parse(execFileSync('docker', ['network', 'inspect', 'bridge'], { encoding: 'utf8' }))[0].IPAM.Config[0].Gateway;
    relay = net.createServer(socket => {
      const upstream = net.connect(port, '127.0.0.1');
      for (const connection of [socket, upstream]) { connections.add(connection); connection.on('close', () => connections.delete(connection)); }
      socket.on('error', () => upstream.destroy()); upstream.on('error', () => socket.destroy());
      socket.pipe(upstream).pipe(socket);
    });
    await new Promise<void>((resolve, reject) => relay!.once('error', reject).listen(0, gateway, () => resolve()));
    const address = relay.address();
    if (!address || typeof address === 'string') throw new Error('No bridge relay address');
    const override = path.join(profile, 'linux-only-compose.yml');
    await fs.writeFile(override, `services:\n  cdp:\n    extra_hosts:\n      - host.docker.internal:${gateway}\n`);
    console.log('Linux bridge smoke with an owned diagnostic relay; not Windows Desktop evidence.');
    runner = spawn('docker', ['compose', '-p', project, '-f', 'docker-compose.cdp.yml', '-f', override, 'up', '--build', '--abort-on-container-exit', '--exit-code-from', 'cdp'], {
      stdio: 'inherit', env: { ...process.env, JUNO_CDP_PORT: String(address.port), JUNO_FIXTURE_PORT: String(fixturePort) },
    });
  } else {
    runner = spawn('pnpm', ['--filter', '@juno/browser', 'exec', 'playwright', 'test', '--config=playwright.cdp.config.ts'], {
      stdio: 'inherit', env: { ...process.env, JUNO_CDP_ENDPOINT: `http://127.0.0.1:${port}`,
        JUNO_FIXTURE_URL: `http://127.0.0.1:${fixturePort}/`, JUNO_FIXTURE_PORT: String(fixturePort) },
    });
  }
  const running = runner;
  process.exitCode = await new Promise<number>(resolve => running.once('exit', code => resolve(code ?? 1)));
} finally {
  try {
    if (dockerMode) execFileSync('docker', ['compose', '-p', project, '-f', 'docker-compose.cdp.yml', 'down', '--remove-orphans'], { stdio: 'inherit' });
  } finally {
    for (const socket of connections) socket.destroy();
    relay?.close();
    browser.kill('SIGTERM');
    const forced = setTimeout(() => browser.kill('SIGKILL'), 5000);
    try { await exited; } finally { clearTimeout(forced); }
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    process.off('SIGINT', signals); process.off('SIGTERM', signals);
  }
}

// Chaos harness only: terminate this owned process between application commit and receipt commit.
import fs from 'node:fs';
import { hostFor } from './host.js';
const [directory, origin, taskFile] = process.argv.slice(2);
if (!directory || !origin || !taskFile) throw new Error('Missing crash harness arguments');
const host = hostFor(directory, origin);
let browser: Awaited<ReturnType<typeof host.openBrowser>> | undefined;
const operations = host.operations.map((operation, index) => ({ ...operation, verify: async (context: Parameters<typeof operation.verify>[0]) => {
  const observation = await operation.verify(context);
  if (index === 0 && observation.status === 'matched') {
    // Close owned Chrome first; the injected journal crash must not leave a browser orphan.
    await browser?.close(); process.kill(process.pid, 'SIGKILL');
  }
  return observation;
} }));
await host.runtime({ operations, openBrowser: async () => { browser = await host.openBrowser(); return browser; } }).run(JSON.parse(fs.readFileSync(taskFile, 'utf8')));
throw new Error('The crash boundary was not reached');

import http from 'node:http';

/**
 * Deterministic fixture HTTP server for @juno/browser e2e tests.
 *
 * Listens on 127.0.0.1:8931. Serves:
 * - GET /            — control page with the semantic widgets the specs need
 * - GET /empty       — page with no interactive or labeled elements (empty-state perception edge)
 * - GET /tall        — long page with a below-fold target button + live scroll position indicator
 * - POST /remove-button        — removes the Add task button (failsafe: missing target)
 * - POST /add-duplicate-button — adds a second button with the identical accessible name (failsafe: ambiguity)
 * - POST /reset      — restores initial mutation state (specs run sequentially; reset keeps later specs clean)
 */

const HOST = process.env.JUNO_FIXTURE_HOST ?? '127.0.0.1';
const PORT = Number(process.env.JUNO_FIXTURE_PORT ?? 8931);
if (!['127.0.0.1', '0.0.0.0'].includes(HOST) || !Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error('Fixture host must be loopback or container wildcard; port must be 1024–65535');
}

let buttonRemoved = false;
let duplicateAdded = false;

function controlPage(): string {
  const addButtons: string[] = [];
  if (!buttonRemoved) {
    addButtons.push('<button id="add-task" type="button">Add task</button>');
  }
  if (duplicateAdded) {
    addButtons.push(
      '<button id="add-task-dup" type="button">Add task</button>',
    );
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Juno Fixture</title>
</head>
<body>
  <h1>Juno Fixture</h1>
  <label for="task-name">Task name</label>
  <input id="task-name" type="text" />
  ${addButtons.join('\n  ')}
  <ul id="tasks"></ul>
  <label for="done">Done</label>
  <input id="done" type="checkbox" />
  <label for="priority">Priority</label>
  <select id="priority">
    <option value="low">Low</option>
    <option value="medium">Medium</option>
    <option value="high">High</option>
  </select>
  <script>
    function addTask() {
      const input = document.getElementById('task-name');
      const li = document.createElement('li');
      li.textContent = input.value;
      document.getElementById('tasks').appendChild(li);
    }
    ['add-task', 'add-task-dup'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', addTask);
    });
  </script>
</body>
</html>`;
}

function emptyPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Empty</title>
</head>
<body>
  <div></div>
</body>
</html>`;
}

function tallPage(): string {
  const filler = Array.from(
    { length: 30 },
    (_, i) => `<div class="filler">${i + 1}</div>`,
  ).join('\n  ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tall</title>
  <style>.filler { height: 100px; border: 1px solid #ccc; }</style>
</head>
<body>
  <div id="scroll-pos">0</div>
  ${filler}
  <button id="deep-button" type="button">Deep target</button>
  <script>
    addEventListener('scroll', () => {
      document.getElementById('scroll-pos').textContent = String(Math.round(window.scrollY));
    });
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(controlPage());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/empty') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(emptyPage());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/tall') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(tallPage());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/remove-button') {
    buttonRemoved = true;
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/add-duplicate-button') {
    duplicateAdded = true;
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/reset') {
    buttonRemoved = false;
    duplicateAdded = false;
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`juno fixture server listening on http://${HOST}:${PORT}/\n`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
  server.close(() => process.exit(0));
  server.closeAllConnections();
});

import http from 'node:http';

/**
 * Deterministic fixture HTTP server for @juno/browser e2e tests.
 *
 * Listens on 127.0.0.1:8931. Serves one control page with the exact set of
 * semantic widgets the specs need, plus a POST /remove-button mutation
 * endpoint used by the failsafe tests (Plan 03).
 */

const HOST = '127.0.0.1';
const PORT = 8931;

let buttonRemoved = false;

function controlPage(): string {
  const addButton = buttonRemoved
    ? ''
    : `<button id="add-task" type="button">Add task</button>`;
  const addScript = buttonRemoved
    ? ''
    : `<script>
        document.getElementById('add-task').addEventListener('click', () => {
          const input = document.getElementById('task-name');
          const li = document.createElement('li');
          li.textContent = input.value;
          document.getElementById('tasks').appendChild(li);
        });
      </script>`;

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
  ${addButton}
  <ul id="tasks"></ul>
  <label for="done">Done</label>
  <input id="done" type="checkbox" />
  <label for="priority">Priority</label>
  <select id="priority">
    <option value="low">Low</option>
    <option value="medium">Medium</option>
    <option value="high">High</option>
  </select>
  ${addScript}
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

  if (req.method === 'POST' && url.pathname === '/remove-button') {
    buttonRemoved = true;
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

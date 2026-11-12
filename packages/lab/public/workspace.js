(() => {
  const find = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const date = value => new Date(value).toLocaleString();
  let workspace, selectedId, submitting = false;
  let pendingTask;
  try { pendingTask = JSON.parse(localStorage.getItem('juno-task-pending') || 'null'); } catch { pendingTask = null; }
  async function request(route, payload) {
    const response = await fetch(`/api/${route}`, payload === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-juno-request': '1' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request could not be completed.');
    return data;
  }
  function notice(id, message, error = false) { const node = find(id); node.textContent = message; node.className = `notice${error ? ' error' : ''}`; }
  const statusClass = status => ['failed', 'partial', 'interrupted'].includes(status) ? 'danger' : status === 'completed' ? 'success' : '';
  async function refresh(memory = false) {
    workspace = await request('workspace');
    renderSummary(); renderTasks();
    if (memory) { renderMemory(); renderPreferences(); }
  }
  function renderSummary() {
    const prefs = workspace.preferences;
    find('#active-preferences').textContent = `Remembered defaults: ${prefs.language} language · at least ${prefs.minStars.toLocaleString()} stars · preference v${prefs.version}. Override either field for just this task.`;
    find('#workspace-kind').textContent = workspace.account ? 'PROTECTED' : 'THIS BROWSER';
    find('#workspace-summary').textContent = workspace.account ? `Workspace: ${workspace.account}. Sign in with its passphrase on another device to resume these tasks and memories.` : 'Your work is saved on this server for this browser. Protect the workspace to resume on another device or recover after clearing cookies.';
    find('#account-controls').classList.toggle('hidden', !!workspace.account);
    find('#account-logout').classList.toggle('hidden', !workspace.account);
    find('#memory-summary').innerHTML = [[workspace.notes.length, 'notes'], [workspace.projects.length, 'projects'], [workspace.recipes.length, 'search recipes']].map(([count, label]) => `<div><strong>${count}</strong><span>${label}</span></div>`).join('');
    find('#refresh-projects').disabled = !workspace.projects.length || workspace.researchBusy || submitting;
    find('#research-submit').disabled = workspace.researchBusy || submitting;
    find('#research-stop').disabled = !workspace.tasks.some(task => task.status === 'running');
  }
  function renderPreferences() {
    const form = find('#preferences-form');
    form.elements.language.value = workspace.preferences.language;
    form.elements.minStars.value = workspace.preferences.minStars;
    find('#preferences-version').textContent = `User-provided · version ${workspace.preferences.version} · saved ${date(workspace.preferences.updatedAt)}. Search recipes retain the filters they were saved with.`;
  }
  function projectCard(project, task) {
    const saved = workspace.projects.find(item => item.project.fullName === project.fullName);
    const changes = task.changes.filter(item => item.project === project.fullName);
    return `<article class="project-card"><span class="tag success">SOURCE CHECKED</span><h3><a href="${escape(project.url)}" target="_blank" rel="noreferrer">${escape(project.fullName)} ↗</a></h3><p>${escape(project.description || 'No project description supplied.')}</p><div class="project-meta"><span>${project.stars.toLocaleString()} stars</span><span>${escape(project.language || 'No language reported')}</span><span>${escape(project.license || 'No license reported')}</span>${project.archived ? '<span>ARCHIVED</span>' : ''}</div><div class="project-source">GitHub API · observed ${escape(date(project.observedAt))}<br>Last push ${escape(date(project.pushedAt))} · <a href="${escape(project.sourceUrl || project.apiUrl)}" target="_blank" rel="noreferrer">Inspect source ↗</a></div>${changes.length ? `<div class="changes">${changes.map(change => `<p><b>${escape(change.field)}</b>: ${escape(change.before)} → ${escape(change.after)}</p>`).join('')}</div>` : task.resolved.kind === 'refresh' ? '<p class="hint mini">No checked metadata changed from the remembered baseline.</p>' : ''}<div class="project-actions"><button class="text-button" data-action="remember-project" data-task="${task.id}" data-project="${escape(project.fullName)}">${saved ? 'Update remembered baseline' : 'Remember project'} →</button></div></article>`;
  }
  function renderTasks() {
    find('#task-count').textContent = `${workspace.tasks.length} tasks`;
    if (!workspace.tasks.some(task => task.id === selectedId)) selectedId = workspace.tasks.at(-1)?.id;
    find('#task-list').innerHTML = workspace.tasks.length ? [...workspace.tasks].reverse().map(task => `<button class="task-row${task.id === selectedId ? ' selected' : ''}" data-action="select-task" data-id="${task.id}"><span class="tag ${statusClass(task.status)}">${task.status.toUpperCase()}</span><strong>${escape(task.resolved.kind === 'search' ? task.resolved.query : 'Refresh remembered projects')}</strong><small>${escape(date(task.startedAt))}</small></button>`).join('') : '<p class="empty">No tasks yet.</p>';
    const task = workspace.tasks.find(task => task.id === selectedId);
    if (!task) { find('#task-detail').innerHTML = '<p class="hint">Start a live search. Every source check and failure will appear here, even if you leave this page.</p>'; return; }
    const complete = task.status !== 'running';
    const title = task.resolved.kind === 'search' ? `Search: ${task.resolved.query}` : 'Refresh your remembered shortlist';
    find('#task-detail').innerHTML = `<div class="task-summary"><strong>${escape(title)}</strong><span>${task.durationMs.toLocaleString()} ms · ${task.sourceRequests} source requests · ${task.modelCalls} model calls</span></div><p class="hint">${task.resolved.kind === 'search' ? `${escape(task.resolved.language)} language · minimum ${task.resolved.minStars.toLocaleString()} stars · ordered by stars, not an overall quality recommendation.` : 'Compared current public metadata against your explicitly saved baseline. Refreshing does not silently update memory.'}</p><ol class="task-steps">${task.steps.map(step => `<li><time>${escape(new Date(step.at).toLocaleTimeString())}</time>${escape(step.message)}</li>`).join('')}</ol>${task.errors.length ? `<ul class="task-errors">${task.errors.map(error => `<li>${escape(error)}</li>`).join('')}</ul>` : ''}${task.recalled.notes.length ? `<div class="recall"><b>Context recalled from your notes</b>${task.recalled.notes.map(note => `<p>${escape(note.text)} <small>· revision ${note.revision}</small></p>`).join('')}<small>Surfaced for review. Note text does not change source filters or instruct execution.</small></div>` : ''}<div class="project-grid">${task.results.map(project => projectCard(project, task)).join('')}</div>${complete && !task.results.length ? '<p class="hint">No checked results. Review the activity and errors above before starting another request.</p>' : ''}${['completed', 'partial'].includes(task.status) && task.resolved.kind === 'search' ? `<form id="recipe-form" class="recipe-form"><label>Name this reusable search<input name="name" maxlength="80" required value="${escape(task.resolved.query.slice(0, 80))}"></label><button class="secondary" type="submit">Remember search recipe</button></form>` : ''}<details><summary>Inspect task receipt and recalled baseline</summary><pre>${escape(JSON.stringify(task, null, 2))}</pre></details><div class="task-toolbar"><button class="text-button" data-action="download-task">Download receipt ↗</button>${complete ? '<button class="text-button forget" data-action="forget-task">Forget task receipt</button>' : ''}</div>`;
  }
  function renderMemory() {
    if (!workspace) return;
    const query = find('#memory-filter').value.toLowerCase();
    const matches = value => value.toLowerCase().includes(query);
    const notes = workspace.notes.filter(note => matches(note.text)).map(note => `<article class="memory-card"><span class="tag">NOTE · USER PROVIDED</span><p>${escape(note.text)}</p><div class="memory-origin">Revision ${note.revision} · ${escape(date(note.updatedAt))} · confidence: user-provided</div><button class="text-button" data-action="edit-note" data-id="${note.id}">Edit</button><button class="text-button forget" data-action="forget-memory" data-kind="notes" data-id="${note.id}">Forget</button>${note.history.length ? `<details><summary>Earlier revisions (${note.history.length})</summary><pre>${escape(note.history.map(item => `${date(item.at)}\n${item.text}`).join('\n\n'))}</pre></details>` : ''}</article>`);
    const projects = workspace.projects.filter(item => matches(`${item.project.fullName} ${item.project.description}`)).map(item => `<article class="memory-card"><span class="tag">PROJECT · GITHUB API</span><h3><a href="${escape(item.project.url)}" target="_blank" rel="noreferrer">${escape(item.project.fullName)} ↗</a></h3><p>${escape(item.project.description)}</p><div class="memory-origin">Observed ${escape(date(item.project.observedAt))} · ${Date.now() - Date.parse(item.project.observedAt) > 7 * 86400000 ? 'STALE: refresh before relying on this snapshot' : 'saved snapshot; not live'}<br>Confidence: source-checked metadata; project description is author-provided.<br><a href="${escape(item.project.sourceUrl || item.project.apiUrl)}" target="_blank" rel="noreferrer">Source ↗</a> · task ${escape(item.taskId.slice(0, 8))}</div><button class="text-button forget" data-action="forget-memory" data-kind="projects" data-id="${item.id}">Forget project</button></article>`);
    const recipes = workspace.recipes.filter(item => matches(`${item.name} ${item.search.query}`)).map(recipe => `<article class="memory-card"><span class="tag">REUSABLE SEARCH · USER APPROVED</span><h3>${escape(recipe.name)}</h3><p>${escape(recipe.search.query)} · ${escape(recipe.search.language)} · minimum ${recipe.search.minStars} stars</p><div class="memory-origin">Saved ${escape(date(recipe.createdAt))} · fixed filters; every replay reads fresh sources.</div><button class="text-button" data-action="run-recipe" data-id="${recipe.id}">Run again →</button><button class="text-button forget" data-action="forget-memory" data-kind="recipes" data-id="${recipe.id}">Forget recipe</button></article>`);
    find('#memory-items').innerHTML = [...notes, ...projects, ...recipes].join('') || '<p class="hint">No matching memories. Save a note, or remember projects from a finished search.</p>';
  }
  async function submitTask(task) {
    if (submitting) return;
    submitting = true; renderSummary();
    if (!pendingTask || JSON.stringify(pendingTask.task) !== JSON.stringify(task)) pendingTask = { requestId: crypto.randomUUID(), task };
    localStorage.setItem('juno-task-pending', JSON.stringify(pendingTask));
    try {
      const result = await request('tasks', pendingTask); selectedId = result.id;
      pendingTask = null; localStorage.removeItem('juno-task-pending');
      showTab('tasks'); await refresh(); notice('#task-notice', 'Task started. You can leave this page and return to its saved evidence.');
    } catch (error) { notice('#task-notice', `${error.message} Retrying the same submission reuses its request ID.`, true); }
    finally { submitting = false; if (workspace) renderSummary(); }
  }
  find('#research-form').addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const task = { kind: 'search', query: String(data.get('query')) };
    if (data.get('language') !== 'remembered') task.language = String(data.get('language'));
    if (data.get('minStars') !== '') task.minStars = Number(data.get('minStars'));
    submitTask(task);
  });
  find('#refresh-projects').addEventListener('click', () => submitTask({ kind: 'refresh' }));
  find('#research-stop').addEventListener('click', async () => {
    try { await request('tasks/stop', {}); notice('#task-notice', 'Stop requested. Already checked results will stay in the receipt.'); }
    catch (error) { notice('#task-notice', error.message, true); }
  });
  find('#account-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, action = event.submitter?.value;
    const data = Object.fromEntries(new FormData(form));
    for (const button of form.querySelectorAll('button')) button.disabled = true;
    try { await request(`account/${action}`, data); localStorage.removeItem('juno-pending'); localStorage.removeItem('juno-task-pending'); location.reload(); }
    catch (error) { notice('#task-notice', error.message, true); }
    finally { form.elements.passphrase.value = ''; for (const button of form.querySelectorAll('button')) button.disabled = false; }
  });
  find('#account-logout').addEventListener('click', async () => {
    try { await request('account/logout', {}); localStorage.removeItem('juno-pending'); localStorage.removeItem('juno-task-pending'); location.reload(); }
    catch (error) { notice('#task-notice', error.message, true); }
  });
  find('#preferences-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    try { await request('memory/preferences', { language: form.elements.language.value, minStars: Number(form.elements.minStars.value) }); await refresh(true); notice('#memory-notice', 'Preferences saved. The next search will use them unless you override its filters.'); }
    catch (error) { notice('#memory-notice', error.message, true); }
  });
  function resetNote() { find('#memory-note-form').reset(); find('#memory-note-form').elements.id.value = ''; find('#save-note').textContent = 'Remember note'; find('#cancel-note-edit').classList.add('hidden'); }
  find('#cancel-note-edit').addEventListener('click', resetNote);
  find('#memory-note-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    const data = { text: form.elements.text.value }; if (form.elements.id.value) data.id = form.elements.id.value;
    try { await request('memory/note', data); resetNote(); await refresh(true); notice('#memory-notice', 'Note remembered with its revision and source: you.'); }
    catch (error) { notice('#memory-notice', error.message, true); }
  });
  find('#memory-filter').addEventListener('input', renderMemory);
  find('#task-detail').addEventListener('submit', async event => {
    if (event.target.id !== 'recipe-form') return;
    event.preventDefault(); const form = event.target;
    try { await request('memory/recipe', { taskId: selectedId, name: form.elements.name.value }); await refresh(true); notice('#task-notice', 'Search recipe remembered. Reuse it from Memory.'); }
    catch (error) { notice('#task-notice', error.message, true); }
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'select-task') { selectedId = button.dataset.id; renderTasks(); return; }
    if (action === 'edit-note') {
      const note = workspace.notes.find(item => item.id === button.dataset.id); if (!note) return;
      const form = find('#memory-note-form'); form.elements.id.value = note.id; form.elements.text.value = note.text;
      find('#save-note').textContent = 'Save correction'; find('#cancel-note-edit').classList.remove('hidden'); form.elements.text.focus(); return;
    }
    if (action === 'run-recipe') { const recipe = workspace.recipes.find(item => item.id === button.dataset.id); if (recipe) submitTask(recipe.search); return; }
    if (action === 'download-task') {
      const task = workspace.tasks.find(item => item.id === selectedId); if (!task) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(task, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `juno-task-${task.id}.json`; link.click(); URL.revokeObjectURL(url); return;
    }
    const memoryAction = action === 'forget-memory';
    button.disabled = true;
    try {
      if (action === 'remember-project') { await request('memory/project', { taskId: button.dataset.task, fullName: button.dataset.project }); notice('#task-notice', 'Project snapshot remembered with its source and observation time. Refresh it later to compare changes.'); }
      else if (action === 'forget-memory') {
        await request('memory/forget', { kind: button.dataset.kind, id: button.dataset.id });
        if (find('#memory-note-form').elements.id.value === button.dataset.id) resetNote();
        notice('#memory-notice', 'Memory forgotten. Task inputs and public results remain in task history until you forget those receipts.');
      } else if (action === 'forget-task') { await request('tasks/forget', { id: selectedId }); notice('#task-notice', 'Task receipt forgotten. Memories you explicitly saved remain in Memory.'); }
      await refresh(true);
    } catch (error) { notice(memoryAction ? '#memory-notice' : '#task-notice', error.message, true); }
    finally { button.disabled = false; }
  });
  refresh(true).catch(error => notice('#task-notice', error.message, true));
  setInterval(() => { if (workspace && (workspace.researchBusy || workspace.tasks.some(task => task.status === 'running'))) refresh().catch(error => notice('#task-notice', error.message, true)); }, 1500);
})();

(() => {
  const find = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const date = value => new Date(value).toLocaleString();
  const shortDate = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const statusClass = status => ['failed', 'interrupted'].includes(status) ? 'danger' : status === 'partial' ? 'warning' : status === 'completed' ? 'success' : status === 'running' ? 'running' : '';
  const statusLabel = status => ({ completed: 'Complete', running: 'Researching', partial: 'Partial results', failed: 'Failed', interrupted: 'Interrupted' })[status] || status;
  const emptyResearch = find('#task-detail').innerHTML;
  let workspace, selectedId, submitting = false, memoryKind = 'all', detailSignature, listSignature, railSignature, announcedTaskId;
  let pendingTask;
  try { pendingTask = JSON.parse(localStorage.getItem('juno-task-pending') || 'null'); } catch { pendingTask = null; }

  async function request(route, payload) {
    const response = await fetch(`/api/${route}`, payload === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-juno-request': '1' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request could not be completed.');
    return data;
  }
  function notice(id, message, error = false) { const node = find(id); node.textContent = message; node.className = `notice${error ? ' error' : ''}`; }
  async function refresh(memory = false) {
    workspace = await request('workspace');
    renderSummary(); renderTasks();
    if (memory) { renderMemory(); renderPreferences(); }
  }
  function renderSummary() {
    const prefs = workspace.preferences;
    find('#active-preferences').textContent = `Saved defaults: ${prefs.language === 'Any' ? 'any language' : prefs.language} · ${prefs.minStars ? `${prefs.minStars.toLocaleString()}+ stars` : 'no star minimum'}.`;
    find('#workspace-kind').textContent = workspace.account ? 'Protected' : 'This browser';
    find('#workspace-name').textContent = workspace.account || 'Browser workspace';
    find('#workspace-summary').textContent = workspace.account ? `Workspace: ${workspace.account}. Use its passphrase on another device to resume your work.` : 'Saved on this server for this browser. Protect your workspace to recover it after clearing cookies or on another device.';
    find('#account-controls').classList.toggle('hidden', !!workspace.account);
    find('#account-logout').classList.toggle('hidden', !workspace.account);
    find('#nav-memory-count').textContent = workspace.notes.length + workspace.projects.length + workspace.recipes.length;
    find('#refresh-projects').disabled = !workspace.projects.length || workspace.researchBusy || submitting;
    find('#research-submit').disabled = workspace.researchBusy || submitting;
    find('#research-submit').innerHTML = workspace.researchBusy || submitting ? 'Researching…' : `Find projects ${icon('arrow')}`;
    find('#research-form').setAttribute('aria-busy', String(submitting));
    find('#research-stop').disabled = !workspace.tasks.some(task => task.status === 'running');
    find('#refresh-hint').textContent = workspace.projects.length ? 'Compare fresh metadata with your saved baseline.' : 'Remember a result to start a shortlist.';
    const signature = JSON.stringify([workspace.notes, workspace.projects, workspace.recipes.length, prefs]);
    if (signature === railSignature) return;
    railSignature = signature;
    find('#memory-summary').innerHTML = [[workspace.projects.length, 'project', 'projects'], [workspace.notes.length, 'note', 'notes'], [workspace.recipes.length, 'search', 'searches']].map(([count, singular, plural]) => `<span><strong>${count}</strong> ${count === 1 ? singular : plural}</span>`).join('');
    find('#rail-preferences').innerHTML = `<dt>Language</dt><dd>${escape(prefs.language)}</dd><dt>Minimum stars</dt><dd>${prefs.minStars.toLocaleString()}</dd>`;
    find('#rail-projects').innerHTML = workspace.projects.length ? workspace.projects.map(item => `<a class="rail-project" href="${escape(item.project.url)}" target="_blank" rel="noreferrer">${escape(item.project.fullName)} <span>Observed ${escape(shortDate(item.project.observedAt))}</span></a>`).join('') : '<p class="hint">Your shortlist is empty.</p>';
    find('#rail-notes').innerHTML = workspace.notes.length ? workspace.notes.slice(-2).reverse().map(note => `<p class="rail-note">${escape(note.text)}</p>`).join('') : '<p class="hint">Keep the context you want to use again.</p>';
  }
  function renderPreferences() {
    const form = find('#preferences-form');
    form.elements.language.value = workspace.preferences.language;
    form.elements.minStars.value = workspace.preferences.minStars;
    find('#preferences-version').textContent = `Version ${workspace.preferences.version} · saved ${date(workspace.preferences.updatedAt)}. Saved searches keep their own filters.`;
  }
  function projectCard(project, task, index) {
    const saved = workspace.projects.find(item => item.project.fullName === project.fullName);
    const changes = task.changes.filter(item => item.project === project.fullName);
    const [owner, name] = project.fullName.split('/');
    return `<article class="project-card"><span class="project-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div class="project-body"><div class="project-heading"><h3><a href="${escape(project.url)}" target="_blank" rel="noreferrer"><span class="repo-owner">${escape(owner)} / </span>${escape(name)} <span aria-hidden="true">↗</span></a></h3><span class="project-stars">${project.stars.toLocaleString()} stars</span></div><p>${escape(project.description || 'No project description supplied.')}</p><div class="project-meta"><span>${escape(project.language || 'Language not reported')}</span><span>${escape(project.license || 'License not reported')}</span><span>Updated ${escape(shortDate(project.pushedAt))}</span>${project.archived ? '<span>Archived</span>' : ''}</div>${changes.length ? `<div class="changes">${changes.map(change => `<p><b>${escape(change.field)}</b>: ${escape(change.before)} → ${escape(change.after)}</p>`).join('')}</div>` : task.resolved.kind === 'refresh' ? '<p class="hint">No checked metadata changed from your baseline.</p>' : ''}<div class="project-actions"><button class="secondary" data-action="remember-project" data-task="${task.id}" data-project="${escape(project.fullName)}">${icon(saved ? 'check' : 'memory')}${saved ? 'Update baseline' : 'Remember'}</button><details class="project-source"><summary>Source details</summary><div class="source-record">GitHub API · observed ${escape(date(project.observedAt))}<br>Source-checked metadata. Description supplied by the project author.<br><a href="${escape(project.sourceUrl || project.apiUrl)}" target="_blank" rel="noreferrer">Inspect API source ↗</a> · task ${escape(task.id.slice(0, 8))}</div></details></div></div></article>`;
  }
  function renderTasks() {
    find('#task-count').textContent = workspace.tasks.length;
    if (!workspace.tasks.some(task => task.id === selectedId)) selectedId = workspace.tasks.at(-1)?.id;
    const nextListSignature = JSON.stringify([selectedId, workspace.tasks.map(task => [task.id, task.status, task.startedAt])]);
    if (listSignature !== nextListSignature) {
      listSignature = nextListSignature;
      const focusedId = find('#task-list').contains(document.activeElement) ? document.activeElement.dataset.id : null;
      find('#task-list').innerHTML = workspace.tasks.length ? [...workspace.tasks].reverse().map(task => `<button class="task-row${task.id === selectedId ? ' selected' : ''}" data-action="select-task" data-id="${task.id}"${task.id === selectedId ? ' aria-current="true"' : ''}><span class="task-state ${statusClass(task.status)}" aria-hidden="true"></span><span><strong>${escape(task.resolved.kind === 'search' ? task.resolved.query : 'Shortlist refresh')}</strong><small>${escape(statusLabel(task.status))} · ${escape(shortDate(task.startedAt))}</small></span></button>`).join('') : '<p class="history-empty">No research yet.</p>';
      if (focusedId) find(`#task-list [data-id="${focusedId}"]`)?.focus({ preventScroll: true });
    }
    const task = workspace.tasks.find(task => task.id === selectedId);
    if (task && task.id === announcedTaskId && task.status !== 'running') {
      notice('#task-notice', `Research ${statusLabel(task.status).toLowerCase()}. ${task.results.length} checked ${task.results.length === 1 ? 'project' : 'projects'} in the receipt.`, ['failed', 'interrupted'].includes(task.status));
      if (task.status === 'partial') find('#task-notice').classList.add('warning');
      announcedTaskId = undefined;
    }
    find('#task-detail').setAttribute('aria-busy', String(task?.status === 'running'));
    const nextSignature = JSON.stringify([task, workspace.projects.map(item => [item.project.fullName, item.project.observedAt])]);
    if (detailSignature === nextSignature) return;
    detailSignature = nextSignature;
    if (!task) { find('#task-detail').innerHTML = emptyResearch; return; }
    const complete = task.status !== 'running';
    const title = task.resolved.kind === 'search' ? task.resolved.query : 'Shortlist changes';
    const summary = task.resolved.kind === 'search' ? `${task.results.length} ${task.results.length === 1 ? 'project' : 'projects'} · ${task.resolved.language} · ${task.resolved.minStars.toLocaleString()}+ stars` : `${task.results.length} ${task.results.length === 1 ? 'project' : 'projects'} checked against your saved baseline`;
    find('#task-detail').innerHTML = `<div class="task-heading"><div><h2>${escape(title)}</h2><p>${escape(summary)}</p></div><span class="tag ${statusClass(task.status)}">${escape(statusLabel(task.status))}</span></div>${task.errors.length ? `<ul class="task-errors">${task.errors.map(error => `<li>${escape(error)}</li>`).join('')}</ul>` : ''}${task.results.length ? `<p class="results-caption">${task.resolved.kind === 'search' ? 'Public GitHub metadata, ordered by stars.' : 'Fresh GitHub metadata compared with your saved baseline.'} Descriptions are author-provided.</p>` : ''}<div class="project-grid">${task.results.map((project, index) => projectCard(project, task, index)).join('')}</div>${complete && !task.results.length ? `<div class="memory-empty"><h2>${task.status === 'completed' ? 'No projects matched.' : 'No checked results.'}</h2><p>${task.status === 'completed' ? 'Try a broader query or adjust your search filters.' : 'Review the activity below before starting another request.'}</p></div>` : ''}${task.recalled.notes.length ? `<div class="recall"><b>Context recalled</b>${task.recalled.notes.map(note => `<p>${escape(note.text)} <small>· revision ${note.revision}</small></p>`).join('')}<small>Shown for review. Notes do not instruct execution or change filters.</small></div>` : ''}<details class="execution-details"${complete && !task.errors.length ? '' : ' open'}><summary>Task activity &amp; receipt · ${task.sourceRequests} source ${task.sourceRequests === 1 ? 'request' : 'requests'} · ${task.durationMs.toLocaleString()} ms</summary><ol class="task-steps">${task.steps.map(step => `<li><time>${escape(new Date(step.at).toLocaleTimeString())}</time><span>${escape(step.message)}</span></li>`).join('')}</ol><details><summary>Raw receipt and recalled baseline</summary><pre>${escape(JSON.stringify(task, null, 2))}</pre></details></details>${['completed', 'partial'].includes(task.status) && task.resolved.kind === 'search' ? `<form id="recipe-form" class="recipe-form"><label>Save this search<input name="name" maxlength="80" required value="${escape(task.resolved.query.slice(0, 80))}"></label><button class="secondary" type="submit">Remember search</button></form>` : ''}<div class="task-toolbar"><button class="text-button" data-action="download-task">Download receipt ↗</button>${complete ? '<button class="text-button forget" data-action="forget-task">Forget task receipt</button>' : ''}</div>`;
  }
  function renderMemory() {
    if (!workspace) return;
    const query = find('#memory-filter').value.toLowerCase();
    const matches = value => value.toLowerCase().includes(query);
    const notes = workspace.notes.filter(note => matches(note.text)).map(note => `<article class="memory-card"><div><p>${escape(note.text)}</p><div class="memory-origin">Your note · revision ${note.revision} · ${escape(date(note.updatedAt))}</div>${note.history.length ? `<details><summary>Earlier revisions (${note.history.length})</summary><pre>${escape(note.history.map(item => `${date(item.at)}\n${item.text}`).join('\n\n'))}</pre></details>` : ''}</div><div class="memory-card-actions"><button class="text-button" data-action="edit-note" data-id="${note.id}">Edit</button><button class="text-button forget" data-action="forget-memory" data-kind="notes" data-id="${note.id}">Forget</button></div></article>`);
    const projects = workspace.projects.filter(item => matches(`${item.project.fullName} ${item.project.description}`)).map(item => `<article class="memory-card"><div><h3><a href="${escape(item.project.url)}" target="_blank" rel="noreferrer">${escape(item.project.fullName)} ↗</a></h3><p>${escape(item.project.description)}</p><div class="memory-origin">GitHub API · observed ${escape(date(item.project.observedAt))} · ${Date.now() - Date.parse(item.project.observedAt) > 7 * 86400000 ? 'Stale: refresh before relying on this snapshot' : 'saved snapshot, not live'}<br>Source-checked metadata; description is author-provided.<br><a href="${escape(item.project.sourceUrl || item.project.apiUrl)}" target="_blank" rel="noreferrer">Source ↗</a> · task ${escape(item.taskId.slice(0, 8))}</div></div><div class="memory-card-actions"><button class="text-button forget" data-action="forget-memory" data-kind="projects" data-id="${item.id}">Forget</button></div></article>`);
    const recipes = workspace.recipes.filter(item => matches(`${item.name} ${item.search.query}`)).map(recipe => `<article class="memory-card"><div><h3>${escape(recipe.name)}</h3><p>${escape(recipe.search.query)} · ${escape(recipe.search.language)} · minimum ${recipe.search.minStars.toLocaleString()} stars</p><div class="memory-origin">Saved ${escape(date(recipe.createdAt))} · fixed filters, fresh sources on every run.</div></div><div class="memory-card-actions"><button class="text-button" data-action="run-recipe" data-id="${recipe.id}">Run again →</button><button class="text-button forget" data-action="forget-memory" data-kind="recipes" data-id="${recipe.id}">Forget</button></div></article>`);
    const groups = [['notes', 'Notes', notes], ['projects', 'Projects', projects], ['recipes', 'Saved searches', recipes]];
    find('#memory-items').innerHTML = groups.filter(([kind, , items]) => (memoryKind === 'all' || memoryKind === kind) && items.length).map(([, title, items]) => `<section class="memory-group"><h2>${title}<span>${items.length}</span></h2>${items.join('')}</section>`).join('') || `<div class="memory-empty"><h2>${query ? 'No matching memories.' : 'Keep what is useful.'}</h2><p>${query ? 'Try a different word or another memory type.' : 'Add a note here, or remember a project or search from your research results.'}</p></div>`;
  }
  async function submitTask(task) {
    if (submitting) return;
    submitting = true; renderSummary();
    if (!pendingTask || JSON.stringify(pendingTask.task) !== JSON.stringify(task)) pendingTask = { requestId: crypto.randomUUID(), task };
    localStorage.setItem('juno-task-pending', JSON.stringify(pendingTask));
    try {
      const result = await request('tasks', pendingTask); selectedId = result.id; announcedTaskId = result.id;
      pendingTask = null; localStorage.removeItem('juno-task-pending');
      showTab('tasks'); notice('#task-notice', 'Research started. Results and activity are saved as it runs.'); await refresh();
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
    try { await request('tasks/stop', {}); notice('#task-notice', 'Stop requested. Checked results stay in the receipt.'); }
    catch (error) { notice('#task-notice', error.message, true); }
  });
  find('#account-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, action = event.submitter?.value;
    const data = Object.fromEntries(new FormData(form));
    for (const button of form.querySelectorAll('button')) button.disabled = true;
    try { await request(`account/${action}`, data); localStorage.removeItem('juno-pending'); localStorage.removeItem('juno-task-pending'); location.reload(); }
    catch (error) { notice('#account-notice', error.message, true); }
    finally { form.elements.passphrase.value = ''; for (const button of form.querySelectorAll('button')) button.disabled = false; }
  });
  find('#account-logout').addEventListener('click', async () => {
    try { await request('account/logout', {}); localStorage.removeItem('juno-pending'); localStorage.removeItem('juno-task-pending'); location.reload(); }
    catch (error) { notice('#account-notice', error.message, true); }
  });
  find('#preferences-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    try { await request('memory/preferences', { language: form.elements.language.value, minStars: Number(form.elements.minStars.value) }); await refresh(true); notice('#memory-notice', 'Defaults saved for your next search.'); }
    catch (error) { notice('#memory-notice', error.message, true); }
  });
  function resetNote() { find('#memory-note-form').reset(); find('#memory-note-form').elements.id.value = ''; find('#save-note').textContent = 'Remember note'; }
  find('#cancel-note-edit').addEventListener('click', () => { resetNote(); find('#note-editor').open = false; find('#memory [data-add-note]').focus(); });
  find('#memory-note-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    const data = { text: form.elements.text.value }; if (form.elements.id.value) data.id = form.elements.id.value;
    try { await request('memory/note', data); resetNote(); await refresh(true); notice('#memory-notice', 'Note saved with its revision and source: you.'); }
    catch (error) { notice('#memory-notice', error.message, true); }
  });
  find('#memory-filter').addEventListener('input', renderMemory);
  find('#task-detail').addEventListener('submit', async event => {
    if (event.target.id !== 'recipe-form') return;
    event.preventDefault(); const form = event.target;
    try { await request('memory/recipe', { taskId: selectedId, name: form.elements.name.value }); await refresh(true); notice('#task-notice', 'Search saved. Run it again from Memory.'); }
    catch (error) { notice('#task-notice', error.message, true); }
  });
  document.addEventListener('click', async event => {
    const queryButton = event.target.closest('[data-query]');
    if (queryButton) { find('#research-query').value = queryButton.dataset.query; find('#research-query').focus(); return; }
    const noteButton = event.target.closest('[data-add-note]');
    if (noteButton) { showTab('memory'); resetNote(); find('#note-editor').open = true; find('#memory-note-form').elements.text.focus(); return; }
    if (event.target.closest('[data-workspace-settings]')) { find('#workspace-settings').open = true; find('#workspace-settings summary').focus(); return; }
    if (event.target.closest('[data-preferences-settings]')) { find('#preferences-settings').open = true; find('#preferences-form').elements.language.focus(); return; }
    const filterButton = event.target.closest('[data-memory-kind]');
    if (filterButton) {
      memoryKind = filterButton.dataset.memoryKind;
      for (const button of document.querySelectorAll('[data-memory-kind]')) { const active = button === filterButton; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); }
      renderMemory(); return;
    }
    const button = event.target.closest('[data-action]'); if (!button || !workspace) return;
    const action = button.dataset.action;
    if (action === 'select-task') { selectedId = button.dataset.id; renderTasks(); showTab('tasks'); find('#task-detail').scrollIntoView({ block: 'start' }); return; }
    if (action === 'edit-note') {
      const note = workspace.notes.find(item => item.id === button.dataset.id); if (!note) return;
      const form = find('#memory-note-form'); form.elements.id.value = note.id; form.elements.text.value = note.text;
      find('#save-note').textContent = 'Save correction'; find('#note-editor').open = true; form.elements.text.focus(); return;
    }
    if (action === 'run-recipe') { const recipe = workspace.recipes.find(item => item.id === button.dataset.id); if (recipe) submitTask(recipe.search); return; }
    if (action === 'download-task') {
      const task = workspace.tasks.find(item => item.id === selectedId); if (!task) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(task, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `juno-task-${task.id}.json`; link.click(); URL.revokeObjectURL(url); return;
    }
    const memoryAction = action === 'forget-memory'; button.disabled = true;
    try {
      if (action === 'remember-project') { await request('memory/project', { taskId: button.dataset.task, fullName: button.dataset.project }); notice('#task-notice', 'Project remembered. Check for changes from Working memory.'); }
      else if (action === 'forget-memory') {
        await request('memory/forget', { kind: button.dataset.kind, id: button.dataset.id });
        if (find('#memory-note-form').elements.id.value === button.dataset.id) resetNote();
        notice('#memory-notice', 'Memory forgotten. Its public results remain in task history until you forget those receipts.');
      } else if (action === 'forget-task') { await request('tasks/forget', { id: selectedId }); notice('#task-notice', 'Receipt forgotten. Explicitly saved memories remain.'); }
      await refresh(true);
    } catch (error) { notice(memoryAction ? '#memory-notice' : '#task-notice', error.message, true); }
    finally { button.disabled = false; }
  });
  refresh(true).catch(error => { find('#task-detail').setAttribute('aria-busy', 'false'); notice('#task-notice', error.message, true); });
  setInterval(() => { if (workspace && (workspace.researchBusy || workspace.tasks.some(task => task.status === 'running'))) refresh().catch(error => notice('#task-notice', error.message, true)); }, 1500);
})();

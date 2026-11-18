(() => {
  const find = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const labels = { person_name: 'Name', contact_email: 'Email', category: 'Category', subscribed: 'Subscribed', note: 'Follow-up', due_date: 'Due date' };
  const statusLabel = status => ({ ready: 'Ready to review', running: 'Running', interrupted: 'Interrupted', verified: 'Verified', blocked: 'Stopped safely', uncertain: 'Needs inspection', failed: 'Run interrupted', pending: 'Waiting', finished: 'Finished' })[status] || status;
  const operationLabel = operation => ({ 'contacts.create': 'Create contact', 'followups.add': 'Add follow-up' })[operation] || operation;
  const date = value => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const failureText = failure => ({
    'stale-model': 'The saved site understanding changed. Observe the site and review a new task.',
    grounding: 'A control changed or could not be identified uniquely. Juno stopped instead of guessing.',
    'confirmation-required': 'This action is outside the reviewed permissions. Juno stopped before performing it.',
    'effect-unverified': 'A write may have been attempted, but its result could not be verified. Resuming will inspect the saved request; it will not blindly repeat the write.',
    'effect-conflict': 'Stored application data conflicts with the requested result. Inspect the records before creating another task.',
    'verification-unavailable': 'The independent application check was unavailable. Inspect the records before continuing.',
    cancelled: 'Stop was requested. Any completed writes remain visible below. Resume inspects the same request before continuing.',
    deadline: 'The run reached its time limit. Resume inspects the same request before continuing.',
    browser: 'The browser could not finish. Inspect the saved receipt before resuming.',
  })[failure];
  let state, selectedId, detail, refreshing, refreshAgain = false, working = false, initialized = false, viewVersion = 0;
  let detailSignature = '', historySignature = '', memorySignature = '', recordsSignature = '', checksSignature = '';
  let scenario = 'normal';
  const form = find('#agent-task-form');
  const due = new Date(); due.setUTCDate(due.getUTCDate() + 7); form.elements.due.value = due.toISOString().slice(0, 10);
  async function request(path = '', data) {
    const response = await fetch(`/api/agent${path}`, { signal: AbortSignal.timeout(data === undefined ? 6000 : 40_000), ...(data === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-juno-request': '1' }, body: JSON.stringify(data) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error + (result.issues ? `: ${result.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}` : ''));
    return result;
  }
  function notice(message = '', error = false) { const node = find('#agent-notice'); node.textContent = message; node.classList.toggle('error', error); }
  function controls() {
    const busy = working || !!state?.busy;
    find('#agent-inputs').disabled = busy;
    find('#agent-review').disabled = busy;
    find('#agent-review').textContent = working ? 'Preparing…' : 'Review task →';
    find('#agent-observe').disabled = busy;
    find('#agent-forget').disabled = busy || !state?.knowledge.length;
    find('#agent-check-start').disabled = busy || (state?.checks.length ?? 0) >= 5;
    for (const node of document.querySelectorAll('#agent-intent-form textarea, #agent-intent-form button')) node.disabled = busy || !state?.planner.configured;
    const run = find('#agent-run-start');
    if (run) run.disabled = busy || !state?.knowledge.some(model => model.version === detail?.plan.modelVersion);
    const stop = find('#agent-run-stop'); if (stop) stop.disabled = working || !!detail?.stopping;
  }
  function renderHistory() {
    const signature = JSON.stringify([selectedId, state.tasks]); if (signature === historySignature) return; historySignature = signature;
    find('#agent-history').innerHTML = state.tasks.length ? state.tasks.map(task => `<button type="button" class="agent-history-row${task.id === selectedId ? ' selected' : ''}" data-agent-task="${task.id}" aria-pressed="${task.id === selectedId}"><strong>${escape(task.title)}</strong><small>${escape(statusLabel(task.status))} · ${task.verifiedSteps}/${task.totalSteps} verified<br>${escape(date(task.createdAt))}</small></button>`).join('') : '<p class="hint">Reviewed tasks and their outcomes will stay here.</p>';
  }
  function renderMemory() {
    const signature = JSON.stringify(state.knowledge); if (signature === memorySignature) return; memorySignature = signature;
    find('#agent-memory-count').textContent = `${state.knowledge.length} version${state.knowledge.length === 1 ? '' : 's'}`;
    find('#agent-site-memory').innerHTML = state.knowledge.length ? [...state.knowledge].reverse().map((model, index) => `<div class="agent-memory-version"><strong>${index === 0 ? 'Current understanding' : 'Earlier version'}</strong><span>${model.pages} pages · ${model.operations.length} reviewed operations</span><small>Version ${escape(model.version.slice(0, 8))}</small><details><summary>What Juno knows</summary><ul>${model.operations.map(operation => `<li>${escape(operationLabel(operation))}</li>`).join('')}</ul><small>Structure ${escape(model.structuralRevision.slice(0, 12))}</small></details></div>`).join('') : '<p class="hint">No saved understanding yet. Reviewing your first task observes the site without changing its data.</p>';
  }
  function renderRecords() {
    const signature = JSON.stringify(state.records); if (signature === recordsSignature) return; recordsSignature = signature;
    find('#agent-record-count').textContent = `${state.records.length} record${state.records.length === 1 ? '' : 's'}`;
    find('#agent-records').innerHTML = state.records.length ? [...state.records].reverse().map(record => {
      const fields = record.fields;
      return record.kind === 'contact' ? `<article class="agent-record"><h3>${escape(fields.person_name)}</h3><p>${escape(fields.contact_email)}</p><small>Contact · ${escape(fields.category)} · ${fields.subscribed ? 'Subscribed' : 'Not subscribed'}</small></article>` : `<article class="agent-record"><h3>${escape(fields.note)}</h3><p>${escape(fields.contact_email)}</p><small>Follow-up · due ${escape(fields.due_date)}</small></article>`;
    }).join('') : '<p class="agent-empty">Your contacts and follow-ups will appear here.</p>';
  }
  function renderChecks() {
    const signature = JSON.stringify(state.checks); if (signature === checksSignature) return; checksSignature = signature;
    const check = state.checks[0];
    if (!check) { find('#agent-check-summary').textContent = 'Not run in this workspace'; find('#agent-check-results').replaceChildren(); return; }
    const passed = check.checks.filter(item => item.passed).length;
    find('#agent-check-summary').textContent = `${passed}/${check.checks.length} passed${check.status === 'running' ? ' · running' : ` · ${check.status}`}`;
    find('#agent-check-results').innerHTML = `${check.error ? `<p class="agent-fail">${escape(check.error)}</p>` : ''}${check.status === 'interrupted' ? '<p class="hint">The server restarted before this matrix finished. This is a partial result.</p>' : ''}${check.status === 'running' ? `<button type="button" class="text-button" id="agent-check-stop" data-id="${check.id}">Stop after current check</button>` : ''}<ol class="agent-check-list">${check.checks.map(item => `<li><strong class="${item.passed ? 'agent-pass' : 'agent-fail'}">${item.passed ? 'Pass' : 'Fail'}</strong><span>${escape(item.name)}${item.detail ? `<br>${escape(item.detail)}` : ''}</span></li>`).join('')}</ol>${check.status === 'completed' ? `<a class="text-button" href="/api/agent/checks/${check.id}/report">Download check report ↓</a>` : ''}`;
  }
  function renderTask() {
    find('#agent-composer').classList.toggle('hidden', !!detail);
    const container = find('#agent-run'); container.classList.toggle('hidden', !detail);
    if (!detail) { container.replaceChildren(); detailSignature = ''; return; }
    const signature = JSON.stringify(detail); if (signature === detailSignature) return; detailSignature = signature;
    const open = [...container.querySelectorAll('details[open]')].map(node => node.dataset.keep);
    const receipt = detail.receipt, isRunning = detail.status === 'running', isReady = detail.status === 'ready';
    const outcome = receipt?.failure ? failureText(receipt.failure) : detail.status === 'verified' ? 'Every operation matches an independently checked application record. Rechecking this same task does not repeat its writes.' : isReady ? 'Check the details below. Running this plan can create these records in your private test workspace.' : isRunning ? 'The browser is working. Each completed operation is checked against stored application data.' : 'Inspect the last saved evidence and the application records. Resume uses the same request and checks existing effects first.';
    const entries = receipt?.steps.flatMap(step => step.audit.filter(entry => entry.status !== 'started' && entry.method !== 'read').map(entry => ({ ...entry, operation: step.operation }))) ?? [];
    container.innerHTML = `<div class="agent-run-header"><span>${escape(date(detail.createdAt))} · ${detail.source === 'language' ? 'Language plan' : 'Reviewed task form'}</span><button type="button" class="text-button" data-agent-new>New task</button></div><h2 class="agent-run-title">${escape(detail.title)}</h2><div class="agent-outcome"><strong class="${detail.status === 'verified' ? 'agent-pass' : ['blocked', 'uncertain', 'failed'].includes(detail.status) ? 'agent-fail' : ''}">${escape(detail.stopping ? 'Stopping…' : statusLabel(detail.status))}</strong><p>${escape(outcome || detail.error || '')}</p></div><ol class="agent-plan">${detail.plan.steps.map((step, index) => {
      const proof = receipt?.steps.find(item => item.id === step.id);
      return `<li><span class="agent-step-index ${proof?.status === 'verified' ? 'verified' : ''}">${proof?.status === 'verified' ? '✓' : index + 1}</span><div class="agent-step-body"><div><h3>${escape(operationLabel(step.operation))}</h3><span>${escape(statusLabel(proof?.status || 'pending'))}</span></div><dl>${Object.entries(step.inputs).filter(([key]) => key !== 'request_id').map(([key, value]) => `<dt>${escape(labels[key] || key)}</dt><dd>${escape(typeof value === 'boolean' ? value ? 'Yes' : 'No' : value)}</dd>`).join('')}</dl>${proof?.verification?.status === 'matched' ? `<p class="agent-step-proof">Verified against one stored record${proof.recovered ? ' · recovered without repeating the write' : ''}</p>` : ''}</div></li>`;
    }).join('')}</ol><div class="agent-run-controls">${isRunning ? '<button type="button" class="stop" id="agent-run-stop">Stop task</button>' : `<button type="button" class="primary" id="agent-run-start">${isReady ? 'Run reviewed task' : detail.status === 'verified' ? 'Recheck saved task' : 'Inspect & resume saved task'} <span aria-hidden="true">→</span></button>`}<a href="/api/agent/tasks/${detail.id}/receipt">Download plan & receipt ↓</a></div>${!isRunning && detail.status !== 'verified' ? `<details class="agent-scenario" data-keep="scenario"><summary>Test a website change</summary><p class="hint">Changes apply only to this owned application during the next run.</p><label class="sr-only" for="agent-scenario">Website variation</label><select id="agent-scenario"><option value="normal">Normal page</option><option value="reordered">Reorder the fields</option><option value="renamed">Rename the save contact button</option><option value="followup-renamed">Rename the save follow-up button</option><option value="ambiguous">Add an ambiguous save button</option><option value="no-effect">Show success without saving</option><option value="injection">Try unsolicited page-script writes</option></select></details>` : ''}<figure class="agent-browser"><div class="agent-browser-bar"><span>Contact workspace</span><span>${isRunning ? 'Browser snapshots' : detail.hasScreenshot ? 'Last captured frame' : 'Browser preview'}</span></div>${detail.hasScreenshot ? `<img id="agent-frame" src="/api/agent/tasks/${detail.id}/screenshot?t=${Date.now()}" alt="${isRunning ? 'Current' : 'Last captured'} view of the browser executing this contact task">` : '<div class="agent-browser-placeholder">The browser preview appears when this task runs.</div>'}</figure><p class="agent-browser-caption">The image shows the browser. Verification above comes from the application’s stored records.</p><details class="agent-audit" data-keep="audit"><summary>Action log · ${entries.length} recorded actions</summary>${entries.length ? `<ol>${entries.map(entry => `<li><time>${escape(new Date(entry.at).toLocaleTimeString())}</time><span>${escape(operationLabel(entry.operation))} · ${escape(entry.method)}</span><span class="${entry.status === 'completed' ? '' : 'agent-fail'}">${escape(entry.status)}</span></li>`).join('')}</ol>` : '<p class="hint">Guarded browser actions will be recorded here.</p>'}</details>`;
    const variation = find('#agent-scenario'); if (variation) variation.value = scenario;
    for (const node of container.querySelectorAll('details')) if (open.includes(node.dataset.keep)) node.open = true;
  }
  async function load() {
      const version = viewVersion, nextState = await request();
      if (version !== viewVersion) return;
      state = nextState;
      if (selectedId && !state.tasks.some(task => task.id === selectedId)) { selectedId = undefined; detail = undefined; initialized = false; }
      if (!initialized) { selectedId = state.tasks[0]?.id; initialized = true; }
      if (selectedId) {
        const requestedId = selectedId, fetched = await request(`/tasks/${requestedId}`);
        if (version !== viewVersion || requestedId !== selectedId) return;
        detail = fetched;
      } else detail = undefined;
      renderHistory(); renderMemory(); renderRecords(); renderChecks(); renderTask();
      find('#agent-planner-hint').textContent = state.planner.configured ? `Plans use the server’s ${state.planner.model} connection. Only the two reviewed contact operations are available. No task runs until you approve its plan.` : 'Language planning needs a server model connection. The task form above works now without a model key.';
      controls();
      const frame = find('#agent-frame'); if (frame && detail?.status === 'running') frame.src = `/api/agent/tasks/${detail.id}/screenshot?t=${Date.now()}`;
  }
  function refresh() {
    if (refreshing) { refreshAgain = true; return refreshing; }
    refreshing = (async () => {
      do { refreshAgain = false; await load(); } while (refreshAgain);
    })().finally(() => { refreshing = undefined; });
    return refreshing;
  }
  async function act(work, message) {
    if (working) return; working = true; viewVersion++; controls(); notice(message);
    try { await work(); viewVersion++; await refresh(); notice(); }
    catch (error) { notice(error.message, true); }
    finally { working = false; controls(); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const fields = new FormData(form), data = Object.fromEntries(fields); data.subscribed = form.elements.subscribed.checked;
    void act(async () => { const task = await request('/prepare', data); selectedId = task.id; scenario = 'normal'; initialized = true; }, 'Observing the contact workspace and preparing your plan. No task records are being changed.');
  });
  find('#agent-intent-form').addEventListener('submit', event => {
    event.preventDefault(); const intent = new FormData(event.currentTarget).get('intent');
    void act(async () => { const task = await request('/plan', { intent }); selectedId = task.id; scenario = 'normal'; initialized = true; }, 'Building a typed plan for your review. No task actions are being executed.');
  });
  find('#agent-example').addEventListener('click', () => {
    form.elements.name.value = 'Ada Lovelace'; form.elements.email.value = 'ada@example.test'; form.elements.note.value = 'Compare semantic browser agents';
    form.elements.category.value = 'Research'; form.elements.subscribed.checked = false; form.elements.name.focus();
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.hasAttribute('data-agent-new')) { viewVersion++; selectedId = undefined; detail = undefined; initialized = true; scenario = 'normal'; renderTask(); if (state) renderHistory(); notice(); form.elements.name.focus(); return; }
    if (target.dataset.agentTask) { viewVersion++; selectedId = target.dataset.agentTask; scenario = 'normal'; void refresh().catch(error => notice(error.message, true)); return; }
    if (target.id === 'agent-run-start' && detail) { const id = detail.id; void act(async () => { await request(`/tasks/${id}/run`, { variant: scenario }); }, 'Starting the saved request…'); }
    if (target.id === 'agent-run-stop' && detail) { const id = detail.id; void act(async () => { await request(`/tasks/${id}/stop`, {}); }, 'Requesting stop. Juno will retain its receipt and inspect any writes.'); }
    if (target.id === 'agent-observe') void act(async () => { await request('/observe', {}); }, 'Observing three approved pages without changing their data…');
    if (target.id === 'agent-forget') void act(async () => { await request('/knowledge/forget', {}); }, 'Forgetting this site’s saved understanding…');
    if (target.id === 'agent-check-start') void act(async () => { await request('/checks', {}); find('.agent-checks').open = true; }, 'Starting the controlled reliability matrix…');
    if (target.id === 'agent-check-stop') void act(async () => { await request(`/checks/${target.dataset.id}/stop`, {}); }, 'Stopping after the current controlled check…');
  });
  document.addEventListener('change', event => { if (event.target.id === 'agent-scenario') scenario = event.target.value; });
  window.addEventListener('hashchange', () => { if (location.hash === '#agent') void refresh().catch(error => notice(error.message, true)); });
  setInterval(() => { if (!document.hidden && !find('#agent').classList.contains('hidden')) void refresh().catch(() => notice('Juno is unreachable. A saved task may still be running; reconnect before starting another request.', true)); }, 1500);
  void refresh().catch(error => notice(error.message, true));
})();

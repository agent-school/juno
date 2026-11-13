const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let state, selected, busy = false;
let pending;
try { pending = JSON.parse(localStorage.getItem('juno-pending') || 'null'); } catch { pending = null; }
$('#operation [name="occurred_at"]').value = new Date().toISOString().slice(0, 10);
async function api(path, payload) {
  const response = await fetch(`/api/${path}`, payload === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-juno-request': '1' }, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error + (data.issues ? ': ' + data.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') : ''));
  return data;
}
function notify(message, error = false) {
  $('#notice').textContent = message;
  $('#notice').className = error ? 'notice error' : 'notice';
}
function setBusy(value) {
  busy = value;
  for (const control of document.querySelectorAll('#operation input, #operation select, #operation textarea, #compile, #run, #variant')) control.disabled = value;
  $('#stop').disabled = !value;
  $('#forget-site').disabled = value || !state?.model;
  $('#run').innerHTML = value ? 'Browser working…' : 'Run saved operation <span aria-hidden="true">→</span>';
}
const tabNames = { tasks: 'Research', memory: 'Memory', evidence: 'Lab receipts', progress: 'Roadmap', experiment: 'Browser lab' };
function showTab(tab, { focus = false, history = true } = {}) {
  if (!Object.hasOwn(tabNames, tab)) tab = 'tasks';
  for (const page of document.querySelectorAll('.page')) page.classList.toggle('hidden', page.id !== tab);
  for (const nav of document.querySelectorAll('.nav')) {
    const active = nav.dataset.tab === tab;
    nav.classList.toggle('active', active);
    if (active) nav.setAttribute('aria-current', 'page'); else nav.removeAttribute('aria-current');
  }
  $('#breadcrumb').textContent = tabNames[tab];
  document.title = `${tabNames[tab]} — Juno`;
  if (history && location.hash !== `#${tab}`) window.history.pushState(null, '', `#${tab}`);
  if (focus) $(`#${tab} h1`).focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-tab]');
  if (!button) return;
  showTab(button.dataset.tab, { focus: !button.hasAttribute('data-new-research') });
  if (button.hasAttribute('data-new-research')) { $('#research-query').focus(); $('#research-query').select(); }
});
window.addEventListener('hashchange', () => showTab(location.hash.slice(1), { history: false }));
const compactNavigation = matchMedia('(max-width: 960px)');
const adaptHistory = () => { $('#research-history').open = !compactNavigation.matches; };
compactNavigation.addEventListener('change', adaptHistory); adaptHistory();
showTab(location.hash.slice(1), { history: false });
async function refresh() { state = await api('state'); render(); }
function statusClass(status) { return status === 'verified' ? 'success' : ['failed', 'uncertain'].includes(status) ? 'danger' : ''; }
function selectReceipt(id) {
  selected = state.receipts.find(receipt => receipt.id === id);
  $('#receipt-view').textContent = selected ? JSON.stringify(selected, null, 2) : 'Select a run to inspect its evidence.';
  $('#download-receipt').disabled = !selected;
  for (const row of document.querySelectorAll('.run-row')) {
    const active = row.dataset.id === selected?.id;
    row.classList.toggle('selected', active);
    if (active) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
  }
}
function render() {
  $('#variant').value = state.variant;
  $('#history-count').textContent = state.receipts.length;
  $('#model-badge').textContent = state.model ? 'Saved · ' + state.model.version.slice(0, 8) : 'Not observed';
  $('#model-badge').className = state.model ? 'tag success' : 'tag';
  $('#model').textContent = state.model ? JSON.stringify(state.model, null, 2) : 'No model saved yet.';
  $('#forget-site').disabled = busy || !state.model;
  const last = state.receipts.at(-1);
  if (last) {
    $('#result-status').textContent = last.status.toUpperCase();
    $('#result-status').className = 'tag ' + statusClass(last.status);
    $('#result').classList.remove('empty');
    $('#result').innerHTML = `<div class="result-summary"><strong>${last.status === 'verified' ? 'The state matches the intent.' : last.status === 'failed' ? 'The operation failed safely.' : last.status === 'uncertain' ? 'The outcome is uncertain. Inspect before retrying.' : 'Run in progress.'}</strong><span>${last.durationMs.toLocaleString()} ms · ${last.metrics.browserActions} actions · $0 model cost</span></div>${last.message ? `<p class="failure-message">${esc(last.message)}</p>` : ''}<div class="assertions">${last.assertions.map(assertion => `<span class="${assertion.passed ? 'passed' : 'not-passed'}">${assertion.passed ? '✓' : '×'} ${esc(assertion.name)}</span>`).join('') || '<span class="subtle">No postconditions verified.</span>'}</div><button class="text-button inspect-latest">Inspect full receipt →</button>`;
    $('.inspect-latest').addEventListener('click', () => { selectReceipt(last.id); showTab('evidence'); });
  }
  const completed = state.receipts.filter(receipt => receipt.status !== 'running');
  const verified = completed.filter(receipt => receipt.status === 'verified');
  const times = completed.map(receipt => receipt.durationMs).sort((a, b) => a - b);
  $('#stats').innerHTML = [
    [completed.length, 'recorded attempts'], [`${verified.length} / ${completed.length}`, 'verified outcomes'],
    [times.length ? times[Math.floor(times.length / 2)].toLocaleString() + ' ms' : '—', 'median run time'], ['0', 'model calls'],
  ].map(([value, label]) => `<div class="stat"><strong>${esc(value)}</strong><span>${label}</span></div>`).join('');
  $('#runs').innerHTML = state.receipts.length ? [...state.receipts].reverse().map(receipt => `<button class="run-row" data-id="${receipt.id}"><span class="tag ${statusClass(receipt.status)}">${receipt.status}</span><strong>${esc(receipt.inputs.person)}</strong><small>${esc(receipt.variant)} · ${receipt.durationMs} ms<br>${new Date(receipt.startedAt).toLocaleString()}</small></button>`).join('') : '<p class="empty">No attempts yet. Start in the experiment.</p>';
  for (const row of document.querySelectorAll('.run-row')) row.addEventListener('click', () => selectReceipt(row.dataset.id));
  if (selected) selectReceipt(selected.id);
  else if (last) selectReceipt(last.id);
  const renamedFailure = state.receipts.find(receipt => receipt.variant === 'renamed' && receipt.status === 'failed' && receipt.category === 'precondition');
  const gates = [
    [!!state.model, 'Compile the live page', 'Save semantic identities without transient browser handles.'],
    [verified.length > 0, 'Verify a replay', 'Check the intended person, note, date and next action.'],
    [verified.some(receipt => receipt.variant === 'reordered'), 'Survive field reordering', 'Keep the same operation while the DOM changes.'],
    [!!renamedFailure, 'Catch a changed label', 'Rename the submit button and replay the old model.'],
    [!!renamedFailure && verified.some(receipt => receipt.variant === 'renamed' && receipt.startedAt > renamedFailure.startedAt && receipt.modelVersion !== renamedFailure.modelVersion), 'Recover with explicit recompilation', 'Rebind the renamed button, then replay new inputs.'],
    [state.receipts.some(receipt => receipt.variant === 'no-effect' && receipt.category === 'verification'), 'Reject a false success', 'Complete the clicks with no saved effect; verification should fail.'],
    [state.feedback.length > 0, 'Leave actionable feedback', 'Record the next concrete improvement with a run receipt.'],
  ];
  $('#gate-count').textContent = `${gates.filter(([done]) => done).length} / ${gates.length}`;
  $('#gates').innerHTML = gates.map(([done, title, detail]) => `<li class="${done ? 'done' : ''}"><span class="check">${done ? '✓' : '○'}</span><div><strong>${title}</strong><p>${detail}</p></div></li>`).join('');
  $('#feedback-count').textContent = `${state.feedback.length} saved notes · included in evidence export`;
}
$('#compile').addEventListener('click', async () => {
  setBusy(true); notify('Observing the live page in Chromium…');
  try { await api('compile', {}); await refresh(); notify('Binding saved. Replay now, or change the layout to test it.'); }
  catch (error) { notify(error.message, true); }
  finally { setBusy(false); }
});
$('#operation').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const inputs = Object.fromEntries(new FormData(event.currentTarget));
  if (!pending || JSON.stringify(pending.inputs) !== JSON.stringify(inputs)) pending = { requestId: crypto.randomUUID(), inputs };
  localStorage.setItem('juno-pending', JSON.stringify(pending));
  setBusy(true); notify('Replaying semantic actions and checking the resulting application state…');
  try {
    const receipt = await api('run', pending);
    if (receipt.status !== 'running') { pending = null; localStorage.removeItem('juno-pending'); }
    selected = receipt;
    await refresh();
    $('#fixture').src = '/fixture';
    notify(receipt.status === 'verified' ? 'Verified. The receipt is saved in run history.' : receipt.message || 'Inspect the receipt before trying again.', receipt.status !== 'verified');
  } catch (error) { notify(error.message + ' Retrying the same inputs keeps the request ID to prevent a duplicate.', true); }
  finally { setBusy(false); }
});
$('#variant').addEventListener('change', async event => {
  try { await api('variant', { variant: event.target.value }); $('#fixture').src = '/fixture'; await refresh(); notify('Page changed. The saved model stays the same until you explicitly recompile.'); }
  catch (error) { notify(error.message, true); await refresh(); }
});
$('#stop').addEventListener('click', async () => {
  try { await api('stop', {}); notify('Stop requested. Inspect the receipt and fixture state before retrying.'); }
  catch (error) { notify(error.message, true); }
});
$('#forget-site').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    await api('site-knowledge/forget', {});
    await refresh();
    notify('Site model forgotten. Previous run receipts remain; compile again before a new run.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(false); }
});
$('#feedback').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await api('feedback', { runId: selected?.id ?? null, text: new FormData(event.currentTarget).get('text') });
    event.currentTarget.reset(); await refresh(); $('#feedback-status').textContent = 'Feedback saved with your evidence.';
  } catch (error) { $('#feedback-status').textContent = error.message; }
});
$('#download-receipt').addEventListener('click', () => {
  if (!selected) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `juno-${selected.id}.json`; link.click(); URL.revokeObjectURL(url);
});
window.addEventListener('message', event => {
  if (event.origin === location.origin && event.source === $('#fixture').contentWindow && event.data?.type === 'juno-fixture-saved') refresh().catch(error => notify(error.message, true));
});
refresh().catch(error => notify(error.message, true));

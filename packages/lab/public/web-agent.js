(() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const labels = { ready: 'Ready to review', running: 'Working', answered: 'Answer with checked source quotes', evidence: 'Evidence collected', blocked: 'Needs another capability', failed: 'Could not finish', stopped: 'Stopped', interrupted: 'Interrupted by restart' };
  const when = value => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  // Persisted URL strings are untrusted. Keep executable schemes out of every link even if storage is edited.
  const safeHref = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? escape(url.href) : '#'; } catch { return '#'; } };
  const examples = {
    compare: { goal: 'Compare Playwright and Puppeteer: supported browsers, language support, and their approach to browser automation. Cite sources and extract the key differences into a table.', urls: ['https://playwright.dev/', 'https://pptr.dev/'] },
    docs: { goal: 'Find how Python virtual environments are created and activated. Follow relevant documentation links and cite the exact commands and requirements.', urls: ['https://docs.python.org/3/library/venv.html'] },
    extract: { goal: 'Extract the main requirements and recommendations for using Node.js production releases. Distinguish LTS from Current and cite the official source.', urls: ['https://nodejs.org/en/about/previous-releases'] },
  };
  let state, detail, selected, parentId, initialized = false, working = false, refreshing, again = false, generation = 0;
  let historySignature = '', sitesSignature = '', detailSignature = '';
  const selectionKey = 'juno-web-selected-task';
  function savedSelection() { try { return sessionStorage.getItem(selectionKey); } catch { return null; } }
  function rememberSelection() { try { sessionStorage.setItem(selectionKey, selected || 'new'); } catch { /* Browsing still works when storage is unavailable. */ } }
  const form = $('#web-task-form');
  async function api(path = '', data) {
    const response = await fetch(`/api/web${path}`, { signal: AbortSignal.timeout(10_000), ...(data === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-juno-request': '1' }, body: JSON.stringify(data) }) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error + (value.issues ? `: ${value.issues.map(issue => issue.message).join('; ')}` : ''));
    return value;
  }
  function notice(message = '', error = false) { $('#web-notice').textContent = message; $('#web-notice').classList.toggle('error', error); }
  function controls() {
    const unavailable = working || !!state?.busy;
    $('#web-review').disabled = working;
    const run = $('#web-run'); if (run) run.disabled = unavailable || detail?.input.mode === 'agent' && !state?.model.configured;
    const stop = $('#web-stop'); if (stop) stop.disabled = working;
    $('#web-model-status').textContent = state?.model.configured
      ? `Server model: ${state.model.model}. A configured connection is verified when a task calls it. Each task is limited to 10 pages, 12 decisions and two minutes.`
      : 'No server model is connected. Choose “Collect source evidence” to browse your starting websites now. Goal-driven navigation and answers need a working model connection.';
  }
  function renderHistory() {
    const signature = JSON.stringify([selected, state.tasks]); if (signature === historySignature) return; historySignature = signature;
    $('#web-history').innerHTML = state.tasks.length ? state.tasks.map(task => `<button type="button" class="web-history-item" data-web-task="${escape(task.id)}" aria-current="${task.id === selected}"><strong>${escape(task.input.goal.slice(0, 110))}</strong><small>${escape(labels[task.status])} · ${task.pageCount} sources · ${escape(when(task.createdAt))}</small></button>`).join('') : '<p class="hint">Your goals, observations and answers stay here.</p>';
  }
  function renderSites() {
    const signature = JSON.stringify(state.sites); if (signature === sitesSignature) return; sitesSignature = signature;
    $('#web-sites').innerHTML = state.sites.length ? state.sites.map(site => `<div class="web-site"><strong>${escape(new URL(site.origin).hostname)}</strong><small>${site.pages} observed routes · ${escape(when(site.observedAt))}</small><button type="button" class="text-button" data-web-forget-site="${escape(site.origin)}">Forget</button></div>`).join('') : '<p class="hint">No websites learned yet. Run a task to start building reusable site structure.</p>';
  }
  function renderDetail() {
    $('#web-composer').classList.toggle('hidden', !!detail);
    const container = $('#web-detail'); container.classList.toggle('hidden', !detail);
    if (!detail) { container.replaceChildren(); detailSignature = ''; return; }
    const signature = JSON.stringify(detail); if (signature === detailSignature) return; detailSignature = signature;
    const open = new Set([...container.querySelectorAll('details[open]')].map(node => node.dataset.keep));
    const ready = detail.status === 'ready', running = detail.status === 'running';
    container.innerHTML = `<div class="agent-run-header"><span>${escape(when(detail.createdAt))} · ${detail.input.mode === 'evidence' ? 'Source collection' : 'Goal-driven public browsing'}</span><button class="text-button" type="button" data-web-new>New task</button></div>
      <h2 class="web-task-title">${escape(detail.input.goal)}</h2>
      ${detail.input.parentId ? `<p class="hint">Follow-up to a saved task. Previous context informs the goal; source facts must be observed again. <button class="text-button" type="button" data-web-task="${escape(detail.input.parentId)}">Open previous task</button></p>` : ''}
      <div class="web-summary"><strong>${escape(labels[detail.status])}</strong><p>${escape(detail.error || (ready ? 'Review the websites and scope. No browser has been opened and no model has been called.' : `${detail.pages.length} sources captured · ${detail.modelCalls} model decisions`))}</p></div>
      ${ready ? `<ol class="web-plan"><li>${detail.input.urls.length ? `Read ${detail.input.urls.map(url => `<a href="${safeHref(url)}" target="_blank" rel="noreferrer">${escape(url)}</a>`).join(', ')}.` : 'Find starting sources using public-web search or direct navigation.'}</li><li>${detail.input.mode === 'evidence' ? 'Capture accessible page content and source links. Save website structure. No goal interpretation or generated answer.' : 'Use your goal to decide which public pages and observed links to visit, and what information to extract.'}</li><li>${detail.input.mode === 'evidence' ? 'Return source evidence for your inspection.' : 'Return an answer with source quotes checked against captured text; extracted values must appear in their source quotes.'}</li><li>Keep the receipt and website structure. No sign-in, account access or external writes.</li></ol>` : ''}
      <div class="agent-run-controls">${ready ? '<button type="button" class="primary" id="web-run">Run reviewed task →</button>' : running ? '<button type="button" class="stop" id="web-stop">Stop task</button>' : '<button type="button" class="secondary" id="web-repeat">Review a follow-up</button>'}<a href="/api/web/tasks/${escape(detail.id)}/receipt">Download task & evidence ↓</a>${!running ? '<button type="button" class="text-button" id="web-forget-task">Forget task</button>' : ''}</div>
      ${ready && detail.input.mode === 'agent' && !state.model.configured ? '<p class="hint">This mode needs a server model connection. Use New task and choose source evidence to browse without one.</p>' : ''}
      ${detail.answer ? `<div class="web-answer">${escape(detail.answer)}</div><p class="hint">Quotes are checked against observed source text. Interpretations and source accuracy still need your judgment.</p>` : detail.status === 'evidence' ? '<p class="hint">These are source observations. Juno has not interpreted your goal or generated an answer.</p>' : ''}
      ${detail.rows.length ? `<div class="web-table-wrap"><table><thead><tr><th>Field</th><th>Extracted value</th><th>Source</th></tr></thead><tbody>${detail.rows.map(row => `<tr><td>${escape(row.label)}</td><td>${escape(row.value)}</td><td>${escape(row.pageId)}<details><summary>Source quote</summary>${escape(row.quote)}</details></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${detail.hasScreenshot ? `<figure class="agent-browser"><div class="agent-browser-bar"><span>Browser observation</span><span>Last captured page</span></div><img src="/api/web/tasks/${escape(detail.id)}/screenshot?t=${encodeURIComponent(detail.updatedAt)}" alt="Last captured browser view for this task"></figure>` : ''}
      ${detail.pages.length ? '<h3>Sources & evidence</h3>' : ''}
      ${detail.pages.map(source => `<article class="web-source"><h3>${escape(source.id)} · <a href="${safeHref(source.url)}" target="_blank" rel="noreferrer">${escape(source.title || source.url)}</a></h3><p>${escape(source.url)} · ${escape(when(source.observedAt))}${source.memory ? ` · ${source.memory.reused ? 'Refreshed saved site structure' : 'Learned site structure'}` : ''}</p>${detail.citations.filter(citation => citation.pageId === source.id).map(citation => `<blockquote>${escape(citation.quote)}</blockquote>`).join('')}<details data-keep="source-${escape(source.id)}"><summary>Read captured source · ${source.text.length.toLocaleString()} characters</summary><pre>${escape(source.text)}</pre></details></article>`).join('')}
      <details class="agent-audit" data-keep="web-log" ${running ? 'open' : ''}><summary>Activity · ${detail.events.length} events</summary><ol>${detail.events.map(event => `<li class="web-event"><time>${escape(new Date(event.at).toLocaleTimeString())}</time>${escape(event.message)}</li>`).join('')}</ol></details>`;
    for (const node of container.querySelectorAll('details[data-keep]')) if (open.has(node.dataset.keep)) node.open = true;
  }
  async function load() {
    const version = generation;
    state = await api();
    if (!initialized) {
      const saved = savedSelection();
      selected = saved === 'new' ? undefined : state.tasks.find(task => task.id === saved)?.id || state.activeId || state.tasks[0]?.id;
      initialized = true; rememberSelection();
      if (!state.model.configured) form.elements.mode.value = 'evidence';
    }
    const id = selected;
    const next = id ? await api(`/tasks/${id}`) : undefined;
    if (version !== generation || id !== selected) { again = true; return; }
    detail = next; renderHistory(); renderSites(); renderDetail(); controls();
  }
  function refresh() {
    if (refreshing) { again = true; return refreshing; }
    refreshing = (async () => { do { again = false; await load(); } while (again); })().finally(() => { refreshing = undefined; });
    return refreshing;
  }
  async function act(work) {
    if (working) return; working = true; controls(); notice();
    try { await work(); await refresh(); }
    catch (error) { notice(error.message, true); }
    finally { working = false; controls(); }
  }
  function composer(input, parent) {
    generation++; selected = undefined; detail = undefined; initialized = true; renderDetail();
    rememberSelection();
    parentId = parent?.id;
    $('#web-followup').classList.toggle('hidden', !parent);
    $('#web-followup').textContent = parent ? `Follow-up to: ${parent.input.goal}. The previous task stays available as context.` : '';
    form.reset();
    if (input) { form.elements.goal.value = input.goal; form.elements.urls.value = input.urls.join('\n'); }
    form.elements.mode.value = input?.mode || (state?.model.configured ? 'agent' : 'evidence');
    if (state) renderHistory(); notice(); form.elements.goal.focus();
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const input = { goal: form.elements.goal.value, urls: form.elements.urls.value.split(/\r?\n/).map(url => url.trim()).filter(Boolean), mode: form.elements.mode.value, ...(parentId ? { parentId } : {}) };
    const version = generation;
    void act(async () => { const task = await api('/prepare', input); if (version === generation) { generation++; selected = task.id; initialized = true; rememberSelection(); } });
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-web-new')) return composer();
    if (button.dataset.webExample) return composer(examples[button.dataset.webExample]);
    if (button.dataset.webTask) { generation++; selected = button.dataset.webTask; rememberSelection(); void refresh().catch(error => notice(error.message, true)); }
    if (button.id === 'web-run' && detail) { const id = detail.id; void act(() => api(`/tasks/${id}/run`, {})); }
    if (button.id === 'web-stop' && detail) { const id = detail.id; void act(() => api(`/tasks/${id}/stop`, {})); }
    if (button.id === 'web-repeat' && detail) return composer({ ...detail.input, goal: '', urls: detail.pages.length ? detail.pages.map(page => page.url).slice(0, 5) : detail.input.urls }, detail);
    if (button.id === 'web-forget-task' && detail) { const id = detail.id; void act(async () => { await api(`/tasks/${id}/forget`, {}); composer(); }); }
    if (button.dataset.webForgetSite) void act(() => api('/knowledge/forget', { origin: button.dataset.webForgetSite }));
  });
  window.addEventListener('hashchange', () => { if (location.hash === '#agent') void refresh().catch(error => notice(error.message, true)); });
  setInterval(() => { if (!document.hidden && !$('#agent').classList.contains('hidden')) void refresh().catch(() => notice('Connection lost. Inspect your saved task after reconnecting before starting another.', true)); }, 1500);
  void refresh().catch(error => notice(error.message, true));
})();

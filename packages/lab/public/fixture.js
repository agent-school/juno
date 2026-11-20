const form = document.querySelector('form');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.querySelector('#status');
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const params = new URLSearchParams(location.search);
    const response = await fetch('/api/interactions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-juno-request': '1' },
      body: JSON.stringify({ requestId: params.get('requestId') || crypto.randomUUID(), inputs: Object.fromEntries(new FormData(form)) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    status.textContent = result.created ? 'Interaction saved.' : 'Request accepted. Check the saved records.';
    // Render the authoritative server view; the verifier independently checks stored state.
    const html = await (await fetch('/fixture')).text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.querySelector('#records').replaceChildren(...parsed.querySelector('#records').childNodes);
    window.parent.postMessage({ type: 'juno-fixture-saved' }, location.origin);
  } catch (error) { status.textContent = error.message || 'Unable to save.'; }
  finally { button.disabled = false; }
});

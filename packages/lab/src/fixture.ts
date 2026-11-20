import type { LabState } from './contracts.js';
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function fixture(state: LabState): string {
  const button = state.variant === 'renamed' ? 'Log interaction' : 'Capture interaction';
  const fields = [
    '<label>Person<select name="person"><option>Alice Smith</option><option>Bob Chen</option></select></label>',
    '<label>Interaction note<textarea name="note" required maxlength="500" placeholder="What did you talk about?"></textarea></label>',
    '<label>Interaction date<input name="occurred_at" required placeholder="YYYY-MM-DD" value="'+new Date().toISOString().slice(0,10)+'"></label>',
    '<label>Next action<input name="next_action" required maxlength="200" placeholder="What happens next?"></label>',
  ];
  if (state.variant === 'reordered') fields.reverse();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Juno relationship sandbox</title><link rel="stylesheet" href="/fixture.css"><script defer src="/fixture.js"></script></head><body>
    <header><span class="dot"></span> RELATIONSHIP SANDBOX <small>Synthetic data only</small></header>
    <main><h1>A conversation worth remembering.</h1><p class="intro">A small contact app for testing Juno. Nothing here sends a message or touches Rolo.</p>
    <form aria-label="Capture an interaction">${fields.map(field => `<div class="field">${field}</div>`).join('')}<button>${button}</button>${state.variant === 'ambiguous' ? `<button type="button">${button}</button>` : ''}</form>
    <p role="status" id="status"></p><h2>Saved interactions <span>${state.interactions.length}</span></h2><div id="records">${state.interactions.slice(-8).reverse().map(record => `<article><strong>${escapeHtml(record.person)}</strong><time>${escapeHtml(record.occurred_at)}</time><p>${escapeHtml(record.note)}</p><small>Next: ${escapeHtml(record.next_action)}</small></article>`).join('') || '<p class="intro">No interactions yet. Run the operation or try the form yourself.</p>'}</div></main></body></html>`;
}

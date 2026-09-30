// Piccoli strumenti per costruire l'interfaccia senza mai usare innerHTML con testi altrui.
const SVG = 'http://www.w3.org/2000/svg';

export function h(tag, attrs = {}, ...figli) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of figli.flat()) {
    if (f === null || f === undefined || f === false) continue;
    el.append(typeof f === 'object' && f.nodeType ? f : document.createTextNode(String(f)));
  }
  return el;
}

export function icona(id, classe = 'icon') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', classe);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

const formatoData = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function formattaData(iso) {
  const [y, m, g] = String(iso).split('-').map(Number);
  return formatoData.format(new Date(Date.UTC(y, m - 1, g)));
}

let timerToast = null;
/** Avviso in basso. Con `azione` mostra un tasto (per esempio Annulla). */
export function mostraToast(messaggio, { azione, onAzione, durata = 4000, errore = false } = {}) {
  const area = document.getElementById('area-toast');
  clearTimeout(timerToast);
  area.replaceChildren();
  const chiudi = () => { clearTimeout(timerToast); area.replaceChildren(); };
  const toast = h('div', { class: `toast${errore ? ' toast--errore' : ''}`, role: errore ? 'alert' : 'status' },
    h('span', { text: messaggio }),
    azione && h('button', { type: 'button', class: 'btn', text: azione, onclick: () => { chiudi(); onAzione?.(); } }),
  );
  area.append(toast);
  timerToast = setTimeout(chiudi, durata);
  return chiudi;
}

/**
 * Finestra di conferma. Ritorna 'conferma', 'alternativa' o 'annulla'.
 * `alternativa` è un secondo tasto opzionale (per esempio "Sostituisci tutto").
 */
export function chiedi({ titolo, testo, conferma = 'Conferma', alternativa = null, pericolo = false }) {
  const dlg = document.getElementById('conferma');
  const ok = document.getElementById('conferma-ok');
  const alt = document.getElementById('conferma-alt');
  const no = document.getElementById('conferma-annulla');
  document.getElementById('conferma-titolo').textContent = titolo;
  document.getElementById('conferma-testo').textContent = testo;
  ok.textContent = conferma;
  ok.classList.toggle('btn--pericolo', pericolo);
  ok.classList.toggle('btn--primario', !pericolo);
  alt.hidden = !alternativa;
  if (alternativa) alt.textContent = alternativa;
  return new Promise((risolvi) => {
    const fine = (v) => { dlg.close(); risolvi(v); };
    ok.onclick = () => fine('conferma');
    alt.onclick = () => fine('alternativa');
    no.onclick = () => fine('annulla');
    dlg.oncancel = (ev) => { ev.preventDefault(); fine('annulla'); };
    dlg.showModal();
    no.focus();
  });
}

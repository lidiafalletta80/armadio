import { h, icona, mostraToast, chiedi, formattaData } from './ui.js';
import { oggiISO } from './expiry.js';
import * as db from './db.js';
import {
  CATEGORIE, STAGIONI, OCCASIONI, ULTIMO_USO, creaCapo, creaOutfit, erroriCapo, giorniDaUltimoUso, daRimettereInGioco,
  volteIndossato, segnaIndossato, elencoPerAI, parseLista, ultimoUso, dividiElenco,
} from './model.js';
import { riduci, blobADati, daDati } from './immagini.js';
import { chiediAI } from './ai.js';

const VERSIONE_APP = '0.1.0';
const $ = (sel) => document.querySelector(sel);
const stato = {
  capi: [], outfit: [], foto: [],
  vista: 'pagine', pagina: 'armadio',
  filtro: 'Tutti', codice: '', soglia: 60, archivioOk: true,
  fotoScelta: null, // id della foto di me usata per il parere
};

/* ================= Foto: indirizzi temporanei ================= */
const indirizzi = new WeakMap();
function urlDi(blob) {
  if (!blob) return '';
  if (!indirizzi.has(blob)) indirizzi.set(blob, URL.createObjectURL(blob));
  return indirizzi.get(blob);
}
const plurale = (n, uno, piu) => `${n} ${n === 1 ? uno : piu}`;
const capoDi = (id) => stato.capi.find((c) => c.id === id);

/* ================= Navigazione ================= */
const PAGINE = ['armadio', 'outfit', 'io'];

function vaiA(nome, { porta = true } = {}) {
  const secondaria = nome === 'impostazioni';
  stato.vista = secondaria ? 'impostazioni' : 'pagine';
  if (!secondaria) stato.pagina = nome;
  for (const v of [...PAGINE, 'impostazioni']) $(`#vista-${v}`).hidden = v !== nome;
  $('#linguette').hidden = secondaria;
  $('#azioni-fisse').hidden = secondaria || nome === 'io';
  document.querySelectorAll('.lg').forEach((t) => {
    if (t.dataset.pagina === stato.pagina && !secondaria) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  disegna();
  if (!porta) return;
  window.scrollTo(0, 0);
  $(`#titolo-${nome}`)?.focus({ preventScroll: true });
}

function iniziaSfoglia() {
  let x0 = null, y0 = null;
  document.addEventListener('touchstart', (e) => {
    x0 = y0 = null;
    if (stato.vista !== 'pagine' || e.touches.length !== 1 || document.querySelector('dialog[open]')) return;
    if (e.target.closest?.('input, textarea, select, .filtri-capi, [data-no-sfoglia]')) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy)) return;
    const i = PAGINE.indexOf(stato.pagina) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < PAGINE.length) vaiA(PAGINE[i]);
  }, { passive: true });
}

function disegna() {
  if (stato.vista === 'impostazioni') return;
  document.body.className = `pagina-${stato.pagina}`;
  if (stato.pagina === 'armadio') disegnaArmadio();
  else if (stato.pagina === 'outfit') disegnaOutfit();
  else disegnaIo();
}

/* ================= Salvataggio ================= */
async function salva(store, oggetto, lista) {
  try {
    await db.salva(store, oggetto);
    stato.archivioOk = true;
  } catch (e) {
    console.error(e);
    stato.archivioOk = false;
    mostraToast('Non sono riuscita a salvare sul telefono. Riprova.', { errore: true, durata: 6000 });
  }
  const i = lista.findIndex((x) => x.id === oggetto.id);
  if (i >= 0) lista[i] = oggetto; else lista.push(oggetto);
}

async function togli(store, id, lista) {
  try { await db.elimina(store, id); } catch (e) { console.error(e); }
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista.splice(i, 1);
}

/* ================= Pagina Armadio ================= */
function fotoCapo(c, classe = 'capo-foto') {
  return h('span', { class: classe }, c.mini || c.foto ? h('img', { src: urlDi(c.mini || c.foto), alt: '', loading: 'lazy' }) : icona('i-attaccapanni', 'icon'));
}

function testoFermo(x) {
  return x.mai ? 'Mai messo' : `Fermo da ${x.giorni} gg`;
}

function disegnaArmadio() {
  const oggi = oggiISO();
  $('#avviso-archivio').replaceChildren(...(stato.archivioOk ? [] : [h('div', { class: 'aiuto', role: 'alert' },
    h('h3', { text: 'Non riesco a salvare sul telefono' }),
    h('p', { text: 'Il browser non permette di conservare i dati. Se stai usando la navigazione privata, esci e riapri l\'app.' }))]));
  const tipi = new Set(stato.capi.map((c) => c.categoria));
  $('#armadio-sotto').textContent = stato.capi.length
    ? `${plurale(stato.capi.length, 'capo', 'capi')} in ${plurale(tipi.size, 'categoria', 'categorie')}.`
    : 'Ancora vuoto: fotografa il primo capo.';

  // capi fermi
  const fermi = daRimettereInGioco(stato.capi, oggi, stato.soglia);
  const box = $('#fermi');
  box.hidden = fermi.length === 0;
  if (fermi.length) {
    box.replaceChildren(...[
      h('h3', {}, h('span', { class: 'rip-nome', text: 'Da rimettere in gioco' }), h('span', { class: 'rip-n', text: fermi.length })),
      ...fermi.slice(0, 5).map((x) => h('button', { type: 'button', class: 'fermi-riga', onclick: () => apriDettaglio(x.capo) },
        fotoCapo(x.capo), h('span', {}, h('b', { text: x.capo.nome }), h('br'), h('small', { class: 'capo-sub', text: x.capo.categoria })),
        h('span', { class: 'stato-fermo', text: testoFermo(x) }))),
      fermi.length > 5 && h('p', { class: 'nota-piccola', text: `E altri ${fermi.length - 5}. Filtra per tipo per vederli.` }),
    ].filter(Boolean));
  }

  // filtri per tipo
  const conta = (t) => stato.capi.filter((c) => c.categoria === t).length;
  if (stato.filtro !== 'Tutti' && conta(stato.filtro) === 0) stato.filtro = 'Tutti';
  const voci = ['Tutti', ...CATEGORIE.filter((t) => conta(t) > 0)];
  $('#filtri-capi').replaceChildren(...(stato.capi.length ? voci.map((t) => h('button', {
    type: 'button', class: 'chip-btn', 'aria-pressed': String(stato.filtro === t),
    onclick: () => { stato.filtro = t; disegnaArmadio(); },
  }, t, h('span', { class: 'chip-conta', text: t === 'Tutti' ? stato.capi.length : conta(t) }))) : []));

  // griglia
  const idFermi = new Map(fermi.map((x) => [x.capo.id, x]));
  const visibili = stato.capi.filter((c) => stato.filtro === 'Tutti' || c.categoria === stato.filtro)
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'it') || a.nome.localeCompare(b.nome, 'it'));
  $('#griglia-capi').replaceChildren(...visibili.map((c) => {
    const f = idFermi.get(c.id);
    return h('button', { type: 'button', class: 'capo', onclick: () => apriDettaglio(c), 'aria-label': `${c.nome}, ${c.categoria}${f ? `. ${testoFermo(f)}` : ''}` },
      h('span', { class: 'capo-foto' }, c.mini || c.foto ? h('img', { src: urlDi(c.mini || c.foto), alt: '', loading: 'lazy' }) : icona('i-attaccapanni', 'icon'),
        f && h('span', { class: 'timbro-capo', text: f.mai ? 'Mai messo' : 'Fermo' })),
      h('span', { class: 'capo-nome', text: c.nome }),
      h('span', { class: 'capo-sub', text: [c.categoria, c.colori.join(', ')].filter(Boolean).join(' · ') }));
  }));
  $('#armadio-vuoto').replaceChildren(...(stato.capi.length ? [] : [h('div', { class: 'vuoto-armadio' },
    h('h3', { text: 'Il tuo armadio è vuoto' }),
    h('p', { text: 'Scrivi l\'elenco di quello che hai, senza foto: basta un capo per riga. Le foto sono facoltative e le puoi aggiungere dopo, solo dei capi che vuoi.' }),
    h('div', { class: 'azioni' },
      h('button', { type: 'button', class: 'btn btn--primario', onclick: () => apriElenco() }, icona('i-elenco', 'icon icon--s'), 'Scrivi l\'elenco'),
      h('button', { type: 'button', class: 'btn btn--contorno', onclick: () => apriCapo() }, icona('i-piu', 'icon icon--s'), 'Aggiungi un capo')))]));
}

/* ================= Capo: nuovo, modifica, riconosci ================= */
const dlgCapo = $('#dlg-capo');
const C = { nome: $('#c-nome'), categoria: $('#c-categoria'), marca: $('#c-marca'), colori: $('#c-colori'), note: $('#c-note'), ultimo: $('#c-ultimo-uso') };
let capoInModifica = null;
let fotoNuova = null; // { foto, mini } appena scelte

C.categoria.replaceChildren(...CATEGORIE.map((c) => h('option', { value: c, text: c })));
C.ultimo.replaceChildren(...ULTIMO_USO.map((u) => h('option', { value: u.valore, text: u.etichetta })));
const spunte = (id, nomi, gruppo) => $(id).replaceChildren(...nomi.map((n) => h('label', {}, h('input', { type: 'checkbox', name: gruppo, value: n }), n)));
spunte('#c-stagioni', STAGIONI, 'stagioni');
spunte('#c-occasioni', OCCASIONI, 'occasioni');
const valoriSpunte = (gruppo) => [...document.querySelectorAll(`#dlg-capo input[name="${gruppo}"]:checked`)].map((i) => i.value);
const impostaSpunte = (gruppo, valori) => document.querySelectorAll(`#dlg-capo input[name="${gruppo}"]`).forEach((i) => { i.checked = valori.includes(i.value); });

function mostraFotoCapo() {
  const blob = fotoNuova?.foto || capoInModifica?.foto;
  $('#foto-capo').replaceChildren(blob ? h('img', { src: urlDi(blob), alt: 'Foto del capo' })
    : h('span', { class: 'foto-vuota' }, icona('i-attaccapanni', 'icon'), 'Nessuna foto'));
  $('#btn-riconosci').hidden = !blob;
}

function mostraErroreCapo(msg) {
  const e = $('#e-c-nome');
  e.hidden = !msg; e.textContent = msg || '';
  C.nome.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function apriCapo(capo = null, { foto = null } = {}) {
  capoInModifica = capo;
  fotoNuova = foto;
  $('#capo-titolo').textContent = capo ? 'Modifica capo' : 'Nuovo capo';
  C.nome.value = capo?.nome || '';
  C.categoria.value = capo?.categoria || CATEGORIE[0];
  C.marca.value = capo?.marca || '';
  C.colori.value = (capo?.colori || []).join(', ');
  C.note.value = capo?.note || '';
  C.ultimo.value = capo?.ultimo_uso_scelta || 'nonso';
  $('#campo-ultimo-uso').hidden = Boolean(capo);
  impostaSpunte('stagioni', capo?.stagioni || []);
  impostaSpunte('occasioni', capo?.occasioni || []);
  $('#c-elimina').hidden = !capo;
  $('#c-salva').textContent = capo ? 'Salva le modifiche' : 'Aggiungi';
  $('#capo-stato').textContent = '';
  mostraErroreCapo('');
  mostraFotoCapo();
  dlgCapo.showModal();
}

async function scegliFoto(file) {
  if (!file) return;
  $('#capo-stato').textContent = 'Preparo la foto…';
  try {
    fotoNuova = { foto: await riduci(file, { lato: 1024 }), mini: await riduci(file, { lato: 360, qualita: 0.78 }) };
    mostraFotoCapo();
    $('#capo-stato').textContent = stato.codice ? 'Tocca «Riconosci con Claude» per compilare i dati da solo.' : '';
    if (stato.codice && !C.nome.value.trim()) riconosci();
  } catch {
    $('#capo-stato').textContent = 'Non riesco ad aprire questa foto. Prova con un\'altra.';
  }
}
for (const id of ['#file-capo-scatta', '#file-capo-galleria']) {
  $(id).addEventListener('change', (ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; scegliFoto(f); });
}

let riconoscendo = false;
async function riconosci() {
  const blob = fotoNuova?.foto || capoInModifica?.foto;
  if (!blob || riconoscendo) return;
  if (!stato.codice) { $('#capo-stato').textContent = 'Per usare Claude scrivi prima il codice personale nelle Impostazioni.'; return; }
  riconoscendo = true;
  $('#btn-riconosci').disabled = true;
  $('#capo-stato').textContent = 'Claude sta guardando la foto…';
  const r = await chiediAI({ azione: 'analizza_capo', immagini: [{ tipo: 'image/jpeg', dati: await blobADati(blob) }] }, stato.codice);
  riconoscendo = false;
  $('#btn-riconosci').disabled = false;
  if (!r.ok) { $('#capo-stato').textContent = r.errore; return; }
  const a = r.risposta;
  if (a.nome) C.nome.value = a.nome;
  if (a.categoria) C.categoria.value = a.categoria;
  if (a.colori.length) C.colori.value = a.colori.join(', ');
  impostaSpunte('stagioni', a.stagioni);
  impostaSpunte('occasioni', a.occasioni);
  if (a.note && !C.note.value.trim()) C.note.value = a.note;
  mostraErroreCapo('');
  $('#capo-stato').textContent = 'Ho compilato i dati: controllali e correggi se serve.';
}
$('#btn-riconosci').addEventListener('click', riconosci);
$('#capo-chiudi').addEventListener('click', () => dlgCapo.close());

$('#form-capo').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const dati = {
    nome: C.nome.value, categoria: C.categoria.value, marca: C.marca.value, colori: C.colori.value, note: C.note.value,
    stagioni: valoriSpunte('stagioni'), occasioni: valoriSpunte('occasioni'),
  };
  if (erroriCapo(dati).length) { mostraErroreCapo('Scrivi il nome del capo.'); C.nome.focus(); return; }
  const e = capoInModifica;
  const capo = creaCapo({
    ...(e || {}), ...dati, id: e?.id, aggiunto_il: e?.aggiunto_il, indossato: e?.indossato,
    foto: fotoNuova?.foto || e?.foto, mini: fotoNuova?.mini || e?.mini,
    ultimo_uso_scelta: e ? e.ultimo_uso_scelta : C.ultimo.value, ultimo_uso: e?.ultimo_uso, mai_messo: e?.mai_messo,
  }, { id: e?.id, oggi: oggiISO() });
  await salva('capi', capo, stato.capi);
  dlgCapo.close();
  disegna();
  mostraToast(e ? 'Modifiche salvate.' : `«${capo.nome}» aggiunto all'armadio.`);
});

$('#c-elimina').addEventListener('click', async () => {
  const c = capoInModifica;
  if (!c) return;
  const usatoIn = stato.outfit.filter((o) => o.capi.includes(c.id)).length;
  const scelta = await chiedi({
    titolo: `Eliminare «${c.nome}»?`,
    testo: usatoIn ? `Il capo è in ${plurale(usatoIn, 'outfit', 'outfit')}: verrà tolto anche da lì. Non si può annullare.` : 'Non si può annullare.',
    conferma: 'Elimina', pericolo: true,
  });
  if (scelta !== 'conferma') return;
  dlgCapo.close();
  await togli('capi', c.id, stato.capi);
  for (const o of stato.outfit.filter((x) => x.capi.includes(c.id))) await salva('outfit', { ...o, capi: o.capi.filter((id) => id !== c.id) }, stato.outfit);
  disegna();
  mostraToast(`«${c.nome}» eliminato.`);
});

/* ================= Elenco scritto a parole ================= */
const dlgElenco = $('#dlg-elenco');
let proposti = [];

function disegnaAnteprima() {
  const box = $('#el-anteprima');
  box.replaceChildren(...(proposti.length ? [
    h('h3', { text: `Ho trovato ${plurale(proposti.length, 'capo', 'capi')}` }),
    ...proposti.map((p, i) => h('label', { class: 'el-riga' },
      h('input', { type: 'checkbox', checked: p.tieni, onchange: (e) => { p.tieni = e.target.checked; aggiornaConteggioElenco(); } }),
      h('b', { text: p.nome }), h('small', { text: [p.categoria, p.colori.join(', ')].filter(Boolean).join(' · ') }))),
  ] : []));
  aggiornaConteggioElenco();
}
function aggiornaConteggioElenco() {
  const n = proposti.filter((p) => p.tieni).length;
  $('#el-aggiungi').hidden = proposti.length === 0;
  $('#el-aggiungi').disabled = n === 0;
  $('#el-aggiungi').textContent = n ? `Aggiungi ${plurale(n, 'capo', 'capi')}` : 'Scegli almeno un capo';
}

function apriElenco() {
  proposti = [];
  $('#el-testo').value = '';
  $('#el-stato').textContent = '';
  disegnaAnteprima();
  dlgElenco.showModal();
}
$('#el-chiudi').addEventListener('click', () => dlgElenco.close());
$('#form-elenco').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const t = $('#el-testo').value.trim();
  if (t.length < 3) { $('#el-stato').textContent = 'Scrivi almeno un capo.'; return; }
  $('#el-vai').disabled = true;
  let capi = null;
  if (stato.codice) {
    $('#el-stato').textContent = 'Claude sta leggendo il tuo elenco…';
    const r = await chiediAI({ azione: 'elenco_capi', testo: t }, stato.codice);
    if (r.ok) { capi = r.risposta.capi; $('#el-stato').textContent = ''; }
    else $('#el-stato').textContent = `${r.errore} Uso il riconoscimento semplice: controlla i tipi.`;
  } else {
    $('#el-stato').textContent = 'Senza il codice personale uso il riconoscimento semplice: controlla i tipi dopo.';
  }
  if (!capi) capi = dividiElenco(t);
  $('#el-vai').disabled = false;
  proposti = capi.map((c) => ({ ...c, tieni: true }));
  if (!proposti.length) $('#el-stato').textContent = 'Non ho trovato nessun capo. Prova con un elenco più semplice.';
  disegnaAnteprima();
});
$('#el-aggiungi').addEventListener('click', async () => {
  const daAggiungere = proposti.filter((p) => p.tieni);
  const oggi = oggiISO();
  for (const p of daAggiungere) await salva('capi', creaCapo({ ...p, ultimo_uso_scelta: 'nonso' }, { oggi }), stato.capi);
  dlgElenco.close();
  disegna();
  mostraToast(`${plurale(daAggiungere.length, 'capo aggiunto', 'capi aggiunti')} all'armadio.`);
});
$('#btn-elenco-testo').addEventListener('click', apriElenco);

/* ================= Un capo aperto ================= */
const dlgDettaglio = $('#dlg-dettaglio');
let capoAperto = null;

function apriDettaglio(c) {
  capoAperto = c;
  const oggi = oggiISO();
  const g = giorniDaUltimoUso(c, oggi);
  const volte = volteIndossato(c);
  $('#d-titolo').textContent = c.nome;
  $('#d-foto').replaceChildren(c.foto || c.mini ? h('img', { src: urlDi(c.foto || c.mini), alt: c.nome }) : h('span', { class: 'foto-vuota' }, icona('i-attaccapanni', 'icon'), 'Nessuna foto'));
  const cella = (n, v) => h('div', {}, h('small', { text: n }), h('b', { text: v }));
  $('#d-fascia').replaceChildren(cella('Messo', volte ? plurale(volte, 'volta', 'volte') : c.mai_messo ? 'Mai' : '—'),
    cella('Ultima volta', g === null ? '—' : g === 0 ? 'Oggi' : `${g} gg fa`), cella('Tipo', c.categoria));
  $('#d-tag').replaceChildren(...[...c.colori, ...c.stagioni, ...c.occasioni, c.marca].filter(Boolean).map((t) => h('span', { class: 'tag', text: t })));
  $('#d-note').textContent = c.note;
  $('#d-note').hidden = !c.note;
  dlgDettaglio.showModal();
}
$('#d-chiudi').addEventListener('click', () => dlgDettaglio.close());
dlgDettaglio.addEventListener('click', (ev) => { if (ev.target === dlgDettaglio) dlgDettaglio.close(); });
$('#d-modifica').addEventListener('click', () => { const c = capoAperto; dlgDettaglio.close(); if (c) apriCapo(c); });
$('#d-oggi').addEventListener('click', async () => {
  const c = capoAperto;
  if (!c) return;
  await salva('capi', segnaIndossato(c, oggiISO()), stato.capi);
  dlgDettaglio.close();
  disegna();
  mostraToast(`«${c.nome}» segnato come messo oggi.`);
});
$('#d-abbina').addEventListener('click', () => {
  const c = capoAperto;
  dlgDettaglio.close();
  if (!c) return;
  vaiA('outfit');
  $('#sugg-testo').value = `Abbina «${c.nome}»`;
  $('#form-sugg').requestSubmit();
});

/* ================= Pagina Outfit ================= */
function collage(ids, { classe = '' } = {}) {
  const capi = ids.map(capoDi).filter(Boolean).slice(0, 4);
  return h('div', { class: `collage n${capi.length} ${classe}` }, capi.map((c) => (c.mini || c.foto
    ? h('img', { src: urlDi(c.mini || c.foto), alt: c.nome, loading: 'lazy' }) : h('span', { class: 'senza-foto', text: c.nome }))));
}

const nomiCapi = (ids) => ids.map(capoDi).filter(Boolean).map((c) => c.nome).join(', ');

function cartaOutfit(o) {
  const volte = volteIndossato(o);
  return h('article', { class: 'outfit-carta' },
    collage(o.capi), h('h4', { text: o.nome }),
    h('p', { class: 'meta', text: [o.occasione, plurale(o.capi.length, 'capo', 'capi'), volte ? `messo ${plurale(volte, 'volta', 'volte')}` : 'mai messo'].filter(Boolean).join(' · ') }),
    h('p', { class: 'meta', text: nomiCapi(o.capi) }),
    o.note && h('p', { text: o.note }),
    h('div', { class: 'azioni' },
      h('button', { type: 'button', class: 'btn btn--primario btn--piccolo', onclick: () => outfitOggi(o) }, icona('i-ok', 'icon icon--s'), 'Messo oggi'),
      h('button', { type: 'button', class: 'btn btn--contorno btn--piccolo', onclick: () => apriOutfit(o) }, icona('i-modifica', 'icon icon--s'), 'Modifica'),
      h('button', { type: 'button', class: 'btn btn--contorno btn--piccolo', onclick: () => { stato.parereOutfit = o.id; vaiA('io'); } }, icona('i-persona', 'icon icon--s'), 'Come mi sta?')));
}

async function outfitOggi(o) {
  const oggi = oggiISO();
  await salva('outfit', segnaIndossato(o, oggi), stato.outfit);
  for (const id of o.capi) { const c = capoDi(id); if (c) await salva('capi', segnaIndossato(c, oggi), stato.capi); }
  disegna();
  mostraToast(`«${o.nome}» segnato come messo oggi.`);
}

function disegnaOutfit() {
  $('#outfit-n').textContent = stato.outfit.length;
  $('#lista-outfit').replaceChildren(...(stato.outfit.length
    ? [...stato.outfit].sort((a, b) => b.creato_il.localeCompare(a.creato_il)).map(cartaOutfit)
    : [h('p', { class: 'ripiano-vuoto', text: 'Ancora nessun outfit. Creane uno a mano o fatti suggerire qualcosa.' })]));
}

/* Suggerimenti di Claude */
let suggerendo = false;
$('#form-sugg').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (suggerendo) return;
  const box = $('#sugg-risposta');
  if (stato.capi.length < 2) { box.replaceChildren(h('div', { class: 'aiuto', role: 'alert' }, h('h3', { text: 'Servono più capi' }), h('p', { text: 'Aggiungi almeno due capi all\'armadio per avere degli abbinamenti.' }))); return; }
  if (!stato.codice) { box.replaceChildren(erroreCodice()); return; }
  suggerendo = true;
  $('#sugg-invia').disabled = true;
  box.replaceChildren(h('p', { class: 'pensa-a', role: 'status', text: 'Sto guardando il tuo armadio…' }));
  const r = await chiediAI({ azione: 'suggerisci_outfit', capi: elencoPerAI(stato.capi, oggiISO()), richiesta: $('#sugg-testo').value.trim() }, stato.codice);
  suggerendo = false;
  $('#sugg-invia').disabled = false;
  if (!r.ok) { box.replaceChildren(h('div', { class: 'aiuto', role: 'alert' }, h('h3', { text: 'Non ci sono riuscita' }), h('p', { text: r.errore }))); return; }
  const a = r.risposta;
  box.replaceChildren(...[
    a.messaggio && h('p', { class: 'msg-claude-a', text: a.messaggio }),
    ...a.outfit.map((o) => h('article', { class: 'outfit-carta' },
      collage(o.capi_ids), h('h4', { text: o.nome }),
      h('p', { class: 'meta', text: [o.occasione, nomiCapi(o.capi_ids)].filter(Boolean).join(' · ') }),
      h('p', { text: o.perche }),
      o.consigli.length > 0 && h('ul', {}, o.consigli.map((c) => h('li', { text: c }))),
      h('div', { class: 'azioni' },
        h('button', { type: 'button', class: 'btn btn--primario btn--piccolo', onclick: async (e) => {
          e.currentTarget.disabled = true;
          await salva('outfit', creaOutfit({ nome: o.nome, capi: o.capi_ids, occasione: o.occasione, note: o.perche }, { oggi: oggiISO() }), stato.outfit);
          disegna();
          mostraToast(`Outfit «${o.nome}» salvato.`);
        } }, icona('i-piu', 'icon icon--s'), 'Salva outfit'))),
    ),
    a.outfit.length > 0 && h('p', { class: 'nota-piccola', text: 'Sono idee: guardale insieme ai capi veri, e correggi come preferisci.' }),
  ].filter(Boolean));
});

function erroreCodice() {
  return h('div', { class: 'aiuto', role: 'alert' }, h('h3', { text: 'Manca il codice personale' }),
    h('p', { text: 'Serve per usare Claude. Lo scrivi una volta sola nelle Impostazioni.' }),
    h('div', { class: 'azioni' }, h('button', { type: 'button', class: 'btn btn--piccolo', onclick: () => vaiA('impostazioni') }, 'Vai alle Impostazioni')));
}

/* ================= Outfit: costruttore ================= */
const dlgOutfit = $('#dlg-outfit');
let outfitInModifica = null;
let selezionati = new Set();
$('#o-occasione').replaceChildren(h('option', { value: '', text: 'Nessuna' }), ...OCCASIONI.map((o) => h('option', { value: o, text: o })));

function disegnaScelta() {
  $('#o-conta').textContent = selezionati.size;
  const ordinati = [...stato.capi].sort((a, b) => CATEGORIE.indexOf(a.categoria) - CATEGORIE.indexOf(b.categoria) || a.nome.localeCompare(b.nome, 'it'));
  $('#o-capi').replaceChildren(...(ordinati.length ? ordinati.map((c) => h('button', {
    type: 'button', class: 'scegli', 'aria-pressed': String(selezionati.has(c.id)),
    onclick: () => { if (selezionati.has(c.id)) selezionati.delete(c.id); else selezionati.add(c.id); disegnaScelta(); },
  }, fotoCapo(c), h('small', { text: c.nome }))) : [h('p', { class: 'ripiano-vuoto', text: 'Aggiungi prima qualche capo all\'armadio.' })]));
}

function apriOutfit(o = null) {
  outfitInModifica = o;
  selezionati = new Set(o?.capi || []);
  $('#o-titolo').textContent = o ? 'Modifica outfit' : 'Nuovo outfit';
  $('#o-nome').value = o?.nome || '';
  $('#o-occasione').value = o?.occasione || '';
  $('#o-elimina').hidden = !o;
  $('#e-o-capi').hidden = true;
  disegnaScelta();
  dlgOutfit.showModal();
}
$('#o-chiudi').addEventListener('click', () => dlgOutfit.close());
$('#form-outfit').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (selezionati.size < 2) { const e = $('#e-o-capi'); e.hidden = false; e.textContent = 'Scegli almeno due capi.'; return; }
  const e = outfitInModifica;
  const o = creaOutfit({ ...(e || {}), nome: $('#o-nome').value, occasione: $('#o-occasione').value, capi: [...selezionati] }, { id: e?.id, oggi: oggiISO() });
  await salva('outfit', o, stato.outfit);
  dlgOutfit.close();
  vaiA('outfit', { porta: false });
  mostraToast(e ? 'Outfit salvato.' : `Outfit «${o.nome}» creato.`);
});
$('#o-elimina').addEventListener('click', async () => {
  const o = outfitInModifica;
  if (!o) return;
  const scelta = await chiedi({ titolo: `Eliminare «${o.nome}»?`, testo: 'I capi restano nell\'armadio. Non si può annullare.', conferma: 'Elimina', pericolo: true });
  if (scelta !== 'conferma') return;
  dlgOutfit.close();
  await togli('outfit', o.id, stato.outfit);
  disegna();
});

/* ================= Pagina Io: le mie foto e il parere ================= */
function disegnaIo() {
  $('#foto-n').textContent = stato.foto.length;
  if (!stato.foto.some((f) => f.id === stato.fotoScelta)) stato.fotoScelta = stato.foto[0]?.id || null;
  $('#galleria-io').replaceChildren(...stato.foto.map((f) => h('div', { class: 'foto-io', 'aria-selected': String(f.id === stato.fotoScelta) },
    h('img', { src: urlDi(f.mini || f.foto), alt: 'Una mia foto' }),
    h('button', { type: 'button', class: `scegli${f.id === stato.fotoScelta ? ' on' : ''}`, 'aria-label': 'Usa questa foto per il parere', onclick: () => { stato.fotoScelta = f.id; disegnaIo(); } }),
    h('button', { type: 'button', 'aria-label': 'Elimina questa foto', onclick: () => eliminaFotoIo(f) }, icona('i-cestino')))));
  const sel = $('#parere-outfit');
  sel.replaceChildren(...(stato.outfit.length ? stato.outfit.map((o) => h('option', { value: o.id, text: o.nome })) : [h('option', { value: '', text: 'Crea prima un outfit' })]));
  if (stato.parereOutfit && stato.outfit.some((o) => o.id === stato.parereOutfit)) sel.value = stato.parereOutfit;
}

async function aggiungiFotoIo(files) {
  for (const file of [...files].slice(0, 6 - stato.foto.length)) {
    try {
      const f = { id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, foto: await riduci(file, { lato: 1100 }), mini: await riduci(file, { lato: 360, qualita: 0.78 }), creato_il: oggiISO() };
      await salva('foto', f, stato.foto);
    } catch { mostraToast('Una foto non si è aperta. Prova con un\'altra.', { errore: true }); }
  }
  if (stato.foto.length >= 6) mostraToast('Massimo 6 foto: elimina una per aggiungerne altre.');
  disegnaIo();
}
for (const id of ['#file-io-scatta', '#file-io-galleria']) {
  $(id).addEventListener('change', (ev) => { const fs = [...(ev.target.files || [])]; ev.target.value = ''; if (fs.length) aggiungiFotoIo(fs); });
}

async function eliminaFotoIo(f) {
  const scelta = await chiedi({ titolo: 'Eliminare questa foto?', testo: 'Sparisce da questo telefono. Non si può annullare.', conferma: 'Elimina', pericolo: true });
  if (scelta !== 'conferma') return;
  await togli('foto', f.id, stato.foto);
  disegnaIo();
}

let parlando = false;
$('#form-parere').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (parlando) return;
  const box = $('#parere-risposta');
  const problema = (t, p) => box.replaceChildren(h('div', { class: 'aiuto', role: 'alert' }, h('h3', { text: t }), h('p', { text: p })));
  if (!stato.foto.length) return problema('Serve una tua foto', 'Aggiungi una foto a figura intera qui sopra: resta sul telefono e va a Claude solo per questo parere.');
  const o = stato.outfit.find((x) => x.id === $('#parere-outfit').value);
  if (!o) return problema('Serve un outfit', 'Crea un outfit nella pagina Outfit e poi torna qui.');
  if (!stato.codice) { box.replaceChildren(erroreCodice()); return; }
  const persona = stato.foto.find((f) => f.id === stato.fotoScelta) || stato.foto[0];
  const capi = o.capi.map(capoDi).filter(Boolean);
  parlando = true;
  $('#parere-invia').disabled = true;
  box.replaceChildren(h('p', { class: 'pensa-a', role: 'status', text: 'Claude sta guardando le foto…' }));
  const conFoto = capi.filter((c) => c.foto || c.mini).slice(0, 5);
  const r = await chiediAI({
    azione: 'parere_outfit',
    immagini_persona: [{ tipo: 'image/jpeg', dati: await blobADati(persona.foto) }],
    immagini_capi: await Promise.all(conFoto.map(async (c) => ({ tipo: 'image/jpeg', dati: await blobADati(c.mini && conFoto.length > 3 ? c.mini : (c.foto || c.mini)) }))),
    capi: capi.map((c) => ({ nome: c.nome, categoria: c.categoria, colori: c.colori })),
    richiesta: $('#parere-testo').value.trim(),
  }, stato.codice);
  parlando = false;
  $('#parere-invia').disabled = false;
  if (!r.ok) return problema('Non ci sono riuscita', r.errore);
  const a = r.risposta;
  const blocco = (titolo, righe) => righe.length > 0 && h('div', {}, h('h4', { text: titolo }), h('ul', {}, righe.map((x) => h('li', { text: x }))));
  box.replaceChildren(h('article', { class: 'outfit-carta elenco-parere' },
    h('h4', { text: o.nome }), collage(o.capi),
    a.messaggio && h('p', { class: 'msg-claude-a', text: a.messaggio }),
    blocco('Cosa funziona', a.funziona), blocco('Cosa cambierei', a.da_cambiare), blocco('Abbinamenti', a.abbinamenti), blocco('Accessori', a.accessori),
    h('p', { class: 'nota-piccola', text: 'È un parere di stile basato sulle foto, non una prova su di te: provalo sempre davanti allo specchio.' })));
});

/* ================= Impostazioni ================= */
$('#codice-personale').addEventListener('change', async () => {
  stato.codice = $('#codice-personale').value.trim();
  try { await db.scriviImp('codice_personale', stato.codice); $('#stato-codice').textContent = stato.codice ? 'Salvato.' : 'Codice tolto.'; }
  catch { $('#stato-codice').textContent = 'Non sono riuscita a salvare. Riprova.'; }
});
$('#soglia-giorni').addEventListener('change', async () => {
  const n = Math.min(365, Math.max(14, Math.round(Number($('#soglia-giorni').value) || 60)));
  $('#soglia-giorni').value = n;
  stato.soglia = n;
  try { await db.scriviImp('soglia_giorni', n); } catch { /* resta il valore in memoria */ }
});

$('#btn-esporta').addEventListener('click', async () => {
  const stat = $('#stato-dati');
  stat.textContent = 'Preparo la copia…';
  const dati = async (b) => (b ? blobADati(b) : null);
  const contenuto = JSON.stringify({
    app: 'armadio', versione: 1, esportato_il: new Date().toISOString(),
    capi: await Promise.all(stato.capi.map(async (c) => ({ ...c, foto: await dati(c.foto), mini: await dati(c.mini) }))),
    outfit: stato.outfit,
    foto: await Promise.all(stato.foto.map(async (f) => ({ ...f, foto: await dati(f.foto), mini: await dati(f.mini) }))),
  });
  const file = new File([contenuto], `armadio-${oggiISO()}.json`, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Copia di Armadio' }); stat.textContent = 'Copia pronta. Scegli «Salva su File» per conservarla.'; return; }
  } catch (e) { if (e?.name === 'AbortError') { stat.textContent = 'Copia annullata.'; return; } }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  stat.textContent = `Copia scaricata: ${file.name}.`;
});

$('#file-importa').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  const stat = $('#stato-dati');
  let j;
  try { j = JSON.parse(await file.text()); } catch { stat.textContent = 'Il file non è una copia valida di Armadio.'; return; }
  if (j?.app !== 'armadio' || !Array.isArray(j.capi)) { stat.textContent = 'Il file non è una copia valida di Armadio.'; return; }
  const scelta = await chiedi({ titolo: `Ripristinare ${plurale(j.capi.length, 'capo', 'capi')}?`, testo: 'Sostituisce tutto quello che c\'è ora in questa app (capi, outfit e foto).', conferma: 'Sostituisci tutto', pericolo: true });
  if (scelta !== 'conferma') return;
  const blob = (b) => (b ? daDati(b) : null);
  try {
    stato.capi = j.capi.map((c) => creaCapo({ ...c, foto: blob(c.foto), mini: blob(c.mini) }, { id: c.id }));
    stato.outfit = (j.outfit || []).map((o) => creaOutfit(o, { id: o.id }));
    stato.foto = (j.foto || []).map((f) => ({ id: f.id, creato_il: f.creato_il, foto: blob(f.foto), mini: blob(f.mini) }));
    await db.sostituisciTutti('capi', stato.capi); await db.sostituisciTutti('outfit', stato.outfit); await db.sostituisciTutti('foto', stato.foto);
    stat.textContent = `Fatto: ora hai ${plurale(stato.capi.length, 'capo', 'capi')}.`;
  } catch { stat.textContent = 'Non sono riuscita a ripristinare la copia. Riprova.'; }
});

$('#btn-cancella-tutto').addEventListener('click', async () => {
  const scelta = await chiedi({ titolo: 'Cancellare tutto?', testo: 'Vengono cancellati capi, outfit e foto da questo telefono. Non si può annullare: scarica prima una copia se vuoi conservarli.', conferma: 'Cancella tutto', pericolo: true });
  if (scelta !== 'conferma') return;
  await db.svuota('capi'); await db.svuota('outfit'); await db.svuota('foto');
  stato.capi = []; stato.outfit = []; stato.foto = [];
  $('#stato-dati').textContent = 'Tutto cancellato.';
});

/* ================= Badge di Netlify ================= */
/** Il badge «Powered by Netlify» sta in basso a destra: la barra si alza sopra di lui finché c'è. */
function tieniLibereAzioni() {
  const radice = document.documentElement.style;
  const aggiorna = () => {
    const f = document.getElementById('nl-badge-frame') || document.getElementById('nl-hud-frame');
    const chiuso = !f || /M\s*0\s*0\s*Z/.test(f.style.clipPath || '');
    const alto = chiuso ? 0 : Math.ceil(f.getBoundingClientRect().height);
    radice.setProperty('--badge-h', `${alto}px`);
    radice.setProperty('--basso-sicuro', alto ? '0px' : 'env(safe-area-inset-bottom)');
  };
  const visti = new WeakSet();
  const osservaFrame = new MutationObserver(aggiorna);
  const cerca = () => {
    const f = document.getElementById('nl-badge-frame') || document.getElementById('nl-hud-frame');
    if (f && !visti.has(f)) { visti.add(f); osservaFrame.observe(f, { attributes: true, attributeFilter: ['style'] }); }
    aggiorna();
  };
  new MutationObserver(cerca).observe(document.body, { childList: true });
  window.addEventListener('resize', aggiorna);
  cerca();
}

/* ================= Avvio ================= */
document.querySelectorAll('.lg').forEach((t) => t.addEventListener('click', () => vaiA(t.dataset.pagina)));
document.querySelectorAll('[data-torna]').forEach((b) => b.addEventListener('click', () => vaiA(PAGINE.includes(stato.pagina) ? stato.pagina : 'armadio')));
$('#btn-impost').addEventListener('click', () => vaiA('impostazioni'));
$('#btn-capo-nuovo').addEventListener('click', () => apriCapo());
$('#btn-outfit-nuovo').addEventListener('click', () => apriOutfit());
iniziaSfoglia();

async function avvia() {
  $('#versione').textContent = `Versione ${VERSIONE_APP}`;
  try {
    [stato.capi, stato.outfit, stato.foto] = await Promise.all([db.tutti('capi'), db.tutti('outfit'), db.tutti('foto')]);
    stato.codice = await db.leggiImp('codice_personale', '');
    stato.soglia = await db.leggiImp('soglia_giorni', 60);
    $('#codice-personale').value = stato.codice;
    $('#soglia-giorni').value = stato.soglia;
    db.chiediPersistenza();
  } catch (e) {
    console.error(e);
    stato.archivioOk = false;
  }
  vaiA('armadio', { porta: false });
  tieniLibereAzioni();
}
avvia();

document.addEventListener('visibilitychange', () => { if (!document.hidden) disegna(); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const aveva = Boolean(navigator.serviceWorker.controller);
  let ricaricato = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (aveva && !ricaricato) { ricaricato = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non attivo', e));
}

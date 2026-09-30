// Capi, outfit e regole contro lo spreco. Nessuno schermo qui.
export const CATEGORIE = ['Top e maglie', 'Camicie', 'Maglioni', 'Pantaloni', 'Gonne', 'Abiti', 'Giacche e cappotti', 'Scarpe', 'Borse', 'Accessori'];
export const STAGIONI = ['Primavera', 'Estate', 'Autunno', 'Inverno'];
export const OCCASIONI = ['Quotidiano', 'Lavoro', 'Sera', 'Sport', 'Cerimonia'];
/** Quando l'hai messo l'ultima volta (serve a capire cosa è fermo, appena aggiungi un capo vecchio). */
export const ULTIMO_USO = [
  { valore: 'nonso', etichetta: 'Non lo so', giorni: null },
  { valore: 'recente', etichetta: 'Di recente', giorni: 7 },
  { valore: 'mesi', etichetta: 'Da 1-3 mesi', giorni: 60 },
  { valore: 'tanto', etichetta: 'Da 6 mesi o più', giorni: 200 },
  { valore: 'mai', etichetta: 'Mai messo', giorni: null },
];

export function nuovoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const testo = (x, max = 200) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const soloDa = (x, ammessi) => (Array.isArray(x) ? x.filter((v) => ammessi.includes(v)) : []);

/** «bianco, blu navy» diventa ['bianco', 'blu navy']. */
export function parseLista(s, max = 4) {
  const parti = Array.isArray(s) ? s : String(s ?? '').split(/[,;\n]/);
  const viste = new Set();
  return parti.map((p) => testo(p, 30)).filter((p) => p && !viste.has(p.toLowerCase()) && viste.add(p.toLowerCase())).slice(0, max);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dataISO = (x) => (typeof x === 'string' && ISO.test(x) && !Number.isNaN(Date.parse(x)) ? x : null);

/** Giorni interi da `a` a `b` (entrambe YYYY-MM-DD). */
export function giorniTra(a, b) {
  const [y, m, g] = a.split('-').map(Number);
  const [y2, m2, g2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, g2) - Date.UTC(y, m - 1, g)) / 86400000);
}

export function sottraiGiorni(iso, n) {
  const [y, m, g] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, g - n)).toISOString().slice(0, 10);
}

/** Costruisce un capo completo e coerente da dati anche parziali. `oggi` serve per l'ultimo uso stimato. */
export function creaCapo(d = {}, { id, oggi } = {}) {
  const ultimo = ULTIMO_USO.find((u) => u.valore === d.ultimo_uso_scelta);
  const indossato = (Array.isArray(d.indossato) ? d.indossato : []).map(dataISO).filter(Boolean).sort();
  return {
    id: id || d.id || nuovoId(),
    nome: testo(d.nome, 80),
    categoria: CATEGORIE.includes(d.categoria) ? d.categoria : 'Accessori',
    colori: parseLista(d.colori),
    stagioni: soloDa(d.stagioni, STAGIONI),
    occasioni: soloDa(d.occasioni, OCCASIONI),
    marca: testo(d.marca, 60),
    note: testo(d.note, 300),
    foto: d.foto instanceof Blob ? d.foto : null,
    mini: d.mini instanceof Blob ? d.mini : null,
    aggiunto_il: dataISO(d.aggiunto_il) || oggi || new Date().toISOString().slice(0, 10),
    indossato,
    // ultimo uso dichiarato all'inizio (per i capi che hai già da tempo)
    ultimo_uso_scelta: ultimo ? ultimo.valore : (ULTIMO_USO.some((u) => u.valore === d.ultimo_uso_scelta) ? d.ultimo_uso_scelta : 'nonso'),
    ultimo_uso: dataISO(d.ultimo_uso) || (ultimo?.giorni && oggi ? sottraiGiorni(oggi, ultimo.giorni) : null),
    mai_messo: d.mai_messo === true || d.ultimo_uso_scelta === 'mai',
  };
}

export function erroriCapo(d) {
  return testo(d.nome, 80) ? [] : [{ campo: 'nome', messaggio: 'Scrivi il nome del capo.' }];
}

export function ultimoUso(capo) {
  const ultimoIndossato = capo.indossato.at(-1) || null;
  return ultimoIndossato || capo.ultimo_uso || null;
}

/** Giorni da quando l'hai messo l'ultima volta; null se non lo si sa o non l'hai mai messo. */
export function giorniDaUltimoUso(capo, oggi) {
  const u = ultimoUso(capo);
  return u ? Math.max(0, giorniTra(u, oggi)) : null;
}

export const volteIndossato = (x) => (x.indossato || []).length;

/** Capi fermi: mai messi, oppure non messi da almeno `soglia` giorni. I più fermi per primi. */
export function daRimettereInGioco(capi, oggi, soglia = 60) {
  return capi
    .map((c) => ({ capo: c, giorni: giorniDaUltimoUso(c, oggi), mai: c.mai_messo && !ultimoUso(c) }))
    .filter((x) => x.mai || (x.giorni !== null && x.giorni >= soglia))
    .sort((a, b) => (b.mai - a.mai) || ((b.giorni ?? 0) - (a.giorni ?? 0)))
    .map((x) => ({ ...x }));
}

export function segnaIndossato(x, oggi) {
  const lista = [...new Set([...(x.indossato || []), oggi])].sort();
  return { ...x, indossato: lista, mai_messo: false };
}

export function creaOutfit(d = {}, { id, oggi } = {}) {
  return {
    id: id || d.id || nuovoId(),
    nome: testo(d.nome, 80) || 'Outfit',
    capi: [...new Set(Array.isArray(d.capi) ? d.capi.filter((c) => typeof c === 'string') : [])].slice(0, 12),
    occasione: OCCASIONI.includes(d.occasione) ? d.occasione : '',
    note: testo(d.note, 400),
    creato_il: dataISO(d.creato_il) || oggi || new Date().toISOString().slice(0, 10),
    indossato: (Array.isArray(d.indossato) ? d.indossato : []).map(dataISO).filter(Boolean).sort(),
  };
}

/** Elenco dei capi per Claude. Solo testo: le foto restano sul telefono. */
export function elencoPerAI(capi, oggi) {
  return capi.map((c) => ({
    id: c.id, nome: c.nome, categoria: c.categoria, colori: c.colori, stagioni: c.stagioni, occasioni: c.occasioni,
    giorni_dall_uso: giorniDaUltimoUso(c, oggi), mai_messo: c.mai_messo && !ultimoUso(c),
  }));
}

const PAROLE_CATEGORIA = [
  ['Scarpe', /scarp|sneaker|stival|sandal|ballerin|d[ée]collet|mocassin|ciabatt|infradito|tacch|zoccol|anfibi/i],
  ['Borse', /borsa|zaino|pochette|tracolla|shopper|marsupio|valigia/i],
  ['Giacche e cappotti', /giacc|cappott|piumin|blazer|trench|parka|giubb|gilet|mantell|impermeabile|k-?way/i],
  ['Maglioni', /maglion|cardigan|pullover|dolcevita|lupetto|gilet in lana/i],
  ['Camicie', /camic|blusa/i],
  ['Pantaloni', /jeans|pantalon|leggings?|short|bermuda|tuta|jogger|salopette|palazzo/i],
  ['Gonne', /gonna|minigonna|longuette|pantagonna/i],
  ['Abiti', /abito|vestit|tubino|chemisier|tuta intera|jumpsuit|completo/i],
  ['Top e maglie', /magliett|t-?shirt|top\b|canott|felpa|body|polo|maglia|smanicato|crop/i],
];

/** Indovina il tipo dal nome, senza Claude. Se non capisce, «Accessori». */
export function indovinaCategoria(nome) {
  return PAROLE_CATEGORIA.find(([, re]) => re.test(nome))?.[0] || 'Accessori';
}

const COLORI_NOTI = ['bianco', 'bianca', 'bianchi', 'bianche', 'nero', 'nera', 'neri', 'nere', 'blu', 'azzurro', 'azzurra', 'rosso', 'rossa', 'verde', 'giallo', 'gialla', 'rosa', 'beige', 'grigio', 'grigia', 'marrone', 'viola', 'arancione', 'oro', 'argento', 'panna', 'cammello', 'bordeaux', 'denim'];

/** Divide un elenco scritto a parole (una riga o virgole) in capi semplici. */
export function dividiElenco(testoElenco, max = 60) {
  const pezzi = String(testoElenco ?? '').split(/[\n,;]+|\se\s(?=\d)/).map((s) => s.trim().replace(/^[-•*]+\s*/, '').replace(/^\d{1,2}[.)]\s+/, '').trim()).filter((s) => s.length > 1);
  const capi = [];
  for (const p of pezzi) {
    const q = p.match(/^(\d{1,2})\s+(.+)$/);
    const n = Math.min(q ? Number(q[1]) : 1, 6);
    const nomeGrezzo = (q ? q[2] : p).trim();
    const nome = nomeGrezzo.charAt(0).toUpperCase() + nomeGrezzo.slice(1);
    const colori = COLORI_NOTI.filter((c) => new RegExp(`\\b${c}\\b`, 'i').test(nomeGrezzo)).slice(0, 2);
    for (let i = 0; i < n && capi.length < max; i++) capi.push({ nome: nome.slice(0, 80), categoria: indovinaCategoria(nomeGrezzo), colori, stagioni: [], occasioni: [] });
  }
  return capi;
}

// Archivio sul telefono (IndexedDB). Le foto restano qui e non vanno da nessuna parte se non tocchi un tasto di aiuto.
const NOME = 'armadio';
const VERSIONE = 1;
const STORE = ['capi', 'outfit', 'foto', 'impostazioni'];
let aperto = null;

function apri() {
  if (aperto) return aperto;
  aperto = new Promise((ok, no) => {
    if (!('indexedDB' in globalThis)) return no(new Error('archivio-non-disponibile'));
    const r = indexedDB.open(NOME, VERSIONE);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of STORE) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, s === 'impostazioni' ? undefined : { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error || new Error('archivio-non-disponibile'));
    r.onblocked = () => no(new Error('archivio-bloccato'));
  }).catch((e) => { aperto = null; throw e; });
  return aperto;
}

async function esegui(store, modo, fn) {
  const d = await apri();
  return new Promise((ok, no) => {
    const t = d.transaction(store, modo);
    let risultato;
    try { risultato = fn(t.objectStore(store), t); } catch (e) { no(e); return; }
    t.oncomplete = () => ok(risultato && 'result' in risultato ? risultato.result : undefined);
    t.onerror = () => no(t.error);
    t.onabort = () => no(t.error || new Error('operazione-annullata'));
  });
}

export const tutti = (store) => esegui(store, 'readonly', (s) => s.getAll());
export const salva = (store, oggetto) => esegui(store, 'readwrite', (s) => { s.put(oggetto); });
export const elimina = (store, id) => esegui(store, 'readwrite', (s) => { s.delete(id); });
export const sostituisciTutti = (store, lista) => esegui(store, 'readwrite', (s) => { s.clear(); lista.forEach((o) => s.put(o)); });
export const svuota = (store) => esegui(store, 'readwrite', (s) => { s.clear(); });

export async function leggiImp(chiave, predefinito = null) {
  const v = await esegui('impostazioni', 'readonly', (s) => s.get(chiave));
  return v === undefined ? predefinito : v;
}
export const scriviImp = (chiave, valore) => esegui('impostazioni', 'readwrite', (s) => { s.put(valore, chiave); });

/** Chiede a iOS di non cancellare i dati quando lo spazio scarseggia. Non è garantito. */
export async function chiediPersistenza() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

// Le richieste a Claude passano dalla funzione su Netlify (la stessa dell'app della cucina, con lo stesso codice): la chiave non è mai nell'app.
const INDIRIZZO = globalThis.ARMADIO_API || 'https://lidia-cooking-code.netlify.app/api/armadio';
const TESTI = {
  404: 'La funzione non è ancora attiva su questo indirizzo. Serve pubblicarla su Netlify.',
  401: 'Il codice personale non è giusto. Controllalo nelle Impostazioni.',
  503: 'La funzione non è ancora collegata a Claude: manca la chiave su Netlify.',
};

/** Ritorna { ok: true, risposta } oppure { ok: false, errore, tipo }. */
export async function chiediAI(corpo, codice, { fetchImpl = globalThis.fetch, timeoutMs = 65000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r;
  try {
    r = await fetchImpl(INDIRIZZO, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', 'x-codice': codice || '' }, body: JSON.stringify(corpo) });
  } catch (e) {
    return { ok: false, errore: e?.name === 'AbortError' ? 'Ci sta mettendo troppo. Riprova con meno foto.' : 'Non riesco a collegarmi. Controlla la connessione e riprova.', tipo: 'rete' };
  } finally {
    clearTimeout(timer);
  }
  let j = null;
  try { j = await r.json(); } catch { /* risposta senza contenuto leggibile */ }
  if (r.ok && j && !j.errore) return { ok: true, risposta: j };
  return { ok: false, errore: j?.errore || TESTI[r.status] || 'Qualcosa non ha funzionato. Riprova.', tipo: j?.tipo || String(r.status) };
}

// Giorni rimasti e stati di scadenza. Nessun accesso al DOM: si prova con `npm test`.

const MS_GIORNO = 86400000;

/** Data di oggi come AAAA-MM-GG, nel fuso orario del telefono. */
export function oggiISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}

function aUTC(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, g] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, g);
  const d = new Date(t);
  // scarta date impossibili come 2026-02-31
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== g) return null;
  return t;
}

export function dataValida(iso) {
  return aUTC(iso) !== null;
}

/** Giorni da oggi alla scadenza: negativo se scaduto, null se non c'è una data valida. */
export function giorniRimasti(scadenza, oggi = oggiISO()) {
  const a = aUTC(scadenza);
  const b = aUTC(oggi);
  if (a === null || b === null) return null;
  return Math.round((a - b) / MS_GIORNO);
}

function giorniTesto(n) {
  return n === 1 ? '1 giorno' : `${n} giorni`;
}

/**
 * Stato di un prodotto. `codice` è uno tra: scaduto, oggi, entro3, ok, senza.
 * Lo stato ha sempre un testo: non dipende mai solo dal colore.
 */
export function statoScadenza(prodotto, oggi = oggiISO()) {
  const giorni = giorniRimasti(prodotto?.scadenza, oggi);
  const qualita = prodotto?.tipo_scadenza === 'preferibilmente';

  if (giorni === null) {
    return { codice: 'senza', giorni: null, qualita, etichetta: 'Senza scadenza', dettaglio: '' };
  }
  if (giorni < 0) {
    const passati = -giorni;
    if (qualita) {
      return {
        codice: 'scaduto', giorni, qualita,
        etichetta: passati === 1 ? 'Data di qualità passata ieri' : `Data di qualità passata da ${giorniTesto(passati)}`,
        dettaglio: 'Controlla il prodotto prima di usarlo.',
      };
    }
    return {
      codice: 'scaduto', giorni, qualita,
      etichetta: passati === 1 ? 'Scaduto ieri' : `Scaduto da ${giorniTesto(passati)}`,
      dettaglio: '',
    };
  }
  if (giorni === 0) return { codice: 'oggi', giorni, qualita, etichetta: 'Scade oggi', dettaglio: '' };
  if (giorni <= 3) {
    return {
      codice: 'entro3', giorni, qualita,
      etichetta: giorni === 1 ? 'Scade domani' : `Scade tra ${giorniTesto(giorni)}`,
      dettaglio: '',
    };
  }
  return { codice: 'ok', giorni, qualita, etichetta: `Tra ${giorniTesto(giorni)}`, dettaglio: '' };
}

/** Ordina per giorni rimasti (meno giorni prima); senza scadenza in fondo; a parità, per nome. */
export function ordinaPerScadenza(prodotti, oggi = oggiISO()) {
  return [...prodotti].sort((a, b) => {
    const ga = giorniRimasti(a.scadenza, oggi);
    const gb = giorniRimasti(b.scadenza, oggi);
    if (ga === null && gb === null) return (a.nome || '').localeCompare(b.nome || '', 'it');
    if (ga === null) return 1;
    if (gb === null) return -1;
    if (ga !== gb) return ga - gb;
    return (a.nome || '').localeCompare(b.nome || '', 'it');
  });
}

/** Numeri del riepilogo in alto. `entro3` comprende anche chi scade oggi. */
export function riepilogo(prodotti, oggi = oggiISO()) {
  let scaduti = 0;
  let entro3 = 0;
  for (const p of prodotti) {
    const { codice } = statoScadenza(p, oggi);
    if (codice === 'scaduto') scaduti++;
    else if (codice === 'oggi' || codice === 'entro3') entro3++;
  }
  return { scaduti, entro3, totale: prodotti.length };
}

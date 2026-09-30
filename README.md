# Armadio

Tutto quello che hai nell'armadio, gli abbinamenti e gli outfit, per non sprecare niente.

- I capi si aggiungono **scrivendo l'elenco** (niente foto obbligatorie). Le foto sono facoltative.
- Capi fermi: ti dice cosa non metti da tempo.
- Outfit: a mano, oppure suggeriti da Claude partendo dai capi fermi.
- Io: una o due tue foto e un parere di stile sugli outfit. Non disegna te vestita con il capo.

Capi e foto restano **solo sul telefono** (IndexedDB). Vanno a Claude solo quando tocchi un tasto di aiuto.

## Come funziona

App statica (JS semplice, senza build), pubblicata con GitHub Pages. Gli aiuti di Claude passano dalla funzione
`/api/armadio` del sito della cucina (`lidia-cooking-code.netlify.app`): stessa chiave, stesso codice personale.
Il codice della funzione sta nel progetto della cucina (`netlify/functions/armadio*.mjs`).

Prove: `npm test`. Provarla sul computer: `npm run serve`.

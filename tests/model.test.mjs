import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creaCapo, creaOutfit, erroriCapo, giorniTra, sottraiGiorni, giorniDaUltimoUso, daRimettereInGioco, segnaIndossato,
  parseLista, indovinaCategoria, dividiElenco, elencoPerAI,
} from '../js/model.js';

const OGGI = '2026-09-30';

test('capo: valori strani diventano valori sicuri; il nome è obbligatorio', () => {
  const c = creaCapo({ nome: '  Camicia  ', categoria: 'Boh', colori: 'bianco, Bianco, blu navy;;rosso', stagioni: ['Estate', 'Marte'], occasioni: ['Lavoro', 'x'] }, { oggi: OGGI });
  assert.equal(c.nome, 'Camicia');
  assert.equal(c.categoria, 'Accessori');
  assert.deepEqual(c.colori, ['bianco', 'blu navy', 'rosso']);
  assert.deepEqual(c.stagioni, ['Estate']);
  assert.deepEqual(c.occasioni, ['Lavoro']);
  assert.equal(c.aggiunto_il, OGGI);
  assert.equal(erroriCapo({ nome: ' ' }).length, 1);
  assert.equal(erroriCapo({ nome: 'x' }).length, 0);
});

test('date: differenze e sottrazioni anche a cavallo del mese', () => {
  assert.equal(giorniTra('2026-09-01', '2026-09-30'), 29);
  assert.equal(giorniTra('2026-08-31', '2026-09-01'), 1);
  assert.equal(sottraiGiorni('2026-09-30', 60), '2026-08-01');
});

test('ultimo uso: dichiarato all\'inizio, poi aggiornato quando lo metti', () => {
  const vecchio = creaCapo({ nome: 'Giacca', ultimo_uso_scelta: 'tanto' }, { oggi: OGGI });
  assert.equal(giorniDaUltimoUso(vecchio, OGGI), 200);
  const recente = creaCapo({ nome: 'Top', ultimo_uso_scelta: 'recente' }, { oggi: OGGI });
  assert.equal(giorniDaUltimoUso(recente, OGGI), 7);
  const ignoto = creaCapo({ nome: 'Gonna' }, { oggi: OGGI });
  assert.equal(giorniDaUltimoUso(ignoto, OGGI), null);
  const messo = segnaIndossato(vecchio, OGGI);
  assert.equal(giorniDaUltimoUso(messo, OGGI), 0);
  assert.deepEqual(segnaIndossato(messo, OGGI).indossato, [OGGI], 'due volte lo stesso giorno conta una volta');
});

test('capi fermi: mai messi e non messi da tempo, i più fermi per primi; quelli che non si sa non contano', () => {
  const capi = [
    creaCapo({ nome: 'Recente', ultimo_uso_scelta: 'recente' }, { oggi: OGGI }),
    creaCapo({ nome: 'Fermo 200', ultimo_uso_scelta: 'tanto' }, { oggi: OGGI }),
    creaCapo({ nome: 'Fermo 60', ultimo_uso_scelta: 'mesi' }, { oggi: OGGI }),
    creaCapo({ nome: 'Mai', ultimo_uso_scelta: 'mai' }, { oggi: OGGI }),
    creaCapo({ nome: 'Non so' }, { oggi: OGGI }),
  ];
  assert.deepEqual(daRimettereInGioco(capi, OGGI, 60).map((x) => x.capo.nome), ['Mai', 'Fermo 200', 'Fermo 60']);
  assert.deepEqual(daRimettereInGioco(capi, OGGI, 100).map((x) => x.capo.nome), ['Mai', 'Fermo 200']);
});

test('outfit: nome di riserva, capi senza doppioni, occasione valida', () => {
  const o = creaOutfit({ nome: '', capi: ['a', 'a', 'b', 5], occasione: 'Boh' }, { oggi: OGGI });
  assert.equal(o.nome, 'Outfit');
  assert.deepEqual(o.capi, ['a', 'b']);
  assert.equal(o.occasione, '');
});

test('elenco a parole senza Claude: tipi indovinati, quantità, colori', () => {
  assert.equal(indovinaCategoria('Jeans blu'), 'Pantaloni');
  assert.equal(indovinaCategoria('sneakers bianche'), 'Scarpe');
  assert.equal(indovinaCategoria('blazer nero'), 'Giacche e cappotti');
  assert.equal(indovinaCategoria('maglione di lana'), 'Maglioni');
  assert.equal(indovinaCategoria('t-shirt'), 'Top e maglie');
  assert.equal(indovinaCategoria('cintura'), 'Accessori');
  const capi = dividiElenco('jeans blu, 3 magliette bianche\n- camicia a righe; borsa marrone');
  assert.equal(capi.length, 6);
  assert.equal(capi[0].nome, 'Jeans blu');
  assert.deepEqual(capi[0].colori, ['blu']);
  assert.equal(capi.filter((c) => c.nome === 'Magliette bianche').length, 3);
  assert.equal(capi.at(-1).categoria, 'Borse');
  assert.equal(dividiElenco('').length, 0);
  assert.equal(dividiElenco('20 calzini').length, 6, 'al massimo 6 per voce');
});

test('elenco per Claude: solo testo; «mai messo» distinto da «non si sa»', () => {
  const lista = elencoPerAI([creaCapo({ id: 'a', nome: 'Mai', ultimo_uso_scelta: 'mai' }, { oggi: OGGI }), creaCapo({ id: 'b', nome: 'Ignoto' }, { oggi: OGGI })], OGGI);
  assert.equal(lista[0].mai_messo, true);
  assert.equal(lista[1].mai_messo, false);
  assert.ok(lista.every((x) => !('foto' in x) && !('mini' in x)));
  assert.deepEqual(parseLista('a, b'), ['a', 'b']);
});

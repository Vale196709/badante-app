import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numeroScatti, prossimoScatto, quotaScatti, calcolaCedolino, inizioAnzianitaScatti } from '../src/engine/calcolo.js';

const muoara = { livello: 'B', tipologia: 'ore', pagaOraria: 9, orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, dataAssunzione: '2026-10-01', tipoContratto: 'indeterminato', cuaf: true, cassaColf: true };

test('scatti: decorrenza dal mese successivo all\'assunzione', () => {
  assert.equal(inizioAnzianitaScatti('2026-10-01'), '2026-10-01');
  assert.equal(inizioAnzianitaScatti('2021-03-26'), '2021-04-01');
  assert.equal(inizioAnzianitaScatti('2025-12-15'), '2026-01-01');
  // esempio del CCNL: assunta il 26/3/2021, primo scatto dal 1/4/2023
  const r = { ...muoara, dataAssunzione: '2021-03-26' };
  assert.equal(numeroScatti(r, 2023, 3), 0);
  assert.equal(numeroScatti(r, 2023, 4), 1);
});

test('scatti: uno ogni due anni, massimo sette', () => {
  assert.equal(numeroScatti(muoara, 2028, 9), 0);
  assert.equal(numeroScatti(muoara, 2028, 10), 1);
  assert.equal(numeroScatti(muoara, 2030, 10), 2);
  assert.equal(numeroScatti(muoara, 2050, 1), 7);
  assert.equal(numeroScatti({ ...muoara, scattiAnzianita: false }, 2040, 1), 0);
  assert.deepEqual(prossimoScatto(muoara, '2026-11-01'), { numero: 1, data: '2028-10-01' });
  assert.equal(prossimoScatto(muoara, '2050-01-01'), null);
});

test('scatti: 4% del minimo, sommati alla paga concordata', () => {
  const q = quotaScatti(muoara, 2028, 10); // minimo B 7,01 (tabelle 2026)
  assert.equal(q.quota, 0.28);
  const c = calcolaCedolino(muoara, { anno: 2028, mese: 10 });
  assert.equal(c.voci.find((v) => v.codice === 'ORD').tariffa, 9.28);
  assert.deepEqual(c.scatti, { numero: 1, quota: 0.28, mensile: false });
  assert.ok(c.avvisi.some((a) => /1° scatto di anzianità/.test(a)));
  // il mese dopo niente avviso, la paga resta aumentata
  const n = calcolaCedolino(muoara, { anno: 2028, mese: 11 });
  assert.ok(!n.avvisi.some((a) => /scatto/.test(a)));
  // nessun falso allarme sul minimo
  assert.ok(!c.avvisi.some((a) => /sotto il minimo/.test(a)));
});

test('scatti: convivente, quota mensile senza indennità di funzione', () => {
  const r = { livello: 'D', tipologia: 'convivente', pagaMensile: 1700, orario: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9 }, dataAssunzione: '2020-01-01', cassaColf: true };
  const q = quotaScatti(r, 2026, 1); // 3 scatti × 4% × 1.404,51
  assert.equal(q.numero, 3);
  assert.equal(q.quota, 168.54);
  const c = calcolaCedolino(r, { anno: 2026, mese: 3 });
  assert.equal(c.voci.find((v) => v.codice === 'MEN').importo, 1868.54);
});

import { orePermessiAnnue, saldoPermessi } from '../src/engine/annuale.js';
import { calcolaCatena } from '../src/engine/catena.js';

test('permessi retribuiti: ore annue per tipo di rapporto', () => {
  assert.equal(orePermessiAnnue(muoara), 6); // 15 h su 30 → 6 ore
  assert.equal(orePermessiAnnue({ ...muoara, orario: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6 } }), 12);
  assert.equal(orePermessiAnnue({ tipologia: 'convivente', orario: {} }), 16);
  assert.equal(orePermessiAnnue({ tipologia: 'conviventePT', orario: {} }), 12);
});

test('permessi retribuiti: proporzione nell\'anno di assunzione e ore usate', () => {
  const ced = [{ anno: 2026, mese: 12, stato: 'bozza', presenze: { giorni: { '2026-12-22': { tipo: 'P', ore: 2 } }, extra: {} } }];
  const cat = calcolaCatena(muoara, ced, { anno: 2026, mese: 12 });
  const s = saldoPermessi(muoara, cat, 2026); // ottobre-dicembre: 3/12 di 6 ore
  assert.deepEqual(s, { annue: 6, spettanti: 1.5, usate: 2, residue: -0.5, mensile: false });
  assert.equal(saldoPermessi(muoara, cat, 2027).spettanti, 6);
});

import { generaScadenze } from '../src/engine/scadenze.js';

test('scadenze: documenti della persona assistita e rinnovo ISEE', () => {
  const r = { ...muoara, agevolazioni: { prestazioneUniversale: true }, documentiAssistito: { certificatoNonAutosufficienza: '2027-05-31', altroNome: 'Carta d\'identità', altroData: '2027-03-01' } };
  const cat = calcolaCatena(r, [], { anno: 2026, mese: 11 });
  const sc = generaScadenze(r, cat, '2026-11-01');
  const cert = sc.find((s) => s.chiave === 'docass-certificatoNonAutosufficienza-2027-05-31');
  assert.equal(cert.data, '2027-04-01');
  assert.ok(sc.find((s) => s.titolo === 'Rinnovo: Carta d\'identità'));
  assert.equal(sc.find((s) => s.chiave === 'isee-2027').data, '2027-01-15');
  const scatto = sc.find((s) => s.chiave === 'scatto-2028-10-01');
  assert.ok(scatto && scatto.informativa);
});

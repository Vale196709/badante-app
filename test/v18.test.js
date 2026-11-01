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

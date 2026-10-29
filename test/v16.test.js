import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcolaCatena } from '../src/engine/catena.js';
import { calcolaCedolino, fasciaContributiva } from '../src/engine/calcolo.js';
import { generaScadenze } from '../src/engine/scadenze.js';
import { verificaAgevolazioni } from '../src/engine/annuale.js';
import { presenzeDaGiorni } from '../src/engine/presenze.js';

const r = {
  livello: 'B', orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, dataAssunzione: '2026-10-01',
  tipoContratto: 'indeterminato', cuaf: true, cassaColf: true, tredicesimaMensile: false, pagaOraria: 9,
};

test('sostituzione: contratto a termine senza contributo aggiuntivo', () => {
  const td = fasciaContributiva({ ...r, tipoContratto: 'determinato' }, 2026);
  const sost = fasciaContributiva({ ...r, tipoContratto: 'determinato', sostituzione: true }, 2026);
  assert.equal(td.totaleOrario, 2.05);
  assert.equal(sost.totaleOrario, 1.92);
});

test('prestazione universale: rendiconti trimestrali fino al 31/12/2026', () => {
  const rr = { ...r, agevolazioni: { prestazioneUniversale: true } };
  const cat = calcolaCatena(rr, [], { anno: 2027, mese: 6 });
  const pu = generaScadenze(rr, cat, '2026-10-29').filter((s) => s.chiave.startsWith('pu-'));
  assert.deepEqual(pu.map((s) => [s.chiave, s.data]), [['pu-2026-T4', '2027-01-10']]);
  assert.equal(generaScadenze(r, cat, '2026-10-29').filter((s) => s.chiave.startsWith('pu-')).length, 0);
});

test('verifica agevolazioni', () => {
  const v0 = verificaAgevolazioni(r, '2026-10-29');
  assert.equal(v0.find((x) => x.chiave === 'pu').esito, 'no');
  assert.equal(v0.find((x) => x.chiave === 'esonero').esito, 'no');
  assert.equal(v0.find((x) => x.chiave === 'deduzione').esito, 'si');
  const v1 = verificaAgevolazioni({ ...r, agevolazioni: { over80: true, accompagnamento: true, iseeEntroLimite: true } }, '2026-10-29');
  assert.equal(v1.find((x) => x.chiave === 'pu').esito, 'forse');
  const v2 = verificaAgevolazioni({ ...r, agevolazioni: { prestazioneUniversale: true } }, '2026-10-29');
  assert.equal(v2.find((x) => x.chiave === 'pu').esito, 'si');
  assert.doesNotMatch(v2.find((x) => x.chiave === 'pu').testo, /almeno 15 ore/); // 15 h: requisito rispettato
  const v3 = verificaAgevolazioni({ ...r, orario: { 1: 2, 2: 2 }, agevolazioni: { prestazioneUniversale: true } }, '2026-10-29');
  assert.match(v3.find((x) => x.chiave === 'pu').testo, /almeno 15 ore/);
});

test('ore segnate approvate: giornata con più ore diventa ore aggiuntive', () => {
  const p = presenzeDaGiorni(r, 2026, 11, { '2026-11-03': { tipo: 'L', ore: 5 }, '2026-11-04': { tipo: 'A', ore: 0 } });
  assert.equal(p.oreAggiuntive, 2);
  const c = calcolaCedolino(r, p);
  assert.ok(c.voci.some((v) => v.codice === 'AGG' && v.quantita === 2));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcolaCatena } from '../src/engine/catena.js';
import { percorsoMese, scadenzeDaFare, prossimaCosa, percorsoFerie, percorsoMalattia, percorsoFine } from '../src/engine/workflow.js';

const r = {
  livello: 'B', orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, dataAssunzione: '2026-09-01',
  tipoContratto: 'indeterminato', cuaf: true, cassaColf: true, tredicesimaMensile: false, pagaOraria: 9,
  lavoratrice: { nome: 'Muoara' },
};
const stati = (p) => p.passi.map((x) => x.stato);

// cedolino salvato con il risultato calcolato
function cedolino(anno, mese, stato, extra = {}) {
  const cat = calcolaCatena(r, [], { anno, mese });
  return { id: `c${mese}`, anno, mese, stato, presenze: { giorni: {}, extra: {} }, risultato: cat[cat.length - 1].risultato, ...extra };
}

test('percorso del mese: segue il primo mese non pagato', () => {
  const ced = [cedolino(2026, 9, 'confermato')];
  const cat = calcolaCatena(r, ced, { anno: 2026, mese: 10 });
  const p = percorsoMese(r, cat, { oggi: '2026-10-30' });
  assert.equal(p.titolo, 'Settembre 2026');
  assert.deepEqual(stati(p), ['fatto', 'fatto', 'ritardo', 'ora']);
  assert.equal(p.passi[2].azione.tipo, 'bonifico');
});

test('percorso del mese: mese in corso, ore da approvare, poi conferma', () => {
  const ced = [cedolino(2026, 9, 'pagato', { pagato_at: '2026-09-30', ricevuta_at: '2026-10-01' })];
  const cat = calcolaCatena(r, ced, { anno: 2026, mese: 10 });
  const inizio = percorsoMese(r, cat, { oggi: '2026-10-10' });
  assert.equal(inizio.titolo, 'Ottobre 2026');
  assert.deepEqual(stati(inizio), ['corso', 'attesa', 'attesa', 'attesa']);
  const ore = [{ data: '2026-10-29', ore: 3, stato: 'in attesa' }];
  assert.deepEqual(stati(percorsoMese(r, cat, { ore, oggi: '2026-10-30' })), ['ora', 'attesa', 'attesa', 'attesa']);
  const approvate = [{ data: '2026-10-29', ore: 3, stato: 'approvata' }];
  const p = percorsoMese(r, cat, { ore: approvate, oggi: '2026-10-30' });
  assert.deepEqual(stati(p), ['fatto', 'ora', 'attesa', 'attesa']);
  assert.match(p.passi[1].dettaglio, /31\/10\/2026/);
});

test('firma su carta segnata a mano e mesi senza firma', () => {
  const ced = [cedolino(2026, 9, 'pagato'), cedolino(2026, 10, 'pagato')];
  const cat = calcolaCatena(r, ced, { anno: 2026, mese: 10 });
  const p = percorsoMese(r, cat, { oggi: '2026-10-31' });
  assert.equal(p.titolo, 'Ottobre 2026');
  assert.equal(p.passi[3].stato, 'ora');
  assert.equal(p.passi[3].manuale, 'wf-firma-2026-10');
  assert.deepEqual(p.senzaFirma.map((x) => x.chiave), ['wf-firma-2026-09']);
  const fatte = new Set(['wf-firma-2026-10', 'wf-firma-2026-09']);
  const p2 = percorsoMese(r, cat, { fatte, oggi: '2026-10-31' });
  assert.deepEqual(stati(p2), ['fatto', 'fatto', 'fatto', 'fatto']);
  assert.equal(p2.senzaFirma.length, 0);
});

test('scadenze da fare e prossima cosa', () => {
  const cat = calcolaCatena(r, [cedolino(2026, 9, 'pagato')], { anno: 2026, mese: 10 });
  const sc = scadenzeDaFare(r, cat, { oggi: '2026-10-30' });
  assert.ok(sc.every((s) => !s.chiave.startsWith('stipendio-')));
  assert.equal(sc.find((s) => s.chiave === 'inps-2026-T3').stato, 'ritardo');
  const prossima = prossimaCosa(percorsoMese(r, cat, { oggi: '2026-10-30' }), sc);
  assert.equal(prossima.stato, 'ritardo');
  assert.match(prossima.titolo, /Contributi INPS 3° trimestre 2026/);
});

test('percorso ferie segue la richiesta', () => {
  const cat = calcolaCatena(r, [], { anno: 2026, mese: 10 });
  assert.deepEqual(stati(percorsoFerie(r, cat, { oggi: '2026-10-30' })), ['ora', 'attesa', 'attesa', 'attesa', 'attesa']);
  const richieste = [{ id: 'x', tipo: 'F', dal: '2026-12-21', al: '2026-12-31', stato: 'in attesa' }];
  const p = percorsoFerie(r, cat, { richieste, oggi: '2026-10-30' });
  assert.equal(p.titolo, 'Ferie dal 21/12/2026 al 31/12/2026');
  assert.deepEqual(stati(p), ['fatto', 'ora', 'ora', 'attesa', 'attesa']);
  const ok = percorsoFerie(r, cat, { richieste: [{ ...richieste[0], stato: 'approvata' }], oggi: '2026-10-30' });
  assert.deepEqual(stati(ok), ['fatto', 'fatto', 'fatto', 'ora', 'fatto']);
});

test('percorso malattia riconosce i giorni segnati', () => {
  const giorni = { '2026-10-26': { tipo: 'M' }, '2026-10-27': { tipo: 'M' } };
  const ced = [{ ...cedolino(2026, 10, 'bozza'), presenze: { giorni, extra: {} } }];
  const cat = calcolaCatena(r, ced, { anno: 2026, mese: 10 });
  const p = percorsoMalattia(r, cat, { oggi: '2026-10-30' });
  assert.equal(p.titolo, 'Malattia dal 26/10/2026');
  assert.deepEqual(stati(p), ['ora', 'fatto', 'ora', 'fatto']);
  assert.match(p.passi[3].dettaglio, /2 giorni di malattia nell'anno su 8 pagati/);
});

test('percorso fine rapporto: preavviso e comunicazione INPS', () => {
  const cat = calcolaCatena(r, [], { anno: 2026, mese: 10 });
  const p = percorsoFine(r, cat, { oggi: '2026-10-30' });
  assert.match(p.passi[0].dettaglio, /8 giorni se licenzi, 4 se si dimette/);
  const rc = { ...r, dataCessazione: '2026-11-15' };
  const pc = percorsoFine(rc, calcolaCatena(rc, [], { anno: 2026, mese: 11 }), { oggi: '2026-11-22' });
  assert.equal(pc.passi.find((x) => x.id === 'inps').stato, 'ritardo');
  assert.equal(pc.passi.find((x) => x.id === 'data').stato, 'fatto');
});

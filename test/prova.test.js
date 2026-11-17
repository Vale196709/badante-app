import { test } from 'node:test';
import assert from 'node:assert/strict';
import { giorniProvaCcnl, finePeriodoProva } from '../src/engine/prova.js';
import { giorniPreavviso } from '../src/engine/cessazione.js';

const muoara = { livello: 'B', tipologia: 'ore', pagaOraria: 9, orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, dataAssunzione: '2027-01-01', giorniProva: 8, tipoContratto: 'indeterminato' };

test('prova: 30 giorni per conviventi e livelli D/DS, 8 per gli altri', () => {
  assert.equal(giorniProvaCcnl({ tipologia: 'ore', livello: 'B' }), 8);
  assert.equal(giorniProvaCcnl({ tipologia: 'ore', livello: 'C' }), 8);
  assert.equal(giorniProvaCcnl({ tipologia: 'ore', livello: 'D' }), 30);
  assert.equal(giorniProvaCcnl({ tipologia: 'ore', livello: 'DS' }), 30);
  assert.equal(giorniProvaCcnl({ tipologia: 'convivente', livello: 'B' }), 30);
  assert.equal(giorniProvaCcnl({ tipologia: 'conviventePT', livello: 'B' }), 30);
});

test('prova: fine in giorni di lavoro effettivo, esclusi i festivi', () => {
  // 1/1 (Capodanno) e 6/1 (Epifania) sono festivi: lavorati 4, 5, 7, 8, 11, 12, 13, 14 gennaio 2027
  assert.equal(finePeriodoProva(muoara), '2027-01-14');
  assert.equal(finePeriodoProva({ ...muoara, giorniProva: 0 }), null);
  assert.equal(finePeriodoProva({ ...muoara, dataAssunzione: '' }), null);
});

test('prova: nessun preavviso durante la prova, poi si applica', () => {
  assert.equal(giorniPreavviso(muoara, '2027-01-10', 'licenziamento'), 0);
  assert.equal(giorniPreavviso(muoara, '2027-01-14', 'dimissioni'), 0);
  assert.equal(giorniPreavviso(muoara, '2027-01-15', 'licenziamento'), 8);
  assert.equal(giorniPreavviso(muoara, '2027-01-15', 'dimissioni'), 4);
});

test('santo patrono: festività retribuita se impostata (CCNL art. 16)', async () => {
  const { calendarioMese, calcolaCedolino } = await import('../src/engine/calcolo.js');
  const r = { ...muoara, santoPatrono: '06-29', dataAssunzione: '2026-01-01' };
  const giorno = calendarioMese(r, 2027, 6).find((g) => g.data === '2027-06-29');
  assert.equal(giorno.festivita, true);
  assert.equal(calendarioMese({ ...r, santoPatrono: '' }, 2027, 6).find((g) => g.data === '2027-06-29').festivita, false);
  // 15 ore settimanali: 1/6 = 2,5 ore in più per la festività
  const con = calcolaCedolino({ ...r, cuaf: true, cassaColf: true }, { anno: 2027, mese: 6 }, {});
  const senza = calcolaCedolino({ ...r, santoPatrono: '', cuaf: true, cassaColf: true }, { anno: 2027, mese: 6 }, {});
  const fes = (c) => c.voci.find((v) => v.codice === 'FES')?.quantita || 0;
  assert.equal(Math.round((fes(con) - fes(senza)) * 100) / 100, 2.5);
});

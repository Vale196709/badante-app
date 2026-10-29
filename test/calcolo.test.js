import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcolaCedolino, simulaCosto, fasciaContributiva, orePreviste, mesiAnzianita,
} from '../src/engine/calcolo.js';

const base = {
  livello: 'B',
  orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, // lun-ven 3 ore
  dataAssunzione: '2026-10-01',
  tipoContratto: 'indeterminato',
  cuaf: true,
  cassaColf: true,
  tredicesimaMensile: false,
};
const r9 = { ...base, pagaOraria: 9 };
const r8 = { ...base, pagaOraria: 8 };

test('fascia contributiva usa paga + 1/12 di tredicesima', () => {
  // 8 €/h → 8,67 effettiva → fascia 1
  const f8 = fasciaContributiva(r8, 2026);
  assert.equal(f8.retribuzioneEffettiva, 8.67);
  assert.equal(f8.totaleOrario, 1.70);
  assert.equal(f8.lavoratoreOrario, 0.43);
  assert.equal(f8.datoreOrario, 1.27);
  // 9 €/h → 9,75 effettiva → fascia 2
  const f9 = fasciaContributiva(r9, 2026);
  assert.equal(f9.retribuzioneEffettiva, 9.75);
  assert.equal(f9.totaleOrario, 1.92);
  assert.equal(f9.lavoratoreOrario, 0.48);
  assert.equal(f9.datoreOrario, 1.44);
});

test('oltre 24 ore settimanali: contributo fisso', () => {
  const f = fasciaContributiva({ ...r9, orario: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 } }, 2026);
  assert.equal(f.totaleOrario, 1.24);
});

test('ore previste dei mesi', () => {
  assert.equal(orePreviste(r9, 2026, 10), 66); // 22 giorni feriali
  assert.equal(orePreviste(r9, 2026, 11), 63); // 21 giorni
  assert.equal(orePreviste(r9, 2026, 12), 63); // 23 feriali meno 8 e 25 dicembre
});

test('ottobre 2026 a 9 €/h', () => {
  const c = calcolaCedolino(r9, { anno: 2026, mese: 10 });
  // 66 h ordinarie = 594; festività 4/10 (domenica) = 2,5 h = 22,50
  assert.equal(c.lordo, 616.5);
  assert.equal(c.contributi.oreContributive, 68.5);
  assert.equal(c.contributi.inpsLavoratore, 32.88); // 68,5 × 0,48
  assert.equal(c.contributi.inpsDatore, 98.64);     // 68,5 × 1,44
  assert.equal(c.trattenute[1].importo, 1.37);      // Cassa Colf 68,5 × 0,02
  assert.equal(c.netto, 582.25);
  assert.equal(c.accantonamenti.rateoTredicesima, 51.38);
  assert.equal(c.accantonamenti.tfrMese, 49.47);    // (616,50 + 51,38) / 13,5
  assert.equal(c.accantonamenti.ferieMaturateOre, 5.42); // 26 × 2,5 / 12
});

test('dicembre 2026: tredicesima pagata e contatori progressivi', () => {
  let stato = {};
  const ott = calcolaCedolino(r9, { anno: 2026, mese: 10 }, stato); stato = ott.contatori;
  const nov = calcolaCedolino(r9, { anno: 2026, mese: 11 }, stato); stato = nov.contatori;
  const dic = calcolaCedolino(r9, { anno: 2026, mese: 12 }, stato);
  const v13 = dic.voci.find((v) => v.codice === '13A');
  const atteso = Math.round((ott.accantonamenti.rateoTredicesima + nov.accantonamenti.rateoTredicesima + dic.accantonamenti.rateoTredicesima) * 100) / 100;
  assert.equal(v13.importo, atteso);
  assert.equal(dic.contatori.tredicesimaMaturata, 0);
  // 3 festività a dicembre (8, 25, 26) = 7,5 h
  assert.equal(dic.voci.find((v) => v.codice === 'FES').quantita, 7.5);
  assert.equal(Math.round(dic.contatori.ferieResidueOre * 100) / 100, 16.25);
});

test('ferie godute riducono ore ordinarie e saldo', () => {
  const c = calcolaCedolino(r9, { anno: 2026, mese: 11, oreFerie: 15 }, { ferieResidueOre: 10.833333, anno: 2026 });
  assert.equal(c.voci.find((v) => v.codice === 'ORD').quantita, 48);
  assert.equal(c.voci.find((v) => v.codice === 'FER').importo, 135);
  assert.equal(Math.round(c.contatori.ferieResidueOre * 100) / 100, 1.25);
});

test('malattia sotto i 6 mesi: primi 3 giorni al 50%, poi 100%, max 8 giorni', () => {
  // 10-13 novembre 2026 (mar-ven): 4 giorni lavorativi
  const c = calcolaCedolino(r9, { anno: 2026, mese: 11, malattia: [{ inizio: '2026-11-10', fine: '2026-11-13' }] }, { anno: 2026 });
  assert.equal(c.voci.find((v) => v.codice === 'MAL50').quantita, 9);  // 3 giorni × 3 h
  assert.equal(c.voci.find((v) => v.codice === 'MAL50').importo, 40.5);
  assert.equal(c.voci.find((v) => v.codice === 'MAL100').quantita, 3);
  assert.equal(c.voci.find((v) => v.codice === 'ORD').quantita, 51);
  assert.equal(c.contatori.giorniMalattiaAnno, 4);
});

test('malattia oltre i giorni retribuiti: non pagata e segnalata', () => {
  const c = calcolaCedolino(r9, { anno: 2026, mese: 11, malattia: [{ inizio: '2026-11-16', fine: '2026-11-20' }] }, { anno: 2026, giorniMalattiaAnno: 7 });
  assert.equal(c.voci.find((v) => v.codice === 'MAL50').quantita, 3); // solo il 16 rientra negli 8 giorni
  assert.ok(c.avvisi.some((a) => a.includes('non pagata')));
});

test('straordinari con maggiorazioni CCNL', () => {
  const c = calcolaCedolino(r9, { anno: 2026, mese: 11, straordinari: { diurno: 2, festivo: 3 } });
  assert.equal(c.voci.find((v) => v.codice === 'STD').importo, 22.5);  // 2 × 11,25
  assert.equal(c.voci.find((v) => v.codice === 'STF').importo, 43.2);  // 3 × 14,40
});

test('tredicesima mensile', () => {
  const c = calcolaCedolino({ ...r9, tredicesimaMensile: true }, { anno: 2026, mese: 10 });
  assert.equal(c.voci.find((v) => v.codice === '13M').importo, 51.38);
  assert.equal(c.lordo, 667.88);
});

test('avviso paga sotto il minimo', () => {
  const c = calcolaCedolino({ ...r9, pagaOraria: 6.9 }, { anno: 2026, mese: 11 });
  assert.ok(c.avvisi[0].includes('sotto il minimo'));
});

test('anzianità in mesi', () => {
  assert.equal(mesiAnzianita('2026-10-01', '2026-12-31'), 2);
  assert.equal(mesiAnzianita('2026-10-01', '2027-04-01'), 6);
});

test('simulatore: 15 h/settimana a 8 e 9 €/h', () => {
  const s8 = simulaCosto({ pagaOraria: 8, oreSettimanaliTot: 15, anno: 2026 });
  const s9 = simulaCosto({ pagaOraria: 9, oreSettimanaliTot: 15, anno: 2026 });
  assert.equal(s8.oreMese, 65);
  assert.equal(s8.inpsDatore, 82.55);  // 65 × 1,27
  assert.equal(s9.inpsDatore, 93.6);   // 65 × 1,44
  assert.equal(s8.costoMensile, 690.21);
  assert.equal(s9.costoMensile, 776.89);
});

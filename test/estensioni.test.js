import { test } from 'node:test';
import assert from 'node:assert/strict';
import { festivitaAnno, tabelleAnno } from '../src/engine/tabelle.js';
import { calcolaCedolino } from '../src/engine/calcolo.js';
import { presenzeDaGiorni } from '../src/engine/presenze.js';
import { calcolaCatena } from '../src/engine/catena.js';
import { riepilogoAnno, contributiDeducibili } from '../src/engine/annuale.js';
import { calcolaCessazione, giorniPreavviso } from '../src/engine/cessazione.js';
import { generaScadenze, primoLavorativo, avvisiRapporto } from '../src/engine/scadenze.js';

const r = {
  livello: 'B', orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, dataAssunzione: '2026-10-01',
  tipoContratto: 'indeterminato', cuaf: true, cassaColf: true, tredicesimaMensile: false, pagaOraria: 9,
};

test('festività calcolate: Pasquetta e 4 ottobre', () => {
  assert.ok(festivitaAnno(2026).includes('2026-04-06'));
  assert.ok(festivitaAnno(2027).includes('2027-03-29')); // Pasqua 2027: 28 marzo
  assert.ok(festivitaAnno(2027).includes('2027-10-04'));
  assert.ok(!festivitaAnno(2025).includes('2025-10-04'));
  assert.equal(festivitaAnno(2026).length, 12);
});

test('tabelle mancanti: valori dell\'ultimo anno, segnalati', () => {
  const t = tabelleAnno(2027);
  assert.equal(t.provvisorie, true);
  assert.equal(t.annoTabelle, 2026);
  const c = calcolaCedolino(r, { anno: 2027, mese: 1 });
  assert.ok(c.avvisi.some((a) => a.includes('provvisorio')));
});

test('presenze giornaliere: default = orario programmato', () => {
  const p = presenzeDaGiorni(r, 2026, 11, {});
  assert.equal(p.oreOrdinarie, 63);
  assert.equal(p.oreAggiuntive, 0);
});

test('presenze giornaliere: ferie, malattia, ore extra, sabato e domenica', () => {
  const giorni = {
    '2026-11-02': { tipo: 'F' }, '2026-11-03': { tipo: 'F' },
    '2026-11-10': { tipo: 'M' }, '2026-11-11': { tipo: 'M' },
    '2026-11-12': { tipo: 'L', ore: 5 },                 // 2 ore oltre l'orario
    '2026-11-14': { tipo: 'L', ore: 2 },                 // sabato
    '2026-11-15': { tipo: 'L', ore: 1 },                 // domenica
    '2026-11-16': { tipo: 'A' },                         // assenza non pagata
    '2026-11-17': { tipo: 'L', ore: 3, extra: 1, extraTipo: 'notturno' },
  };
  const p = presenzeDaGiorni(r, 2026, 11, giorni);
  assert.equal(p.oreFerie, 6);
  assert.deepEqual(p.malattia, [{ inizio: '2026-11-10', fine: '2026-11-11' }]);
  assert.equal(p.oreOrdinarie, 63 - 6 - 6 - 3);
  assert.equal(p.oreAggiuntive, 4);
  assert.equal(p.straordinari.festivo, 1);
  assert.equal(p.straordinari.notturno, 1);
  const c = calcolaCedolino(r, p, { anno: 2026 });
  assert.equal(c.voci.find((v) => v.codice === 'MAL50').quantita, 6);
});

test('catena: contatori progressivi e cedolini confermati congelati', () => {
  const cat = calcolaCatena(r, [], { anno: 2026, mese: 12 });
  assert.equal(cat.length, 3);
  assert.equal(cat[2].risultato.voci.find((v) => v.codice === '13A').importo, 153.39);
  // ottobre confermato con un netto "storico" diverso: resta quello salvato
  const congelato = { ...cat[0].risultato, netto: 1 };
  const cat2 = calcolaCatena(r, [{ anno: 2026, mese: 10, stato: 'confermato', risultato: congelato, presenze: {} }], { anno: 2026, mese: 12 });
  assert.equal(cat2[0].risultato.netto, 1);
  assert.equal(cat2[0].stato, 'confermato');
});

test('catena: malattia a cavallo di due mesi conta i giorni dall\'inizio', () => {
  const ced = [
    { anno: 2026, mese: 10, stato: 'bozza', presenze: { giorni: { '2026-10-29': { tipo: 'M' }, '2026-10-30': { tipo: 'M' }, '2026-10-31': { tipo: 'M' } } } },
    { anno: 2026, mese: 11, stato: 'bozza', presenze: { giorni: { '2026-11-01': { tipo: 'M' }, '2026-11-02': { tipo: 'M' } } } },
  ];
  const cat = calcolaCatena(r, ced, { anno: 2026, mese: 11 });
  const nov = cat[1].risultato;
  // 2 novembre è il 5° giorno di malattia → 100%
  assert.equal(nov.voci.find((v) => v.codice === 'MAL100').quantita, 3);
  assert.equal(nov.voci.find((v) => v.codice === 'MAL50'), undefined);
});

test('rivalutazione TFR al cambio d\'anno (quota fissa)', () => {
  const cat = calcolaCatena(r, [], { anno: 2028, mese: 1 });
  const gen27 = cat.find((m) => m.anno === 2027 && m.mese === 1).risultato;
  assert.equal(gen27.accantonamenti.rivalutazioneTfr, 0); // nel 2026 il fondo iniziale era zero
  const gen28 = cat.find((m) => m.anno === 2028 && m.mese === 1).risultato;
  const fondoFine26 = cat.find((m) => m.anno === 2026 && m.mese === 12).risultato.contatori.tfrAccantonato;
  assert.equal(gen28.accantonamenti.rivalutazioneTfr, Math.round(fondoFine26 * 0.015 * 100) / 100);
});

test('anticipo TFR: pagato nel netto e scalato dal fondo', () => {
  const c = calcolaCedolino(r, { anno: 2027, mese: 6, anticipoTfr: 100 }, { anno: 2027, tfrAccantonato: 500 });
  assert.equal(c.anticipoTfr, 100);
  assert.equal(c.contatori.tfrAccantonato, Math.round((400 + c.accantonamenti.tfrMese) * 100) / 100);
  const senza = calcolaCedolino(r, { anno: 2027, mese: 6 }, { anno: 2027, tfrAccantonato: 500 });
  assert.equal(c.netto, Math.round((senza.netto + 100) * 100) / 100);
});

test('riepilogo annuo e contributi deducibili', () => {
  const cat = calcolaCatena(r, [], { anno: 2027, mese: 12 });
  const a = riepilogoAnno(cat, 2026);
  assert.equal(a.mesi, 3);
  assert.equal(a.lordo, 1993.89);
  assert.equal(a.imponibileFiscale, Math.round((a.lordo - a.contributiLavoratrice) * 100) / 100);
  const d = contributiDeducibili(cat, 2027);
  assert.ok(d.pagati > 0 && d.deducibili <= 1549.37);
});

test('preavviso CCNL', () => {
  assert.equal(giorniPreavviso(r, '2027-06-30', 'licenziamento'), 8);   // < 25 h, < 2 anni
  assert.equal(giorniPreavviso(r, '2029-06-30', 'licenziamento'), 15);  // < 25 h, > 2 anni
  assert.equal(giorniPreavviso(r, '2027-06-30', 'dimissioni'), 4);
  const pieno = { ...r, orario: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6 } };
  assert.equal(giorniPreavviso(pieno, '2027-06-30', 'licenziamento'), 15);
  assert.equal(giorniPreavviso(r, '2027-06-30', 'giustaCausa'), 0);
});

test('cessazione: ferie, 13ª, preavviso non lavorato, TFR', () => {
  const stato = { anno: 2027, ferieResidueOre: 10, tredicesimaMaturata: 200, tfrAccantonato: 800, tfrFondoInizioAnno: 150 };
  const c = calcolaCessazione(r, stato, { dataCessazione: '2027-06-30', motivo: 'licenziamento', preavvisoLavorato: false });
  assert.equal(c.voci.find((v) => v.codice === 'IFE').importo, 90);
  assert.equal(c.voci.find((v) => v.codice === '13R').importo, 200);
  assert.equal(c.giorniPreavviso, 8);
  const ipr = c.voci.find((v) => v.codice === 'IPR');
  assert.equal(ipr.importo, 154.26); // 17,14 ore × 9 €
  assert.ok(c.voci.find((v) => v.codice === 'TFR').importo > 800);
  assert.ok(c.trattenute > 0);
});

test('scadenze: trimestri INPS al primo giorno lavorativo', () => {
  assert.equal(primoLavorativo('2027-01-10'), '2027-01-11'); // 10 gennaio 2027 è domenica
  const cat = calcolaCatena(r, [], { anno: 2026, mese: 12 });
  const sc = generaScadenze(r, cat, '2026-10-29');
  const q4 = sc.find((s) => s.chiave === 'inps-2026-T4');
  assert.equal(q4.data, '2027-01-11');
  assert.equal(q4.importo, Math.round(cat.reduce((s, m) => s + m.risultato.contributi.daVersareAInps, 0) * 100) / 100);
  assert.ok(sc.some((s) => s.chiave === '13-2026'));
  const conProva = generaScadenze({ ...r, giorniProva: 8 }, cat, '2026-10-29');
  assert.equal(conProva.find((s) => s.chiave === 'prova').data, '2026-10-12');
});

test('avvisi: mesi passati non pagati', () => {
  const cat = calcolaCatena(r, [], { anno: 2026, mese: 12 });
  const av = avvisiRapporto(r, cat, '2026-12-15');
  assert.ok(av.some((a) => a.testo.includes('non risultano pagati')));
});

test('formato italiano e paga netta oraria', async () => {
  const { fmtEur } = await import('../src/engine/formato.js');
  const { simulaCosto } = await import('../src/engine/calcolo.js');
  assert.equal(fmtEur(1035.891), '1.035,89 €');
  assert.equal(fmtEur(0.4), '0,40 €');
  const s = simulaCosto({ pagaOraria: 9, oreSettimanaliTot: 15, anno: 2026 });
  assert.equal(s.pagaNettaOraria, 8.5);   // 9 − 0,48 INPS − 0,02 Cassa Colf
  assert.equal(s.costoOrario, Math.round(776.89 / 65 * 100) / 100);
});

test('tabelle personalizzate hanno la precedenza e tolgono il "provvisorio"', async () => {
  const { impostaTabellePersonalizzate, TABELLE } = await import('../src/engine/tabelle.js');
  const t27 = JSON.parse(JSON.stringify(TABELLE[2026]));
  t27.minimiOrariNonConviventi.B = 7.20;
  t27.inps.indeterminato.fasce[0].lavoratore = 0.44;
  impostaTabellePersonalizzate({ 2027: t27 });
  const t = tabelleAnno(2027);
  assert.equal(t.provvisorie, false);
  assert.equal(t.minimiOrariNonConviventi.B, 7.2);
  assert.equal(t.inps.indeterminato.fasce[2].fino, Infinity);
  const c = calcolaCedolino({ ...r, pagaOraria: 8 }, { anno: 2027, mese: 2 });
  assert.ok(!c.avvisi.some((a) => a.includes('provvisorio')));
  assert.equal(c.trattenute[0].importo, Math.round(c.contributi.oreContributive * 0.44 * 100) / 100);
  impostaTabellePersonalizzate({});
});

test('deducibili: usa il versamento registrato se pagato nell\'anno', () => {
  const cat = calcolaCatena(r, [], { anno: 2027, mese: 12 });
  const senza = contributiDeducibili(cat, 2027);
  const q4 = cat.filter((m) => m.anno === 2026 && m.mese >= 10);
  const dovuto = q4.reduce((s, m) => s + m.risultato.contributi.daVersareAInps, 0);
  const con = contributiDeducibili(cat, 2027, [{ anno: 2026, trimestre: 4, data_pagamento: '2027-01-11', importo: dovuto }]);
  assert.equal(con.trimestriRegistrati, 1);
  assert.ok(Math.abs(con.pagati - senza.pagati) < 0.05);
  // pagato in ritardo nel 2028: non conta nel 2027
  const tardi = contributiDeducibili(cat, 2027, [{ anno: 2026, trimestre: 4, data_pagamento: '2028-02-01', importo: dovuto }]);
  assert.ok(tardi.pagati < senza.pagati);
});

test('permesso di poche ore: il resto della giornata è lavorato', () => {
  const p = presenzeDaGiorni(r, 2026, 11, { '2026-11-03': { tipo: 'P', ore: 1 } });
  assert.equal(p.orePermessi, 1);
  assert.equal(p.oreOrdinarie, 62);
});

test('variazione di paga dal 1° del mese: vale da quel mese in poi', async () => {
  const { condizioniMese } = await import('../src/engine/variazioni.js');
  const rv = { ...r, variazioni: [{ dal: '2027-03-01', pagaOraria: 10, orario: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4 } }] };
  assert.equal(condizioniMese(rv, 2027, 2).pagaOraria, 9);
  assert.equal(condizioniMese(rv, 2027, 3).pagaOraria, 10);
  const cat = calcolaCatena(rv, [], { anno: 2027, mese: 3 });
  const feb = cat.find((m) => m.anno === 2027 && m.mese === 2).risultato;
  const mar = cat.find((m) => m.anno === 2027 && m.mese === 3).risultato;
  assert.equal(feb.voci.find((v) => v.codice === 'ORD').tariffa, 9);
  assert.equal(mar.voci.find((v) => v.codice === 'ORD').tariffa, 10);
  assert.equal(mar.voci.find((v) => v.codice === 'ORD').quantita, 88); // 22 giorni feriali × 4 ore
  const sc = generaScadenze(rv, cat, '2027-03-01');
  assert.ok(sc.some((s) => s.chiave === 'inps-var-2027-03-01' && s.data === '2027-03-05'));
});

test('promemoria: anticipo, giorno prima, giorno stesso e scadute il lunedì', async () => {
  const { daRicordare } = await import('../scripts/promemoria.mjs');
  const sc = [
    { chiave: 'a', data: '2027-01-14', titolo: 'A' },   // tra 3 giorni
    { chiave: 'b', data: '2027-01-12', titolo: 'B' },   // domani
    { chiave: 'c', data: '2027-01-11', titolo: 'C' },   // oggi
    { chiave: 'd', data: '2027-01-05', titolo: 'D' },   // scaduta
    { chiave: 'e', data: '2027-01-13', titolo: 'E' },   // tra 2 giorni: no
    { chiave: 'f', data: '2027-01-11', titolo: 'F', fatta: true },
  ];
  // 11/01/2027 è lunedì
  assert.deepEqual(daRicordare(sc, '2027-01-11', 3).map((s) => s.chiave), ['a', 'b', 'c', 'd']);
  // martedì 12/01: B è oggi, E domani; C scaduta non si ripete fuori dal lunedì
  assert.deepEqual(daRicordare(sc, '2027-01-12', 3).map((s) => s.chiave), ['b', 'e']);
});

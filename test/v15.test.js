import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabelleAnno, minimoContrattuale } from '../src/engine/tabelle.js';
import { calcolaCedolino, simulaCosto, normalizzaRapporto, fasciaContributiva } from '../src/engine/calcolo.js';
import { presenzeDaGiorni } from '../src/engine/presenze.js';
import { calcolaCatena } from '../src/engine/catena.js';
import { condizioniMese } from '../src/engine/variazioni.js';
import { detrazioneAssistenza } from '../src/engine/annuale.js';
import { reportAnno, sommaReport } from '../src/engine/report.js';
import { verificaIban, formattaIban } from '../src/lib/iban.js';

const conv = {
  livello: 'CS', tipologia: 'convivente', pagaMensile: 1193.84, vittoAlloggio: true,
  orario: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9 }, dataAssunzione: '2026-01-01',
  tipoContratto: 'indeterminato', cuaf: true, cassaColf: true, tredicesimaMensile: false,
};
const ore = {
  livello: 'B', orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, dataAssunzione: '2026-01-01',
  tipoContratto: 'indeterminato', cuaf: true, cassaColf: true, tredicesimaMensile: false, pagaOraria: 9,
};

test('minimi 2026: orari completi e mensili conviventi/notturni', () => {
  const t = tabelleAnno(2026);
  assert.equal(t.minimiOrariNonConviventi.CS, 8.3);
  assert.equal(minimoContrattuale(t, { tipologia: 'convivente', livello: 'CS' }), 1193.84);
  assert.equal(minimoContrattuale(t, { tipologia: 'convivente', livello: 'D' }), 1612.2); // 1.404,51 + 207,69
  assert.equal(minimoContrattuale(t, { tipologia: 'conviventePT', livello: 'B' }), 702.25);
  assert.equal(minimoContrattuale(t, { tipologia: 'conviventePT', livello: 'A' }), null);
  assert.equal(minimoContrattuale(t, { tipologia: 'notturna', livello: 'CS' }), 1372.91);
  assert.equal(minimoContrattuale(t, { tipologia: 'presenza', livello: 'B' }), 811.09);
  assert.equal(t.vittoAlloggio.totale, 6.66);
});

test('convivente: mese intero a paga fissa, contributi oltre 24 h, 13ª e TFR con vitto e alloggio', () => {
  const c = calcolaCedolino(conv, { anno: 2026, mese: 3 });
  assert.equal(c.lordo, 1193.84);
  assert.equal(c.voci.length, 1);
  assert.equal(c.contributi.fascia, 'oltre 24 ore settimanali');
  assert.equal(c.contributi.orarioTotale, 1.24);
  assert.equal(c.vittoAlloggioMese, 173.16); // 6,66 × 26
  assert.equal(c.accantonamenti.rateoTredicesima, 113.92); // (1.193,84 + 173,16) / 12
  assert.equal(c.accantonamenti.tfrMese, 109.7);
  assert.deepEqual(c.avvisi, []);
});

test('convivente: ferie e festività non cambiano la paga, assenze e malattia sì', () => {
  const pieno = calcolaCedolino(conv, presenzeDaGiorni(conv, 2026, 3, { '2026-03-10': { tipo: 'F', ore: 0 } }));
  assert.equal(pieno.lordo, 1193.84);
  const assente = calcolaCedolino(conv, presenzeDaGiorni(conv, 2026, 3, { '2026-03-10': { tipo: 'A', ore: 0 } }));
  assert.equal(assente.lordo, 1147.92); // − 1/26
  const malattia = calcolaCedolino(conv, presenzeDaGiorni(conv, 2026, 3, { '2026-03-10': { tipo: 'M' }, '2026-03-11': { tipo: 'M' } }));
  assert.equal(malattia.lordo, 1147.92); // 2 giorni al 50%
});

test('convivente: mese di assunzione pagato a 1/26 per giornata', () => {
  const c = calcolaCedolino({ ...conv, dataAssunzione: '2026-03-16' }, { anno: 2026, mese: 3 });
  assert.equal(c.voci[0].quantita, 14);
  assert.equal(c.lordo, 642.84); // 14 × 1.193,84 / 26
});

test('convivente: sotto il minimo, livello non previsto, orario eccessivo', () => {
  assert.ok(calcolaCedolino({ ...conv, pagaMensile: 1000 }, { anno: 2026, mese: 3 }).avvisi.some((a) => a.includes('sotto il minimo')));
  assert.ok(calcolaCedolino({ ...conv, tipologia: 'conviventePT', livello: 'A', orario: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 } }, { anno: 2026, mese: 3 }).avvisi.some((a) => a.includes('non è previsto')));
  assert.ok(calcolaCedolino({ ...conv, tipologia: 'conviventePT', livello: 'B', pagaMensile: 702.25 }, { anno: 2026, mese: 3 }).avvisi.some((a) => a.includes('oltre il massimo')));
});

test('paga mensile: paga oraria equivalente, variazioni e catena', () => {
  assert.equal(normalizzaRapporto(conv).pagaOraria, 5.1);
  const v = { ...conv, variazioni: [{ dal: '2026-06-01', pagaMensile: 1300 }] };
  assert.equal(condizioniMese(v, 2026, 6).pagaMensile, 1300);
  const cat = calcolaCatena(v, [], { anno: 2026, mese: 6 });
  assert.equal(cat.length, 6);
  assert.equal(cat[5].risultato.lordo, 1300);
  // straordinario pagato sulla paga oraria equivalente
  const c = calcolaCedolino(conv, { anno: 2026, mese: 3, straordinari: { diurno: 2 } });
  assert.equal(c.lordo, euro2(1193.84 + 2 * 5.1 * 1.25));
});
const euro2 = (x) => Math.round(x * 100) / 100;

test('presenza notturna sotto le 24 ore: fascia sulla retribuzione oraria effettiva', () => {
  const p = { ...conv, tipologia: 'presenza', vittoAlloggio: false, pagaMensile: 811.09, orario: { 1: 5, 2: 5, 3: 5, 4: 5 } };
  const f = fasciaContributiva(p, 2026);
  // 811,09 × 12 / 52 / 20 h = 9,36 €/h; con 1/12 di 13ª = 10,14 → fascia 2
  assert.match(f.nome, /^fascia 2 .*10,14/);
  assert.equal(f.totaleOrario, 1.92);
});

test('simulatore: convivente e confronto con il rapporto a ore', () => {
  const s = simulaCosto({ anno: 2026, oreSettimanaliTot: 54, tipologia: 'convivente', pagaMensile: 1193.84, vittoAlloggio: true, livello: 'CS' });
  assert.equal(s.costoMensile, 1644.44);
  assert.equal(s.minimo, 1193.84);
  const h = simulaCosto({ pagaOraria: 9, oreSettimanaliTot: 15, anno: 2026 });
  assert.equal(h.costoMensile, 776.89);
});

test('detrazione 19%: requisiti, tetto 2.100 €, per cassa', () => {
  const cat = calcolaCatena(ore, [
    { anno: 2026, mese: 1, stato: 'pagato', pagato_at: '2026-01-31', presenze: {} },
  ], { anno: 2026, mese: 12 });
  const no = detrazioneAssistenza(cat, 2026, {});
  assert.equal(no.ammessa, false);
  assert.equal(no.detrazione, 0);
  assert.equal(no.perCassa, true);
  assert.equal(no.mesi, 1);
  const tutto = calcolaCatena(ore, [], { anno: 2026, mese: 12 });
  const si = detrazioneAssistenza(tutto, 2026, { detrazione: { nonAutosufficiente: true, redditoEntroLimite: true }, pagamento: { modalita: 'bonifico' } });
  assert.equal(si.perCassa, false);
  assert.ok(si.spesa > 2100);
  assert.equal(si.detrazione, 399);
  const contanti = detrazioneAssistenza(tutto, 2026, { detrazione: { nonAutosufficiente: true, redditoEntroLimite: true }, pagamento: { modalita: 'contanti' } });
  assert.equal(contanti.ammessa, false);
});

test('report: budget, agevolazioni e somma di più rapporti', () => {
  const a = reportAnno({ ...ore, budgetAnnuo: 8000, detrazione: { assistito: 'Maria', nonAutosufficiente: true, redditoEntroLimite: true } }, [], 2026, '2026-10-29');
  assert.equal(a.budget, 8000);
  assert.ok(a.scostamentoBudget > 0); // circa 9.300 € l'anno
  assert.equal(a.fiscale.detrazione, 399);
  assert.ok(a.fiscale.deducibili > 0);
  const b = reportAnno({ ...ore, budgetAnnuo: 2000, dataAssunzione: '2026-08-01', detrazione: { assistito: 'maria', nonAutosufficiente: true, redditoEntroLimite: true } }, [], 2026, '2026-10-29');
  const s = sommaReport([a, b]);
  assert.equal(s.budget, 10000);
  assert.equal(s.fiscale.detrazione, 399); // stesso assistito: un solo tetto
  assert.ok(s.fiscale.deducibili <= 1549.37);
});

test('IBAN: verifica e formattazione', () => {
  assert.equal(verificaIban('IT60 X054 2811 1010 0000 0123 456').ok, true);
  assert.equal(verificaIban('IT60X0542811101000000123457').ok, false);
  assert.match(verificaIban('IT60X054281110100000012345').msg, /27 caratteri/);
  assert.equal(formattaIban('it60x0542811101000000123456'), 'IT60 X054 2811 1010 0000 0123 456');
});

// Test di regressione: tre rapporti tipo calcolati mese per mese su più anni.
// I risultati sono fissati in test/riferimento/regressione.json: qualunque modifica al
// codice che cambi anche un solo centesimo di un cedolino fa fallire il test.
//
// Se la modifica è voluta (per esempio una regola corretta o tabelle nuove):
//   AGGIORNA_RIFERIMENTO=1 npm test
// poi controllare le differenze del file con git diff prima di salvarle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { calcolaCatena } from '../src/engine/catena.js';
import { calcolaCessazione } from '../src/engine/cessazione.js';

const FILE = new URL('./riferimento/regressione.json', import.meta.url);
const AGGIORNA = process.env.AGGIORNA_RIFERIMENTO === '1';

const giorni = (date, rec) => Object.fromEntries(date.map((d) => [d, rec]));
const intervallo = (da, a) => {
  const out = [];
  for (let d = new Date(da + 'T12:00:00Z'); d <= new Date(a + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
};
const ced = (anno, mese, g = {}, extra = {}) => ({ anno, mese, stato: 'bozza', presenze: { giorni: g, extra } });

// 1. Il rapporto attuale: livello B a ore, 15 h/sett., 9 €/h, con un po' di tutto.
const attuale = {
  rapporto: {
    livello: 'B', tipologia: 'ore', pagaOraria: 9, orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
    dataAssunzione: '2026-10-01', tipoContratto: 'indeterminato', cuaf: true, cassaColf: true,
  },
  cedolini: [
    ced(2026, 11, { '2026-11-10': { tipo: 'L', ore: 5 }, '2026-11-15': { tipo: 'L', ore: 2 } }), // ore aggiuntive e domenica
    ced(2026, 12, { '2026-12-08': { tipo: 'L', ore: 3 }, '2026-12-22': { tipo: 'P', ore: 2 } }),   // festività lavorata, permesso
    ced(2027, 2, giorni(intervallo('2027-02-22', '2027-02-26'), { tipo: 'M' })),                 // malattia 5 giorni
    ced(2027, 3, { '2027-03-03': { tipo: 'L', ore: 3, extra: 2, extraTipo: 'notturno' } }),       // straordinario notturno
    ced(2027, 8, giorni(intervallo('2027-08-09', '2027-08-20'), { tipo: 'F' })),                 // due settimane di ferie
    ced(2027, 10, { '2027-10-05': { tipo: 'A' }, '2027-10-06': { tipo: 'A' } }),                 // assenze non retribuite
    ced(2028, 1, giorni(intervallo('2028-01-27', '2028-01-31'), { tipo: 'M' })),                 // malattia a cavallo di mese
    ced(2028, 2, giorni(intervallo('2028-02-01', '2028-02-04'), { tipo: 'M' })),
    ced(2028, 5, {}, { anticipoTfr: 300 }),                                                       // anticipo TFR
  ],
  fino: { anno: 2028, mese: 12 },
  cessazione: { dataCessazione: '2028-12-31', motivo: 'licenziamento', preavvisoLavorato: false },
};

// 2. Convivente livello BS assunta a metà mese, con malattia lunga e dimissioni.
const convivente = {
  rapporto: {
    livello: 'BS', tipologia: 'convivente', pagaMensile: 1100, orario: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9 },
    dataAssunzione: '2026-03-16', tipoContratto: 'indeterminato', cuaf: true, cassaColf: true, vittoAlloggio: true,
  },
  cedolini: [
    ced(2026, 7, giorni(intervallo('2026-07-20', '2026-07-31'), { tipo: 'F' })),
    ced(2026, 11, giorni(intervallo('2026-11-23', '2026-11-30'), { tipo: 'M' })),
    ced(2026, 12, giorni(intervallo('2026-12-01', '2026-12-04'), { tipo: 'M' })),
  ],
  fino: { anno: 2027, mese: 6 },
  cessazione: { dataCessazione: '2027-06-30', motivo: 'dimissioni', preavvisoLavorato: true },
};

// 3. Tempo determinato oltre 24 h/sett. (contributo fisso e aggiuntivo).
const determinato = {
  rapporto: {
    livello: 'CS', tipologia: 'ore', pagaOraria: 10, orario: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6 },
    dataAssunzione: '2026-05-04', tipoContratto: 'determinato', cuaf: false, cassaColf: true,
  },
  cedolini: [ced(2026, 8, giorni(intervallo('2026-08-03', '2026-08-14'), { tipo: 'F' }))],
  fino: { anno: 2027, mese: 4 },
  cessazione: { dataCessazione: '2027-04-30', motivo: 'termine', preavvisoLavorato: true },
};

/** Le voci che contano di ogni cedolino, in forma compatta e stabile. */
function sintesi({ rapporto, cedolini, fino, cessazione }) {
  const catena = calcolaCatena(rapporto, cedolini, fino);
  const mesi = catena.map(({ anno, mese, risultato: r }) => ({
    mese: `${anno}-${String(mese).padStart(2, '0')}`,
    lordo: r.lordo,
    netto: r.netto,
    voci: r.voci.map((v) => `${v.codice} ${v.quantita ?? ''} ${v.importo}`),
    trattenute: r.trattenute.map((v) => `${v.descrizione.split(' ')[0]} ${v.importo}`),
    inps: [r.contributi.oreContributive, r.contributi.inpsDatore, r.contributi.inpsLavoratore],
    accantonamenti: r.accantonamenti,
    contatori: r.contatori,
  }));
  const ultimo = catena[catena.length - 1];
  const fine = calcolaCessazione(rapporto, ultimo.risultato.contatori, cessazione);
  return { mesi, cessazione: { voci: fine.voci.map((v) => `${v.codice} ${v.importo}`), lordo: fine.lordo, netto: fine.netto, contributiDatore: fine.contributiDatore } };
}

const casi = { attuale, convivente, determinato };
const calcolati = Object.fromEntries(Object.entries(casi).map(([nome, c]) => [nome, sintesi(c)]));

if (AGGIORNA || !existsSync(FILE)) {
  mkdirSync(new URL('./riferimento/', import.meta.url), { recursive: true });
  writeFileSync(FILE, JSON.stringify(calcolati, null, 1) + '\n');
}
const riferimento = JSON.parse(readFileSync(FILE, 'utf8'));

for (const nome of Object.keys(casi)) {
  test(`regressione: rapporto ${nome}, mese per mese`, () => {
    const att = riferimento[nome];
    assert.ok(att, `manca il riferimento per ${nome}: rigeneralo con AGGIORNA_RIFERIMENTO=1`);
    assert.equal(calcolati[nome].mesi.length, att.mesi.length, 'numero di mesi diverso');
    for (let i = 0; i < att.mesi.length; i++) {
      assert.deepEqual(calcolati[nome].mesi[i], att.mesi[i], `cedolino ${att.mesi[i].mese} cambiato`);
    }
    assert.deepEqual(calcolati[nome].cessazione, att.cessazione, 'conteggi di fine rapporto cambiati');
  });
}

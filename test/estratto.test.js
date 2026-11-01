import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leggiCsv, leggiTesto, importoDaTesto, dataDaTesto, abbinaStipendi, abbinaContributi } from '../src/engine/estratto.js';

test('estratto: importi e date nei formati delle banche', () => {
  assert.equal(importoDaTesto('-1.234,56'), -1234.56);
  assert.equal(importoDaTesto('582,25 €'), 582.25);
  assert.equal(importoDaTesto('-582.25'), -582.25);
  assert.equal(importoDaTesto('1,234.50'), 1234.5);
  assert.equal(importoDaTesto(''), null);
  assert.equal(dataDaTesto('02/11/2026'), '2026-11-02');
  assert.equal(dataDaTesto('2.11.26'), '2026-11-02');
  assert.equal(dataDaTesto('2026-11-02'), '2026-11-02');
  assert.equal(dataDaTesto('2 nov 2026'), '2026-11-02');
});

test('estratto: CSV con colonna importo', () => {
  const csv = 'Data contabile;Data valuta;Descrizione;Importo\n02/11/2026;02/11/2026;"Bonifico a favore di MUOARA X; stipendio ottobre";-582,25\n03/11/2026;03/11/2026;Spesa supermercato;-45,10\n';
  const m = leggiCsv(csv);
  assert.equal(m.length, 2);
  assert.deepEqual(m[0], { data: '2026-11-02', importo: -582.25, descrizione: 'Bonifico a favore di MUOARA X; stipendio ottobre' });
});

test('estratto: CSV con Dare e Avere', () => {
  const csv = 'Data,Descrizione,Dare,Avere\n2026-11-02,BONIFICO MUOARA,582.25,\n2026-11-05,STIPENDIO VALENTINO,,2000.00\n';
  const m = leggiCsv(csv);
  assert.equal(m[0].importo, -582.25);
  assert.equal(m[1].importo, 2000);
});

test('estratto: testo di un PDF', () => {
  const m = leggiTesto('02/11/2026 02/11/2026 BONIFICO SEPA A MUOARA 582,25\n10/01/2027 PAGAMENTO PAGOPA INPS 376,92');
  assert.equal(m.length, 2);
  assert.equal(m[0].importo, 582.25);
  assert.ok(m[0].segnoIncerto);
});

test('estratto: abbinamento di stipendi e contributi', () => {
  const mesi = [
    { anno: 2026, mese: 10, stato: 'confermato', risultato: { netto: 582.25 } },
    { anno: 2026, mese: 11, stato: 'confermato', risultato: { netto: 601.55 } },
    { anno: 2026, mese: 9, stato: 'pagato', risultato: { netto: 582.25 } },
  ];
  const mov = [
    { data: '2026-11-02', importo: -582.25, descrizione: 'Bonifico a favore di Muoara' },
    { data: '2026-08-01', importo: -582.25, descrizione: 'altro' }, // fuori periodo
    { data: '2027-01-12', importo: -376.92, descrizione: 'PAGAMENTO PAGOPA INPS' },
  ];
  const ab = abbinaStipendi(mesi, mov, 'Muoara');
  assert.equal(ab.length, 1);
  assert.equal(ab[0].mese, 10);
  assert.ok(ab[0].sicuro);
  const inps = abbinaContributi([{ chiave: 'inps-2026-T4', titolo: 'Contributi', importo: 376.92, data: '2027-01-11', fatta: false }], mov);
  assert.equal(inps[0].chiave, 'inps-2026-T4');
});

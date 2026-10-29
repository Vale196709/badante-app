import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leggiRicevuta, trimestreDaPagamento } from '../src/engine/ricevuta.js';

test('ricevuta pagoPA tipo INPS', () => {
  const testo = `Ricevuta di pagamento
Ente creditore: INPS - Istituto Nazionale Previdenza Sociale
Causale: LAVORO DOMESTICO 4 TRIM 2026 - COD. RAPPORTO 1234567
Codice avviso 3010 0000 1234 5678 90
Data scadenza 10/01/2027
Importo pagato € 404,91
Commissione € 1,00
Data pagamento 08/01/2027 10:22`;
  const r = leggiRicevuta(testo, '2027-01-15');
  assert.equal(r.importo, 404.91);
  assert.equal(r.data, '2027-01-08');
  assert.equal(r.trimestre, 4);
  assert.equal(r.anno, 2026);
  assert.equal(r.codiceAvviso, '301000001234567890');
});

test('ricevuta bancaria senza trimestre: lo ricava dalla data', () => {
  const r = leggiRicevuta('BONIFICO PAGOPA\nTOTALE ADDEBITATO EUR 1.212,30\nDATA OPERAZIONE 09.04.2027', '2027-05-01');
  assert.equal(r.importo, 1212.3);
  assert.equal(r.data, '2027-04-09');
  assert.deepEqual([r.anno, r.trimestre], [2027, 1]);
  assert.equal(r.trovati.trimestre, false);
});

test('testo OCR rumoroso', () => {
  const r = leggiRicevuta('lmporto 386,10 €\npagato il 10/07/27\n2° trimestre', '2027-07-20');
  assert.equal(r.importo, 386.1);
  assert.equal(r.data, '2027-07-10');
  assert.deepEqual([r.anno, r.trimestre], [2027, 2]);
});

test('trimestre dalla data di pagamento', () => {
  assert.deepEqual(trimestreDaPagamento('2027-01-10'), { anno: 2026, trimestre: 4 });
  assert.deepEqual(trimestreDaPagamento('2027-10-10'), { anno: 2027, trimestre: 3 });
});

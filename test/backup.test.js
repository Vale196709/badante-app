import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifra } from '../scripts/backup.mjs';
import { decifraBackup, eCifrato } from '../src/lib/cifra.js';

test('backup cifrato: si decifra con la password giusta e non con quella sbagliata', async () => {
  const dati = { formato: 'badante-backup', versione: 2, rapporto: { dati: { lavoratrice: { nome: 'Miora' } } }, cedolini: [] };
  const busta = await cifra(dati, 'una password lunga');
  assert.ok(eCifrato(busta));
  assert.ok(!JSON.stringify(busta).includes('Miora'));
  assert.deepEqual(await decifraBackup(busta, 'una password lunga'), dati);
  await assert.rejects(decifraBackup(busta, 'sbagliata'), /Password sbagliata/);
});

import { riepilogoMensile } from '../scripts/promemoria.mjs';
import { calcolaCatena } from '../src/engine/catena.js';
import { generaScadenze } from '../src/engine/scadenze.js';

test('riepilogo mensile: prima dell\'assunzione e a rapporto avviato', () => {
  const r = { livello: 'B', tipologia: 'ore', pagaOraria: 9, orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, dataAssunzione: '2027-01-01', tipoContratto: 'indeterminato', cuaf: true, cassaColf: true };
  const pre = riepilogoMensile(r, [], generaScadenze(r, [], '2026-12-01'), '2026-12-01');
  assert.equal(pre.titolo, 'Riepilogo di dicembre 2026');
  assert.match(pre.righe.join(' '), /inizia il 01\/01\/2027, tra 31 giorni/);
  assert.match(pre.righe.join(' '), /Entro il 31\/12\/2026: Comunicare l'assunzione/);
  const cat = calcolaCatena(r, [], { anno: 2027, mese: 3 });
  const dopo = riepilogoMensile(r, cat, generaScadenze(r, cat, '2027-03-01'), '2027-03-01');
  assert.match(dopo.righe[0], /^febbraio 2027: netto da pagare 510,00 € \(cedolino da preparare\)/);
});

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

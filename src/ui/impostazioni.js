// Impostazioni: dati del rapporto, tabelle annuali, accessi, backup.
import { app, isTitolare } from '../stato.js';
import { mostraRapporto } from './rapporto.js';
import { mostraTabelle } from './tabelle.js';
import { mostraAccessi } from './accessi.js';
import { mostraBackup } from './backup.js';
import { mostraVariazioni } from './variazioni.js';
import { mostraPromemoria } from './promemoria.js';

let attiva = 'rapporto';

export function mostraImpostazioni(root, ctx) {
  const voci = [
    ['rapporto', 'Rapporto', mostraRapporto],
    ['variazioni', 'Variazioni', mostraVariazioni],
    ['tabelle', 'Tabelle', mostraTabelle],
    ...(app.rapporto?.ruolo !== 'lettore' ? [['promemoria', 'Promemoria', mostraPromemoria]] : []),
    ...(isTitolare() ? [['accessi', 'Accessi', mostraAccessi]] : []),
    ['backup', 'Backup', mostraBackup],
  ];
  if (!app.rapporto?.dati) attiva = 'rapporto';
  if (!voci.some(([k]) => k === attiva)) attiva = 'rapporto';
  root.innerHTML = `
    <h1 class="titolo-pagina">${app.rapporto?.dati ? 'Impostazioni' : 'Nuovo rapporto'}</h1>
    <div class="sotto-schede" role="tablist">
      ${voci.map(([k, n]) => `<button type="button" data-k="${k}" ${k === attiva ? 'aria-current="page"' : ''} ${!app.rapporto?.dati && k !== 'rapporto' ? 'disabled' : ''}>${n}</button>`).join('')}
    </div>
    <div class="sotto-contenuto"></div>`;
  const box = root.querySelector('.sotto-contenuto');
  const apri = (k) => {
    attiva = k;
    root.querySelectorAll('.sotto-schede button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.k === k));
    box.innerHTML = '';
    voci.find(([x]) => x === k)[2](box, ctx);
  };
  root.querySelectorAll('.sotto-schede button').forEach((b) => b.addEventListener('click', () => apri(b.dataset.k)));
  apri(attiva);
}

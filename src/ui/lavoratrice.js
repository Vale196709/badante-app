// Vista della lavoratrice: i suoi cedolini confermati, ferie e TFR, firma per ricevuta.
import { app, eur, num, esc, dataIt, nomeMeseMaiusc, toast } from '../stato.js';
import { firmaRicevuta } from '../lib/dati.js';
import { stampaCedolino } from './stampe.js';

export function mostraLavoratrice(root, { ricaricaDati }) {
  const visibili = app.cedolini.filter((c) => c.stato !== 'bozza').sort((a, b) => b.anno - a.anno || b.mese - a.mese);
  if (!app.rapporto?.dati || !visibili.length) {
    root.innerHTML = '<p class="vuoto">Non ci sono ancora cedolini da visualizzare.</p>';
    return;
  }
  const ultimo = visibili[0].risultato.contatori;
  root.innerHTML = `
    <h1 class="titolo-pagina">I miei cedolini</h1>
    <section class="card">
      <div class="cifre">
        <div><span class="etichetta">Ferie residue</span><span class="valore">${num(ultimo.ferieResidueOre, 1)} ore</span></div>
        <div><span class="etichetta">TFR accantonato</span><span class="valore">${eur(ultimo.tfrAccantonato)}</span></div>
      </div>
      <p class="nota">Valori aggiornati all'ultimo cedolino confermato.</p>
    </section>
    <ul class="lista-mesi">
      ${visibili.map((c) => `
        <li class="riga-lav">
          <span class="mese">${nomeMeseMaiusc(c.mese)} ${c.anno}</span>
          <span class="netto">${eur(c.risultato.netto)}</span>
          <span class="azioni-lav">
            <button type="button" class="secondario" data-vedi="${c.id}">Vedi</button>
            ${c.ricevuta_at
              ? `<span class="nota">✍︎ ricevuto il ${dataIt(c.ricevuta_at)}</span>`
              : `<button type="button" class="primario piccolo" data-firma="${c.id}">Confermo di aver ricevuto ${eur(c.risultato.netto)}</button>`}
          </span>
        </li>`).join('')}
    </ul>`;

  root.querySelectorAll('[data-vedi]').forEach((b) => b.addEventListener('click', () => {
    const c = visibili.find((x) => x.id === b.dataset.vedi);
    stampaCedolino({ anno: c.anno, mese: c.mese, risultato: c.risultato }, c);
  }));
  root.querySelectorAll('[data-firma]').forEach((b) => b.addEventListener('click', async () => {
    const c = visibili.find((x) => x.id === b.dataset.firma);
    if (!confirm(`Confermi di aver ricevuto ${eur(c.risultato.netto)} per ${nomeMeseMaiusc(c.mese)} ${c.anno}?`)) return;
    try {
      await firmaRicevuta(c.id);
      await ricaricaDati();
      toast('Ricevuta confermata');
      mostraLavoratrice(root, { ricaricaDati });
    } catch (e) { toast(`Errore: ${e.message}`, 'ko'); }
  }));
}

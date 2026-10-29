// Informazioni sull'app: versione, data di aggiornamento, novità.
import { VERSIONE, NOVITA, dataBuildIt } from '../novita.js';
import { esc, dataIt } from '../stato.js';

export function mostraInfo(root) {
  root.innerHTML = `
    <h1 class="titolo-pagina">Informazioni</h1>
    <ul class="gruppo">
      <li class="riga-info"><span>Versione</span><strong>${esc(VERSIONE)}</strong></li>
      <li class="riga-info"><span>Aggiornata il</span><strong>${esc(dataBuildIt())}</strong></li>
    </ul>
    <h2 class="testa-gruppo">Novità</h2>
    ${NOVITA.map((n) => `
      <section class="card">
        <div class="card-testa"><h2>Versione ${esc(n.versione)}</h2><span class="nota" style="margin:0">${dataIt(n.data)}</span></div>
        <ul class="elenco-novita">${n.voci.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>
      </section>`).join('')}
    <p class="nota" style="margin:0 16px 16px">L'app si aggiorna da sola: quando esce una nuova versione basta riaprirla.</p>`;
}

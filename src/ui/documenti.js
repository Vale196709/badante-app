// Elenco dei documenti stampabili.
import { app, catenaCorrente, oggiIso, dataIt } from '../stato.js';
import { stampaLetteraAssunzione, stampaPrivacy, stampaDichiarazione, stampaProspettoAnnuale, stampaTfr } from './stampe.js';

export function mostraDocumenti(root, { vai }) {
  const d = app.rapporto?.dati;
  if (!d) { vai('rapporto'); return; }
  const catena = catenaCorrente();
  const anni = [...new Set(catena.map((m) => m.anno))].sort((a, b) => b - a);
  const annoOggi = Number(oggiIso().slice(0, 4));
  const mancanti = [];
  if (!d.datore.cf) mancanti.push('codice fiscale del datore');
  if (!d.lavoratrice.cf) mancanti.push('codice fiscale della lavoratrice');
  if (!d.lavoratrice.indirizzo) mancanti.push('indirizzo della lavoratrice');

  const voce = (id, titolo, descr, disabilitato = false) => `
    <li><button type="button" class="doc" data-doc="${id}" ${disabilitato ? 'disabled' : ''}>
      <span class="doc-titolo">${titolo}</span><span class="doc-descr">${descr}</span>
    </button></li>`;

  root.innerHTML = `
    <h1 class="titolo-pagina">Documenti</h1>
    ${mancanti.length ? `<div class="avviso attenzione">Per documenti completi mancano: ${mancanti.join(', ')}. Si inseriscono nella scheda Rapporto.</div>` : ''}
    <section class="card">
      <h2>All'assunzione</h2>
      <ul class="lista-doc">
        ${voce('assunzione', 'Lettera di assunzione', `Contratto con le clausole del CCNL, da firmare in due copie · inizio ${dataIt(d.dataAssunzione)}`)}
        ${voce('privacy', 'Informativa privacy', 'Da consegnare e far firmare insieme alla lettera di assunzione')}
      </ul>
    </section>
    <section class="card">
      <h2>Ogni anno</h2>
      <div class="riga"><label>Anno<select name="anno">${anni.map((a) => `<option ${a === (anni.includes(annoOggi - 1) ? annoOggi - 1 : anni[0]) ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
      <ul class="lista-doc">
        ${voce('dichiarazione', 'Dichiarazione dei compensi', 'Per la lavoratrice: serve per la sua dichiarazione dei redditi, ISEE e permesso di soggiorno', !anni.length)}
        ${voce('annuale', 'Prospetto costi e contributi deducibili', 'Per te: costi mese per mese e contributi da dedurre nel 730', !anni.length)}
      </ul>
    </section>
    <section class="card">
      <h2>In qualsiasi momento</h2>
      <ul class="lista-doc">
        ${voce('tfr', 'Prospetto TFR', 'Quote accantonate, rivalutazioni e anticipi dall\'assunzione', !catena.length)}
        ${voce('cedolini', 'Cedolini mensili', 'Si stampano dal singolo mese in Presenze e cedolini')}
        ${voce('cessazione', 'Conteggi di fine rapporto', 'Si calcolano e stampano dal Simulatore')}
      </ul>
    </section>
    <p class="nota">Ogni documento si apre in anteprima: con "Stampa / PDF" puoi stamparlo o salvarlo come PDF (su iPhone: Condividi → Salva su File).</p>`;

  const anno = () => Number(root.querySelector('[name=anno]')?.value);
  root.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => {
    switch (b.dataset.doc) {
      case 'assunzione': return stampaLetteraAssunzione();
      case 'privacy': return stampaPrivacy();
      case 'dichiarazione': return stampaDichiarazione(catena, anno());
      case 'annuale': return stampaProspettoAnnuale(catena, anno());
      case 'tfr': return stampaTfr(catena);
      case 'cedolini': return vai('mesi');
      case 'cessazione': return vai('simulatore');
    }
  }));
}

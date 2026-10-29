// Cruscotto: situazione del mese, contatori, prossime scadenze, avvisi e costi dell'anno.
import { app, catenaCorrente, eur, num, esc, dataIt, oggiIso, nomeMeseMaiusc } from '../stato.js';
import { generaScadenze, avvisiRapporto } from '../engine/scadenze.js';
import { riepilogoAnno } from '../engine/annuale.js';
import { condizioniAl } from '../engine/variazioni.js';

const STATI = { 'da fare': 'Da preparare', bozza: 'Bozza', confermato: 'Confermato', pagato: 'Pagato' };

function grafico(mensile) {
  if (!mensile.length) return '';
  const max = Math.max(...mensile.map((m) => m.costo), 1);
  const W = 100 / 12;
  return `
    <figure class="grafico" aria-label="Costo mensile per il datore">
      <div class="barre">
        ${Array.from({ length: 12 }, (_, i) => {
          const m = mensile.find((x) => x.mese === i + 1);
          const h = m ? Math.max(2, (m.costo / max) * 100) : 0;
          return `<div class="colonna" style="width:${W}%">
            ${m ? `<button type="button" class="barra-dato" style="height:${h}%" aria-label="${nomeMeseMaiusc(i + 1)}: ${eur(m.costo)}">
              <span class="suggerimento">${nomeMeseMaiusc(i + 1)}<br><strong>${eur(m.costo)}</strong><br>netto ${eur(m.netto)}</span>
            </button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <div class="asse">${['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'].map((l) => `<span>${l}</span>`).join('')}</div>
    </figure>`;
}

export function mostraHome(root, { vai }) {
  const d = app.rapporto?.dati;
  if (!d) { vai('impostazioni'); return; }
  const oggi = oggiIso();
  const anno = Number(oggi.slice(0, 4));
  const mese = Number(oggi.slice(5, 7));
  const catena = catenaCorrente();
  if (!catena.length) {
    root.innerHTML = `<div class="avviso info">Il rapporto inizia il ${dataIt(d.dataAssunzione)}: il riepilogo si attiva dal primo mese di lavoro. Intanto puoi usare il Simulatore.</div>`;
    return;
  }
  const corrente = catena.find((m) => m.anno === anno && m.mese === mese) ?? catena[catena.length - 1];
  const s = corrente.risultato.contatori;
  const scad = generaScadenze(d, catena, oggi, app.fatte).filter((x) => !x.fatta);
  const scadute = scad.filter((x) => x.data < oggi);
  const prossime = scad.filter((x) => x.data >= oggi).slice(0, 4);
  const avvisi = avvisiRapporto(d, catena, oggi);
  const ra = riepilogoAnno(catena, anno);

  root.innerHTML = `
    <h1 class="titolo-pagina">Riepilogo</h1>
    ${avvisi.map((a) => `<div class="avviso ${a.livello}">${esc(a.testo)}</div>`).join('')}
    ${app.richieste.some((r) => r.stato === 'in attesa') ? `<button type="button" class="avviso info avviso-link" data-vai="mesi">${app.richieste.filter((r) => r.stato === 'in attesa').length} richieste di ferie o permessi in attesa di risposta ›</button>` : ''}

    <section class="card evidenza">
      <div class="card-testa">
        <h2>${nomeMeseMaiusc(corrente.mese)} ${corrente.anno}</h2>
        <span class="pillola ${corrente.stato.replace(' ', '-')}">${STATI[corrente.stato]}</span>
      </div>
      <div class="cifre">
        <div><span class="etichetta">Netto alla lavoratrice</span><span class="valore grande">${eur(corrente.risultato.netto)}</span></div>
        <div><span class="etichetta">Costo per te nel mese</span><span class="valore">${eur(corrente.risultato.costoDatore)}</span></div>
        <div><span class="etichetta">Ore lavorate</span><span class="valore">${num(corrente.risultato.oreLavorate, 1)}</span></div>
      </div>
      <button type="button" class="secondario" data-vai="mesi">Apri presenze e cedolino</button>
    </section>

    <section class="card">
      <h2>Contatori</h2>
      <div class="cifre">
        <div><span class="etichetta">Ferie residue</span><span class="valore">${num(s.ferieResidueOre, 1)} h</span><span class="sotto">≈ ${num(s.ferieResidueOre / (Object.values(condizioniAl(d, oggi).orario).reduce((a, b) => a + b, 0) / Object.keys(condizioniAl(d, oggi).orario).length || 1), 1)} giorni</span></div>
        <div><span class="etichetta">TFR accantonato</span><span class="valore">${eur(s.tfrAccantonato)}</span></div>
        <div><span class="etichetta">${d.tredicesimaMensile ? 'Tredicesima' : '13ª maturata'}</span><span class="valore">${d.tredicesimaMensile ? 'mensile' : eur(s.tredicesimaMaturata)}</span></div>
        <div><span class="etichetta">Malattia ${anno}</span><span class="valore">${s.anno === anno ? s.giorniMalattiaAnno : 0} gg</span></div>
      </div>
    </section>

    <section class="card">
      <div class="card-testa"><h2>Scadenze</h2><button type="button" class="link" data-vai="scadenze">Tutte</button></div>
      ${scadute.length ? `<ul class="lista-scadenze">${scadute.map((x) => `<li class="scaduta"><span class="data">${dataIt(x.data)}</span><span>${esc(x.titolo)}${x.importo != null ? ` · <strong>${eur(x.importo)}</strong>` : ''}</span></li>`).join('')}</ul>` : ''}
      <ul class="lista-scadenze">${prossime.map((x) => `<li><span class="data">${dataIt(x.data)}</span><span>${esc(x.titolo)}${x.importo != null ? ` · <strong>${eur(x.importo)}</strong>` : ''}</span></li>`).join('') || '<li>Nessuna scadenza imminente.</li>'}</ul>
    </section>

    <section class="card">
      <h2>Anno ${anno}</h2>
      <div class="cifre">
        <div><span class="etichetta">Costo totale per te</span><span class="valore">${eur(ra.costoDatore)}</span></div>
        <div><span class="etichetta">Netto pagato</span><span class="valore">${eur(ra.netto)}</span></div>
        <div><span class="etichetta">Contributi INPS</span><span class="valore">${eur(ra.versamentiInps)}</span></div>
        <div><span class="etichetta">Ore lavorate</span><span class="valore">${num(ra.oreLavorate, 0)}</span></div>
      </div>
      <h3 class="sottotitolo">Costo mensile per te</h3>
      ${grafico(ra.mensile)}
      <p class="nota">I mesi futuri non sono inclusi. Il dettaglio mese per mese è nel prospetto annuale (Documenti).</p>
    </section>`;

  root.querySelectorAll('[data-vai]').forEach((b) => b.addEventListener('click', () => vai(b.dataset.vai)));
}

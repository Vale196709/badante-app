// Abbina l'estratto conto della banca agli stipendi e ai contributi INPS e li segna come pagati.
// Il file si legge sul dispositivo: non viene caricato né salvato.
import { app, catenaCorrente, eur, esc, dataIt, oggiIso, nomeMeseMaiusc, toast } from '../stato.js';
import { leggiCsv, leggiTesto, abbinaStipendi, abbinaContributi } from '../engine/estratto.js';
import { generaScadenze } from '../engine/scadenze.js';
import { salvaCedolino, salvaVersamento, segnaScadenza } from '../lib/dati.js';
import { testoDaPdf } from './ricevuta.js';

export function apriRiconciliazione(dopo) {
  let dlg = document.querySelector('dialog.dlg-riconcilia');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'dlg-riconcilia'; document.body.appendChild(dlg); }
  dlg.innerHTML = `
    <form method="dialog" class="bonifico">
      <h2>Abbina l'estratto conto</h2>
      <p class="nota">Scarica dall'home banking l'elenco dei movimenti (meglio in CSV o Excel salvato come CSV, va bene anche il PDF) e caricalo qui. L'app cerca i bonifici con l'importo netto dei cedolini confermati e i pagamenti INPS dei trimestri. Il file resta sul dispositivo: non viene caricato né salvato.</p>
      <label class="file-grande">Scegli il file<input type="file" accept=".csv,.txt,.pdf,text/csv,application/pdf" /></label>
      <p class="esito" role="status"></p>
      <div class="risultati"></div>
      <div class="azioni-mese"><button class="secondario" value="chiudi">Chiudi</button><button type="button" class="primario conferma" hidden>Segna come pagati</button></div>
    </form>`;
  const esito = dlg.querySelector('.esito');
  const ris = dlg.querySelector('.risultati');
  const conferma = dlg.querySelector('.conferma');
  let trovati = { stipendi: [], inps: [] };

  dlg.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    ris.innerHTML = '';
    conferma.hidden = true;
    esito.className = 'esito';
    esito.textContent = 'Leggo il file…';
    try {
      const pdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      const testo = pdf ? await testoDaPdf(file, (t) => { esito.textContent = t; }) : await file.text();
      const movimenti = pdf ? leggiTesto(testo) : leggiCsv(testo);
      if (!movimenti.length) { esito.textContent = 'Non ho trovato movimenti nel file. Prova con il formato CSV.'; esito.className = 'esito ko'; return; }
      const catena = catenaCorrente();
      const d = app.rapporto.dati;
      trovati.stipendi = abbinaStipendi(catena, movimenti, d.lavoratrice?.nome || '');
      const inpsAperte = generaScadenze(d, catena, oggiIso(), app.fatte).filter((s) => s.chiave.startsWith('inps-') && /T\d$/.test(s.chiave));
      trovati.inps = abbinaContributi(inpsAperte, movimenti);
      const periodo = movimenti.map((m) => m.data).sort();
      esito.textContent = `${movimenti.length} movimenti dal ${dataIt(periodo[0])} al ${dataIt(periodo[periodo.length - 1])}.`;
      const tot = trovati.stipendi.length + trovati.inps.length;
      if (!tot) { ris.innerHTML = '<div class="avviso info">Nessun pagamento da abbinare: i cedolini confermati e i contributi aperti non hanno un movimento con lo stesso importo.</div>'; return; }
      ris.innerHTML = `<ul class="lista-abbinamenti">
        ${trovati.stipendi.map((x, i) => `<li><label class="spunta"><input type="checkbox" data-s="${i}" ${x.sicuro ? 'checked' : ''} />
          <span><strong>Stipendio ${nomeMeseMaiusc(x.mese).toLowerCase()} ${x.anno} · ${eur(x.importo)}</strong><br>
          <small>${dataIt(x.movimento.data)} · ${esc(x.movimento.descrizione.slice(0, 80))}${x.sicuro ? '' : ' · da controllare'}</small></span></label></li>`).join('')}
        ${trovati.inps.map((x, i) => `<li><label class="spunta"><input type="checkbox" data-i="${i}" checked />
          <span><strong>${esc(x.titolo)} · ${eur(x.importo)}</strong><br><small>${dataIt(x.movimento.data)} · ${esc(x.movimento.descrizione.slice(0, 80))}</small></span></label></li>`).join('')}
      </ul><p class="nota">Spunta solo quelli che riconosci: verranno segnati come pagati con la data del movimento.</p>`;
      conferma.hidden = false;
    } catch (err) {
      esito.textContent = `Non riesco a leggere il file: ${err.message}`;
      esito.className = 'esito ko';
    }
  });

  conferma.addEventListener('click', async () => {
    conferma.disabled = true;
    let n = 0;
    try {
      const catena = catenaCorrente();
      for (const el of ris.querySelectorAll('input[data-s]:checked')) {
        const x = trovati.stipendi[Number(el.dataset.s)];
        const m = catena.find((c) => c.anno === x.anno && c.mese === x.mese);
        if (!m?.salvato) continue;
        await salvaCedolino(app.rapporto.id, { anno: x.anno, mese: x.mese, presenze: m.salvato.presenze, risultato: m.salvato.risultato || m.risultato, stato: 'pagato', pagato_at: x.movimento.data });
        n++;
      }
      for (const el of ris.querySelectorAll('input[data-i]:checked')) {
        const x = trovati.inps[Number(el.dataset.i)];
        const [, anno, q] = x.chiave.match(/inps-(\d{4})-T(\d)/);
        await salvaVersamento(app.rapporto.id, { anno: Number(anno), trimestre: Number(q), data_pagamento: x.movimento.data, importo: x.importo, nota: 'Abbinato dall\'estratto conto' });
        await segnaScadenza(app.rapporto.id, x.chiave, true);
        n++;
      }
      dlg.close();
      toast(n ? `${n} ${n === 1 ? 'pagamento segnato' : 'pagamenti segnati'}` : 'Nessun pagamento selezionato');
      if (n) await dopo?.();
    } catch (err) {
      esito.textContent = `Errore: ${err.message}`;
      esito.className = 'esito ko';
    } finally {
      conferma.disabled = false;
    }
  });
  dlg.showModal();
}

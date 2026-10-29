// Tabelle annuali modificabili: minimi CCNL, contributi INPS, Cassa Colf, inflazione per il TFR.
import { app, puoModificare, esc, oggiIso, toast } from '../stato.js';
import { TABELLE, tutteLeTabelle, impostaTabellePersonalizzate } from '../engine/tabelle.js';
import { salvaTabelle, eliminaTabelle, caricaTabelle } from '../lib/dati.js';
import { fmtNum } from '../engine/formato.js';

const LIVELLI = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
const MENSILI = ['minimiMensiliConviventi', 'indennitaFunzione', 'minimiMensiliConviventiPT', 'minimiAssistenzaNotturna', 'minimoPresenzaNotturna', 'vittoAlloggio'];
const GRUPPI_MENSILI = [
  ['minimiMensiliConviventi', 'Conviventi a tempo pieno, mensili (€)', LIVELLI],
  ['indennitaFunzione', 'Indennità di funzione conviventi (€)', ['D', 'DS']],
  ['minimiMensiliConviventiPT', 'Conviventi part-time fino a 30 h, mensili (€)', ['B', 'BS', 'C']],
  ['minimiAssistenzaNotturna', 'Assistenza notturna, mensili (€)', ['BS', 'CS', 'DS']],
];
const n = (v, dec = 2) => (v == null || v === '' ? '' : fmtNum(v, dec).replace(/\./g, ''));
const leggiNum = (s) => {
  const x = String(s ?? '').trim().replace(/\./g, '').replace(',', '.');
  return x === '' ? null : Number(x);
};

let annoScelto = null;

export function mostraTabelle(root, ctx) {
  const mod = puoModificare();
  const annoOggi = Number(oggiIso().slice(0, 4));
  const tutte = tutteLeTabelle();
  let anni = Object.keys(tutte).map(Number).sort((a, b) => b - a);
  let anno = anni.includes(annoScelto) ? annoScelto : anni.includes(annoOggi) ? annoOggi : anni[0];
  let bozza = null; // tabelle del nuovo anno non ancora salvate

  const disegna = () => {
    const base = bozza?.anno === anno ? bozza : tutte[anno];
    // le voci per conviventi e notturni mancanti si completano con i valori inclusi nell'app
    const incluso = TABELLE[Math.max(...Object.keys(TABELLE).map(Number))];
    const t = structuredClone({ ...Object.fromEntries(MENSILI.map((k) => [k, incluso[k]])), ...base });
    const personal = !TABELLE[anno] || JSON.stringify(TABELLE[anno]) !== JSON.stringify(base);
    const fasce = (tipo) => t.inps[tipo].fasce.map((f, i) => `
      <tr>
        <td>${i === 0 ? 'fino a' : i === 1 ? 'fino a' : 'oltre'} ${i < 2 ? `<input data-k="${tipo}.${i}.fino" value="${n(f.fino)}" inputmode="decimal" class="mini" />` : `${n(t.inps[tipo].fasce[1].fino)} €`}</td>
        <td><input data-k="${tipo}.${i}.conCuaf" value="${n(f.conCuaf)}" inputmode="decimal" class="mini" /></td>
        <td><input data-k="${tipo}.${i}.senzaCuaf" value="${n(f.senzaCuaf)}" inputmode="decimal" class="mini" /></td>
        <td><input data-k="${tipo}.${i}.lavoratore" value="${n(f.lavoratore)}" inputmode="decimal" class="mini" /></td>
      </tr>`).join('') + `
      <tr>
        <td>oltre 24 h/sett.</td>
        <td><input data-k="${tipo}.oltre24.conCuaf" value="${n(t.inps[tipo].oltre24.conCuaf)}" inputmode="decimal" class="mini" /></td>
        <td><input data-k="${tipo}.oltre24.senzaCuaf" value="${n(t.inps[tipo].oltre24.senzaCuaf)}" inputmode="decimal" class="mini" /></td>
        <td><input data-k="${tipo}.oltre24.lavoratore" value="${n(t.inps[tipo].oltre24.lavoratore)}" inputmode="decimal" class="mini" /></td>
      </tr>`;

    root.innerHTML = `
      <section class="card">
        <div class="card-testa">
          <h2>Tabelle dell'anno</h2>
          <div class="riga stretta">
            <select name="anno">${anni.map((a) => `<option ${a === anno ? 'selected' : ''}>${a}</option>`).join('')}</select>
            ${mod ? '<button type="button" class="secondario nuovo-anno">+ Nuovo anno</button>' : ''}
          </div>
        </div>
        <p class="nota">${bozza?.anno === anno ? `Nuove tabelle ${anno}, copiate dal ${anno - 1}: aggiorna i valori e salva.` : personal ? 'Valori inseriti nell\'app.' : 'Valori inclusi nell\'app (fonti ufficiali).'}
          Ogni anno a gennaio-febbraio escono i nuovi minimi CCNL e la circolare INPS sui contributi del lavoro domestico.</p>
        <form class="form-tabelle">
          <fieldset ${mod ? '' : 'disabled'} class="tutto">
          <h3 class="sottotitolo">Minimi orari lavoratori non conviventi (€)</h3>
          <div class="griglia-livelli">
            ${LIVELLI.map((l) => `<label>${l}<input data-k="min.${l}" value="${n(t.minimiOrariNonConviventi[l])}" inputmode="decimal" placeholder="—" /></label>`).join('')}
          </div>

          <details class="dettagli-tabelle">
            <summary>Conviventi, notturni, vitto e alloggio</summary>
            ${GRUPPI_MENSILI.map(([k, titolo, livelli]) => `
              <h3 class="sottotitolo">${titolo}</h3>
              <div class="griglia-livelli">${livelli.map((l) => `<label>${l}<input data-k="${k}.${l}" value="${n(t[k]?.[l])}" inputmode="decimal" placeholder="—" /></label>`).join('')}</div>`).join('')}
            <div class="riga">
              <label>Presenza notturna, mensile (€)<input data-k="presenza" value="${n(t.minimoPresenzaNotturna)}" inputmode="decimal" /></label>
            </div>
            <h3 class="sottotitolo">Indennità giornaliera di vitto e alloggio (€)</h3>
            <div class="griglia-livelli">
              <label>Pranzo/colazione<input data-k="va.pranzoColazione" value="${n(t.vittoAlloggio?.pranzoColazione)}" inputmode="decimal" /></label>
              <label>Cena<input data-k="va.cena" value="${n(t.vittoAlloggio?.cena)}" inputmode="decimal" /></label>
              <label>Alloggio<input data-k="va.alloggio" value="${n(t.vittoAlloggio?.alloggio)}" inputmode="decimal" /></label>
            </div>
          </details>

          <h3 class="sottotitolo">Contributi INPS orari – tempo indeterminato (€)</h3>
          <div class="tab-scorre"><table class="tab-tabelle">
            <thead><tr><th>Retribuzione oraria effettiva</th><th>con CUAF</th><th>senza CUAF</th><th>di cui lavoratrice</th></tr></thead>
            <tbody>${fasce('indeterminato')}</tbody>
          </table></div>

          <h3 class="sottotitolo">Contributi INPS orari – tempo determinato (€)</h3>
          <div class="tab-scorre"><table class="tab-tabelle">
            <thead><tr><th>Retribuzione oraria effettiva</th><th>con CUAF</th><th>senza CUAF</th><th>di cui lavoratrice</th></tr></thead>
            <tbody>${fasce('determinato')}</tbody>
          </table></div>

          <div class="riga">
            <label>Cassa Colf – datore (€/h)<input data-k="cc.datore" value="${n(t.cassaColf?.datore)}" inputmode="decimal" /></label>
            <label>Cassa Colf – lavoratrice (€/h)<input data-k="cc.lavoratore" value="${n(t.cassaColf?.lavoratore)}" inputmode="decimal" /></label>
          </div>
          <label>Inflazione ISTAT dicembre su dicembre per la rivalutazione del TFR (%)
            <input data-k="infl" value="${t.inflazioneTfr == null ? '' : n(t.inflazioneTfr * 100, 1)}" inputmode="decimal" placeholder="non ancora pubblicata" /></label>
          <label>Fonti (es. numero della circolare INPS)<input data-k="fonti" value="${esc((t.fonti || []).join(' · '))}" /></label>
          </fieldset>
          ${mod ? `<div class="azioni-mese">
            <button type="submit" class="primario">Salva tabelle ${anno}</button>
            ${personal && TABELLE[anno] ? '<button type="button" class="link ko ripristina">Torna ai valori inclusi</button>' : ''}
          </div>` : ''}
        </form>
      </section>`;

    root.querySelector('[name=anno]').addEventListener('change', (e) => { anno = Number(e.target.value); annoScelto = anno; disegna(); });
    root.querySelector('.nuovo-anno')?.addEventListener('click', () => {
      const prossimo = Math.max(...anni) + 1;
      bozza = structuredClone(tutte[Math.max(...anni)]);
      bozza.anno = prossimo;
      bozza.inflazioneTfr = null;
      bozza.fonti = [];
      anni = [prossimo, ...anni];
      anno = prossimo;
      disegna();
    });
    root.querySelector('.ripristina')?.addEventListener('click', async () => {
      if (!confirm(`Eliminare i valori ${anno} inseriti e tornare a quelli inclusi nell'app?`)) return;
      try {
        await eliminaTabelle(app.rapporto.id, anno);
        await ricarica();
        toast('Valori ripristinati');
        mostraTabelle(root, ctx);
      } catch (e) { toast(`Errore: ${e.message}`, 'ko'); }
    });
    root.querySelector('.form-tabelle').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = (k) => leggiNum(root.querySelector(`[data-k="${k}"]`)?.value);
      const nuovo = structuredClone(t);
      nuovo.anno = anno;
      for (const l of LIVELLI) {
        const x = v(`min.${l}`);
        if (x == null) delete nuovo.minimiOrariNonConviventi[l]; else nuovo.minimiOrariNonConviventi[l] = x;
      }
      for (const tipo of ['indeterminato', 'determinato']) {
        nuovo.inps[tipo].fasce.forEach((f, i) => {
          if (i < 2) f.fino = v(`${tipo}.${i}.fino`);
          f.conCuaf = v(`${tipo}.${i}.conCuaf`); f.senzaCuaf = v(`${tipo}.${i}.senzaCuaf`); f.lavoratore = v(`${tipo}.${i}.lavoratore`);
          f.conv = f.conv ?? null;
        });
        nuovo.inps[tipo].fasce[2].fino = null; // illimitata
        for (const c of ['conCuaf', 'senzaCuaf', 'lavoratore']) nuovo.inps[tipo].oltre24[c] = v(`${tipo}.oltre24.${c}`);
      }
      for (const [k, , livelli] of GRUPPI_MENSILI) {
        nuovo[k] = {};
        for (const l of livelli) { const x = v(`${k}.${l}`); if (x != null) nuovo[k][l] = x; }
      }
      nuovo.minimoPresenzaNotturna = v('presenza');
      const va = { pranzoColazione: v('va.pranzoColazione') ?? 0, cena: v('va.cena') ?? 0, alloggio: v('va.alloggio') ?? 0 };
      nuovo.vittoAlloggio = { ...va, totale: Math.round((va.pranzoColazione + va.cena + va.alloggio) * 100) / 100 };
      nuovo.cassaColf = { datore: v('cc.datore') ?? 0, lavoratore: v('cc.lavoratore') ?? 0 };
      const infl = v('infl');
      nuovo.inflazioneTfr = infl == null ? null : infl / 100;
      nuovo.fonti = root.querySelector('[data-k=fonti]').value.split('·').map((s) => s.trim()).filter(Boolean);
      const errori = [];
      for (const tipo of ['indeterminato', 'determinato']) {
        const f = nuovo.inps[tipo].fasce;
        if ([f[0].fino, f[1].fino].some((x) => !(x > 0)) || f[0].fino >= f[1].fino) errori.push(`Limiti delle fasce (${tipo}) non validi`);
        if (f.some((x) => !(x.conCuaf > 0) || !(x.lavoratore >= 0) || x.lavoratore >= x.conCuaf)) errori.push(`Contributi (${tipo}) mancanti o incoerenti`);
      }
      if (errori.length) { toast(errori[0], 'ko'); return; }
      try {
        await salvaTabelle(app.rapporto.id, anno, nuovo);
        bozza = null;
        annoScelto = anno;
        await ricarica();
        toast(`Tabelle ${anno} salvate: i cedolini in bozza sono già ricalcolati`);
        mostraTabelle(root, ctx);
      } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
    });
  };

  const ricarica = async () => impostaTabellePersonalizzate(await caricaTabelle(app.rapporto.id));
  disegna();
}

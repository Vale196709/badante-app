// Scheda del rapporto di lavoro: anagrafica e condizioni contrattuali, salvate sul cloud.
import { caricaRapporto, salvaRapporto } from '../lib/dati.js';
import { verificaCodiceFiscale } from '../lib/codiceFiscale.js';
import { fasciaContributiva, oreSettimanali, simulaCosto } from '../engine/calcolo.js';
import { TABELLE } from '../engine/tabelle.js';

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const LIVELLI = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
const VUOTO = {
  datore: { nome: '', cf: '' },
  lavoratrice: { nome: '', cf: '' },
  livello: 'B',
  tipoContratto: 'indeterminato',
  pagaOraria: 9,
  orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
  dataAssunzione: '',
  tredicesimaMensile: false,
  cuaf: true,
  cassaColf: true,
};
const eur = (n) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function mostraRapporto(root) {
  root.innerHTML = `<p class="caricamento">Caricamento dati…</p>`;
  let record;
  try {
    record = await caricaRapporto();
  } catch (e) {
    root.innerHTML = `<p class="errore">Impossibile leggere i dati: ${esc(e.message)}</p>`;
    return;
  }
  const d = structuredClone(record?.dati ?? VUOTO);
  let id = record?.id ?? null;

  root.innerHTML = `
    <form id="f-rapporto" class="scheda" novalidate>
      <section>
        <h2>Datore di lavoro</h2>
        <label>Nome e cognome<input name="datoreNome" value="${esc(d.datore.nome)}" autocomplete="name" /></label>
        <label>Codice fiscale<input name="datoreCf" value="${esc(d.datore.cf)}" maxlength="16" class="maiuscolo" autocapitalize="characters" /></label>
        <small class="cf" data-for="datoreCf"></small>
      </section>

      <section>
        <h2>Lavoratrice</h2>
        <label>Nome e cognome<input name="lavNome" value="${esc(d.lavoratrice.nome)}" /></label>
        <label>Codice fiscale<input name="lavCf" value="${esc(d.lavoratrice.cf)}" maxlength="16" class="maiuscolo" autocapitalize="characters" placeholder="Da inserire" /></label>
        <small class="cf" data-for="lavCf"></small>
      </section>

      <section>
        <h2>Contratto</h2>
        <div class="riga">
          <label>Livello CCNL
            <select name="livello">${LIVELLI.map((l) => `<option ${l === d.livello ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </label>
          <label>Tipo
            <select name="tipoContratto">
              <option value="indeterminato" ${d.tipoContratto === 'indeterminato' ? 'selected' : ''}>Tempo indeterminato</option>
              <option value="determinato" ${d.tipoContratto === 'determinato' ? 'selected' : ''}>Tempo determinato</option>
            </select>
          </label>
        </div>
        <div class="riga">
          <label>Paga oraria lorda (€)<input name="pagaOraria" type="number" step="0.01" min="0" inputmode="decimal" value="${d.pagaOraria}" /></label>
          <label>Data di assunzione<input name="dataAssunzione" type="date" value="${esc(d.dataAssunzione)}" /></label>
        </div>
        <fieldset>
          <legend>Ore per giorno</legend>
          <div class="giorni">
            ${GIORNI.map((g, i) => `<label class="giorno">${g}<input name="g${i + 1}" type="number" min="0" max="12" step="0.5" inputmode="decimal" value="${d.orario[i + 1] ?? 0}" /></label>`).join('')}
          </div>
        </fieldset>
        <label class="spunta"><input type="checkbox" name="tredicesimaMensile" ${d.tredicesimaMensile ? 'checked' : ''} /> Tredicesima pagata ogni mese (invece che a dicembre)</label>
        <label class="spunta"><input type="checkbox" name="cassaColf" ${d.cassaColf !== false ? 'checked' : ''} /> Iscrizione Cassa Colf</label>
        <label class="spunta"><input type="checkbox" name="parente" ${d.cuaf === false ? 'checked' : ''} /> Lavoratrice coniuge o parente convivente (niente quota CUAF)</label>
      </section>

      <section class="riepilogo" aria-live="polite"></section>

      <div class="azioni">
        <p class="esito" role="status"></p>
        <button type="submit" class="primario">Salva</button>
      </div>
    </form>`;

  const f = root.querySelector('#f-rapporto');
  const riep = root.querySelector('.riepilogo');
  const esito = root.querySelector('.esito');

  const leggi = () => ({
    datore: { nome: f.datoreNome.value.trim(), cf: f.datoreCf.value.trim().toUpperCase() },
    lavoratrice: { nome: f.lavNome.value.trim(), cf: f.lavCf.value.trim().toUpperCase() },
    livello: f.livello.value,
    tipoContratto: f.tipoContratto.value,
    pagaOraria: Number(f.pagaOraria.value) || 0,
    orario: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((g) => [g, Number(f[`g${g}`].value) || 0]).filter(([, h]) => h > 0)),
    dataAssunzione: f.dataAssunzione.value,
    tredicesimaMensile: f.tredicesimaMensile.checked,
    cassaColf: f.cassaColf.checked,
    cuaf: !f.parente.checked,
  });

  const aggiorna = () => {
    const v = leggi();
    for (const el of root.querySelectorAll('small.cf')) {
      const val = f[el.dataset.for].value.trim();
      if (!val) { el.textContent = ''; el.className = 'cf'; continue; }
      const r = verificaCodiceFiscale(val);
      el.textContent = r.ok ? '✓ Codice fiscale valido' : `✗ ${r.msg}`;
      el.className = `cf ${r.ok ? 'ok' : 'ko'}`;
    }
    const anno = Math.min(Math.max(...Object.keys(TABELLE).map(Number)), new Date().getFullYear());
    const sett = oreSettimanali(v.orario);
    if (!v.pagaOraria || !sett) { riep.innerHTML = ''; return; }
    const minimo = TABELLE[anno].minimiOrariNonConviventi[v.livello];
    const fascia = fasciaContributiva(v, anno);
    const sim = simulaCosto({ pagaOraria: v.pagaOraria, oreSettimanaliTot: sett, anno, tipoContratto: v.tipoContratto, cuaf: v.cuaf, cassaColf: v.cassaColf });
    riep.innerHTML = `
      <h2>In sintesi (${anno})</h2>
      <dl>
        <div><dt>Ore settimanali</dt><dd>${sett}</dd></div>
        <div><dt>Minimo livello ${v.livello}</dt><dd>${minimo ? `${eur(minimo)}/h ${v.pagaOraria >= minimo ? '✓' : '<strong class="ko">sotto il minimo</strong>'}` : 'da verificare'}</dd></div>
        <div><dt>Contributi INPS</dt><dd>${eur(fascia.totaleOrario)}/h, di cui ${eur(fascia.datoreOrario)} a tuo carico</dd></div>
        <div><dt>Costo medio mensile</dt><dd><strong>${eur(sim.costoMensile)}</strong></dd></div>
        <div><dt>Netto medio alla lavoratrice</dt><dd>${eur(sim.nettoMedioLavoratrice)}</dd></div>
        <div><dt>Versamento INPS trimestrale</dt><dd>${eur(sim.versamentoTrimestraleInps)}</dd></div>
      </dl>
      <p class="nota">${fascia.nome}. Il costo comprende paga, 13ª, contributi a tuo carico e TFR.</p>`;
  };

  f.addEventListener('input', () => { esito.textContent = ''; aggiorna(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    esito.textContent = 'Salvataggio…';
    esito.className = 'esito';
    try {
      const salvato = await salvaRapporto(id, leggi());
      id = salvato.id;
      esito.textContent = `Salvato alle ${new Date(salvato.updated_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
      esito.className = 'esito ok';
    } catch (err) {
      esito.textContent = `Errore: ${err.message}`;
      esito.className = 'esito ko';
    } finally {
      btn.disabled = false;
    }
  });
  aggiorna();
}

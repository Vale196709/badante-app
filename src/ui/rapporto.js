// Scheda del rapporto di lavoro: anagrafica e condizioni contrattuali, salvate sul cloud.
import { salvaRapporto } from '../lib/dati.js';
import { verificaCodiceFiscale } from '../lib/codiceFiscale.js';
import { fasciaContributiva, oreSettimanali, simulaCosto } from '../engine/calcolo.js';
import { tabelleAnno } from '../engine/tabelle.js';
import { app, puoModificare, eur, esc, oggiIso, toast } from '../stato.js';

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const LIVELLI = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
export const RAPPORTO_VUOTO = {
  datore: { nome: '', cf: '', indirizzo: '' },
  lavoratrice: { nome: '', cf: '', nascita: '', indirizzo: '' },
  livello: 'B',
  mansioni: 'Collaboratrice familiare: pulizia e riordino della casa, lavanderia e stiro, preparazione dei pasti',
  luogoLavoro: '',
  tipoContratto: 'indeterminato',
  dataFineTermine: '',
  pagaOraria: 9,
  orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
  fasciaOraria: '09:00–12:00',
  dataAssunzione: '',
  giorniProva: 8,
  dataCessazione: '',
  tredicesimaMensile: false,
  cuaf: true,
  cassaColf: true,
  scadenzaDocumento: '',
  codiceRapportoInps: '',
};

const campo = (etichetta, nome, valore, attr = '') =>
  `<label>${etichetta}<input name="${nome}" value="${esc(valore)}" ${attr} /></label>`;

export async function mostraRapporto(root, { ricaricaDati, vai }) {
  const mod = puoModificare();
  const d = { ...structuredClone(RAPPORTO_VUOTO), ...structuredClone(app.rapporto?.dati ?? {}) };
  d.datore = { ...RAPPORTO_VUOTO.datore, ...d.datore };
  d.lavoratrice = { ...RAPPORTO_VUOTO.lavoratrice, ...d.lavoratrice };
  const nuovo = !app.rapporto?.dati;

  root.innerHTML = `
    ${nuovo ? '<div class="avviso info"><strong>Benvenuto.</strong> Inserisci i dati del rapporto di lavoro e premi Salva: da qui partono cedolini, scadenze e documenti.</div>' : ''}
    <form id="f-rapporto" class="scheda" novalidate>
      <fieldset ${mod ? '' : 'disabled'} class="tutto">
      <section>
        <h2>Datore di lavoro</h2>
        ${campo('Nome e cognome', 'datoreNome', d.datore.nome, 'autocomplete="name"')}
        ${campo('Codice fiscale', 'datoreCf', d.datore.cf, 'maxlength="16" class="maiuscolo" autocapitalize="characters"')}
        <small class="cf" data-for="datoreCf"></small>
        ${campo('Indirizzo di residenza', 'datoreIndirizzo', d.datore.indirizzo)}
      </section>

      <section>
        <h2>Lavoratrice</h2>
        ${campo('Nome e cognome', 'lavNome', d.lavoratrice.nome)}
        ${campo('Codice fiscale', 'lavCf', d.lavoratrice.cf, 'maxlength="16" class="maiuscolo" autocapitalize="characters" placeholder="Da inserire"')}
        <small class="cf" data-for="lavCf"></small>
        ${campo('Luogo e data di nascita', 'lavNascita', d.lavoratrice.nascita, 'placeholder="es. Chișinău, 12/03/1975"')}
        ${campo('Indirizzo di residenza', 'lavIndirizzo', d.lavoratrice.indirizzo)}
        <label>Scadenza documento di soggiorno (se previsto)<input name="scadenzaDocumento" type="date" value="${esc(d.scadenzaDocumento)}" /></label>
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
        <label class="solo-termine">Fine del contratto a termine<input name="dataFineTermine" type="date" value="${esc(d.dataFineTermine)}" /></label>
        <label>Mansioni<input name="mansioni" value="${esc(d.mansioni)}" /></label>
        ${campo('Luogo di lavoro (indirizzo)', 'luogoLavoro', d.luogoLavoro, 'placeholder="se diverso dalla residenza del datore"')}
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
        <div class="riga">
          ${campo('Fascia oraria abituale', 'fasciaOraria', d.fasciaOraria, 'placeholder="es. 09:00–12:00"')}
          <label>Periodo di prova (giorni di lavoro)<input name="giorniProva" type="number" min="0" max="60" value="${d.giorniProva}" /></label>
        </div>
        <label class="spunta"><input type="checkbox" name="tredicesimaMensile" ${d.tredicesimaMensile ? 'checked' : ''} /> Tredicesima pagata ogni mese (invece che a dicembre)</label>
        <label class="spunta"><input type="checkbox" name="cassaColf" ${d.cassaColf !== false ? 'checked' : ''} /> Iscrizione Cassa Colf</label>
        <label class="spunta"><input type="checkbox" name="parente" ${d.cuaf === false ? 'checked' : ''} /> Lavoratrice coniuge o parente convivente (niente quota CUAF)</label>
      </section>

      <section>
        <h2>INPS e fine rapporto</h2>
        ${campo('Codice rapporto INPS', 'codiceRapportoInps', d.codiceRapportoInps, 'placeholder="dalla ricevuta di assunzione INPS"')}
        <label>Data di cessazione<input name="dataCessazione" type="date" value="${esc(d.dataCessazione)}" /></label>
        <small class="nota">Da compilare solo quando il rapporto finisce: i calcoli si fermano a quella data. I conteggi di fine rapporto sono nel Simulatore.</small>
      </section>
      </fieldset>

      <section class="riepilogo" aria-live="polite"></section>

      ${mod ? `<div class="azioni">
        <p class="esito" role="status"></p>
        <button type="submit" class="primario">Salva</button>
      </div>` : '<p class="nota centro">Hai un accesso in sola lettura.</p>'}
    </form>`;

  const f = root.querySelector('#f-rapporto');
  const riep = root.querySelector('.riepilogo');
  const esito = root.querySelector('.esito');
  const termine = root.querySelector('.solo-termine');

  const leggi = () => ({
    ...d,
    datore: { nome: f.datoreNome.value.trim(), cf: f.datoreCf.value.trim().toUpperCase(), indirizzo: f.datoreIndirizzo.value.trim() },
    lavoratrice: { nome: f.lavNome.value.trim(), cf: f.lavCf.value.trim().toUpperCase(), nascita: f.lavNascita.value.trim(), indirizzo: f.lavIndirizzo.value.trim() },
    livello: f.livello.value,
    mansioni: f.mansioni.value.trim(),
    luogoLavoro: f.luogoLavoro.value.trim(),
    tipoContratto: f.tipoContratto.value,
    dataFineTermine: f.tipoContratto.value === 'determinato' ? f.dataFineTermine.value : '',
    pagaOraria: Number(f.pagaOraria.value) || 0,
    orario: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((g) => [g, Number(f[`g${g}`].value) || 0]).filter(([, h]) => h > 0)),
    fasciaOraria: f.fasciaOraria.value.trim(),
    dataAssunzione: f.dataAssunzione.value,
    giorniProva: Number(f.giorniProva.value) || 0,
    tredicesimaMensile: f.tredicesimaMensile.checked,
    cassaColf: f.cassaColf.checked,
    cuaf: !f.parente.checked,
    scadenzaDocumento: f.scadenzaDocumento.value,
    codiceRapportoInps: f.codiceRapportoInps.value.trim(),
    dataCessazione: f.dataCessazione.value,
  });

  const aggiorna = () => {
    const v = leggi();
    termine.hidden = v.tipoContratto !== 'determinato';
    for (const el of root.querySelectorAll('small.cf')) {
      const val = f[el.dataset.for].value.trim();
      if (!val) { el.textContent = ''; el.className = 'cf'; continue; }
      const r = verificaCodiceFiscale(val);
      el.textContent = r.ok ? '✓ Codice fiscale valido' : `✗ ${r.msg}`;
      el.className = `cf ${r.ok ? 'ok' : 'ko'}`;
    }
    const anno = Number(oggiIso().slice(0, 4));
    const t = tabelleAnno(anno);
    const sett = oreSettimanali(v.orario);
    if (!v.pagaOraria || !sett) { riep.innerHTML = ''; return; }
    const minimo = t.minimiOrariNonConviventi[v.livello];
    const fascia = fasciaContributiva(v, anno);
    const sim = simulaCosto({ pagaOraria: v.pagaOraria, oreSettimanaliTot: sett, anno, tipoContratto: v.tipoContratto, cuaf: v.cuaf, cassaColf: v.cassaColf });
    riep.innerHTML = `
      <h2>In sintesi (${anno}${t.provvisorie ? `, valori ${t.annoTabelle}` : ''})</h2>
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

  f.addEventListener('input', () => { if (esito) esito.textContent = ''; aggiorna(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = leggi();
    if (!v.dataAssunzione) { esito.textContent = 'Inserisci la data di assunzione.'; esito.className = 'esito ko'; return; }
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    esito.textContent = 'Salvataggio…';
    esito.className = 'esito';
    try {
      const salvato = await salvaRapporto(app.rapporto?.id, v);
      app.rapporto = { ...app.rapporto, ...salvato, ruolo: app.rapporto?.ruolo ?? 'titolare' };
      await ricaricaDati();
      toast('Dati del rapporto salvati');
      if (nuovo) location.reload();
      else esito.textContent = '';
    } catch (err) {
      esito.textContent = `Errore: ${err.message}`;
      esito.className = 'esito ko';
    } finally {
      btn.disabled = false;
    }
  });
  aggiorna();
}

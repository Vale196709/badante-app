// Scheda del rapporto di lavoro: anagrafica e condizioni contrattuali, salvate sul cloud.
import { salvaRapporto } from '../lib/dati.js';
import { verificaCodiceFiscale } from '../lib/codiceFiscale.js';
import { fasciaContributiva, oreSettimanali, simulaCosto, normalizzaRapporto } from '../engine/calcolo.js';
import { tabelleAnno, TIPOLOGIE, tipologia, minimoContrattuale } from '../engine/tabelle.js';
import { verificaIban, formattaIban } from '../lib/iban.js';
import { verificaAgevolazioni } from '../engine/annuale.js';
import { app, puoModificare, eur, esc, oggiIso, toast } from '../stato.js';

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const LIVELLI = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
export const RAPPORTO_VUOTO = {
  datore: { nome: '', cf: '', indirizzo: '', cap: '', citta: '', provincia: '' },
  lavoratrice: { nome: '', cf: '', nascita: '', indirizzo: '', cap: '', citta: '', provincia: '' },
  livello: 'B',
  mansioni: 'Collaboratrice familiare: pulizia e riordino della casa, lavanderia e stiro, preparazione dei pasti',
  luogoLavoro: '',
  tipoContratto: 'indeterminato',
  dataFineTermine: '',
  tipologia: 'ore',
  pagaOraria: 9,
  pagaMensile: 0,
  vittoAlloggio: false,
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
  pagamento: { iban: '', intestatario: '', modalita: 'bonifico' },
  budgetAnnuo: null,
  detrazione: { assistito: '', nonAutosufficiente: false, redditoEntroLimite: false },
  agevolazioni: { over80: false, accompagnamento: false, iseeEntroLimite: false, prestazioneUniversale: false },
  documentiAssistito: { revisioneInvalidita: '', certificatoNonAutosufficienza: '', altroNome: '', altroData: '' },
};

const campiLocalita = (pre, p) => `
        <div class="riga localita">
          <label class="cap">CAP<input name="${pre}Cap" value="${esc(p.cap || '')}" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" autocomplete="postal-code" /></label>
          <label class="citta">Città<input name="${pre}Citta" value="${esc(p.citta || '')}" autocomplete="address-level2" /></label>
          <label class="prov">Provincia<input name="${pre}Provincia" value="${esc(p.provincia || '')}" maxlength="2" class="maiuscolo" autocapitalize="characters" placeholder="RM" /></label>
        </div>`;

const campo = (etichetta, nome, valore, attr = '') =>
  `<label>${etichetta}<input name="${nome}" value="${esc(valore)}" ${attr} /></label>`;

export async function mostraRapporto(root, { ricaricaDati, vai }) {
  const mod = puoModificare();
  const prefill = !app.rapporto?.dati ? app.bozzaRapporto : null; // es. sostituta preparata dal calendario ferie
  const d = { ...structuredClone(RAPPORTO_VUOTO), ...structuredClone(app.rapporto?.dati ?? prefill ?? {}) };
  d.datore = { ...RAPPORTO_VUOTO.datore, ...d.datore };
  d.lavoratrice = { ...RAPPORTO_VUOTO.lavoratrice, ...d.lavoratrice };
  d.pagamento = { ...RAPPORTO_VUOTO.pagamento, ...d.pagamento };
  d.detrazione = { ...RAPPORTO_VUOTO.detrazione, ...d.detrazione };
  d.agevolazioni = { ...RAPPORTO_VUOTO.agevolazioni, ...d.agevolazioni };
  d.documentiAssistito = { ...RAPPORTO_VUOTO.documentiAssistito, ...d.documentiAssistito };
  const nuovo = !app.rapporto?.dati;

  root.innerHTML = `
    ${prefill ? `<div class="avviso info"><strong>Sostituta${prefill.sostituisce ? ` di ${esc(prefill.sostituisce)}` : ''}.</strong> Ho già inserito date, orario, paga e datore: completa i dati della lavoratrice e premi Salva. Ricordati la comunicazione di assunzione all'INPS entro il giorno prima dell'inizio.</div>` : ''}
    ${nuovo && !prefill ? '<div class="avviso info"><strong>Nuovo rapporto.</strong> Inserisci i dati e premi Salva: da qui partono cedolini, scadenze e documenti. Hai già un backup? Lo ripristini dalla scheda <button type="button" class="link vai-backup" style="padding:0">Backup</button>.</div>' : ''}
    <form id="f-rapporto" class="scheda" novalidate>
      <fieldset ${mod ? '' : 'disabled'} class="tutto">
      <section>
        <h2>Datore di lavoro</h2>
        ${campo('Nome e cognome', 'datoreNome', d.datore.nome, 'autocomplete="name"')}
        ${campo('Codice fiscale', 'datoreCf', d.datore.cf, 'maxlength="16" class="maiuscolo" autocapitalize="characters"')}
        <small class="cf" data-for="datoreCf"></small>
        ${campo('Indirizzo di residenza (via e numero civico)', 'datoreIndirizzo', d.datore.indirizzo, 'autocomplete="street-address"')}
        ${campiLocalita('datore', d.datore)}
      </section>

      <section>
        <h2>Lavoratrice</h2>
        ${campo('Nome e cognome', 'lavNome', d.lavoratrice.nome)}
        ${campo('Codice fiscale', 'lavCf', d.lavoratrice.cf, 'maxlength="16" class="maiuscolo" autocapitalize="characters" placeholder="Da inserire"')}
        <small class="cf" data-for="lavCf"></small>
        ${campo('Luogo e data di nascita', 'lavNascita', d.lavoratrice.nascita, 'placeholder="es. Chișinău, 12/03/1975"')}
        ${campo('Indirizzo di residenza (via e numero civico)', 'lavIndirizzo', d.lavoratrice.indirizzo)}
        ${campiLocalita('lav', d.lavoratrice)}
        <label>Scadenza documento di soggiorno (se previsto)<input name="scadenzaDocumento" type="date" value="${esc(d.scadenzaDocumento)}" /></label>
      </section>

      <section>
        <h2>Contratto all'assunzione</h2>
        ${(d.variazioni || []).length ? '<p class="nota" style="margin:-4px 0 12px">Le condizioni sono variate nel tempo: quelle in vigore sono in Impostazioni → Variazioni.</p>' : ''}
        <label>Tipo di rapporto
          <select name="tipologia">${Object.entries(TIPOLOGIE).map(([k, v]) => `<option value="${k}" ${k === (d.tipologia || 'ore') ? 'selected' : ''}>${v.nome}</option>`).join('')}</select>
        </label>
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
        <label class="spunta solo-termine-s"><input type="checkbox" name="sostituzione" ${d.sostituzione ? 'checked' : ''} /> Per sostituire una lavoratrice assente (niente contributo INPS aggiuntivo dei contratti a termine)</label>
        <label>Mansioni<input name="mansioni" value="${esc(d.mansioni)}" /></label>
        ${campo('Luogo di lavoro (indirizzo)', 'luogoLavoro', d.luogoLavoro, 'placeholder="se diverso dalla residenza del datore"')}
        <div class="riga">
          <label class="solo-ore">Paga oraria lorda (€)<input name="pagaOraria" type="number" step="0.01" min="0" inputmode="decimal" value="${d.pagaOraria}" /></label>
          <label class="solo-mensile">Retribuzione mensile lorda (€)<input name="pagaMensile" type="number" step="0.01" min="0" inputmode="decimal" value="${d.pagaMensile || ''}" placeholder="minimo proposto" /></label>
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
        <label class="spunta solo-mensile"><input type="checkbox" name="vittoAlloggio" ${d.vittoAlloggio ? 'checked' : ''} /> Vitto e alloggio forniti dal datore (entrano nel calcolo di 13ª, TFR e fascia INPS)</label>
        <label class="spunta"><input type="checkbox" name="tredicesimaMensile" ${d.tredicesimaMensile ? 'checked' : ''} /> Tredicesima pagata ogni mese (invece che a dicembre)</label>
        <label class="spunta"><input type="checkbox" name="scattiAnzianita" ${d.scattiAnzianita !== false ? 'checked' : ''} /> Scatti di anzianità (4% del minimo ogni 2 anni, fino a 7)</label>
        <label class="spunta"><input type="checkbox" name="cassaColf" ${d.cassaColf !== false ? 'checked' : ''} /> Iscrizione Cassa Colf</label>
        <label class="spunta"><input type="checkbox" name="parente" ${d.cuaf === false ? 'checked' : ''} /> Lavoratrice coniuge o parente convivente (niente quota CUAF)</label>
      </section>

      <section>
        <h2>Pagamento dello stipendio</h2>
        <label>Come paghi
          <select name="modalita">
            <option value="bonifico" ${d.pagamento.modalita === 'bonifico' ? 'selected' : ''}>Bonifico</option>
            <option value="altro" ${d.pagamento.modalita === 'altro' ? 'selected' : ''}>Assegno o carta</option>
            <option value="contanti" ${d.pagamento.modalita === 'contanti' ? 'selected' : ''}>Contanti</option>
          </select>
        </label>
        <small class="nota avviso-contanti">Pagando in contanti si perde la detrazione del 19% per la badante.</small>
        ${campo('IBAN della lavoratrice', 'iban', formattaIban(d.pagamento.iban), 'class="maiuscolo" autocapitalize="characters" autocomplete="off" placeholder="IT00 X000 0000 0000 0000 0000 000"')}
        <small class="cf iban-esito"></small>
        ${campo('Intestatario del conto', 'intestatario', d.pagamento.intestatario, 'placeholder="se diverso dalla lavoratrice"')}
      </section>

      <section>
        <h2>Budget e agevolazioni fiscali</h2>
        <label>Budget annuo per questo rapporto (€)<input name="budgetAnnuo" type="number" step="50" min="0" inputmode="decimal" value="${d.budgetAnnuo ?? ''}" placeholder="facoltativo" /></label>
        <small class="nota">Se la spesa prevista dell'anno lo supera, l'app ti avvisa nel Riepilogo e nel Report.</small>
        ${campo('Persona assistita', 'assistito', d.detrazione.assistito, 'placeholder="es. Maria Rossi"')}
        <label class="spunta"><input type="checkbox" name="nonAutosufficiente" ${d.detrazione.nonAutosufficiente ? 'checked' : ''} /> La persona assistita non è autosufficiente (c'è un certificato medico)</label>
        <label class="spunta"><input type="checkbox" name="redditoEntroLimite" ${d.detrazione.redditoEntroLimite ? 'checked' : ''} /> Il reddito di chi paga non supera 40.000 € l'anno</label>
        <small class="nota">Servono per calcolare la detrazione del 19% sulle spese per l'assistenza personale (fino a 2.100 € di spesa, cioè 399 € di sconto). I contributi INPS sono invece deducibili sempre, fino a 1.549,37 €.</small>
        <label class="spunta"><input type="checkbox" name="over80" ${d.agevolazioni.over80 ? 'checked' : ''} /> La persona assistita ha almeno 80 anni</label>
        <label class="spunta"><input type="checkbox" name="accompagnamento" ${d.agevolazioni.accompagnamento ? 'checked' : ''} /> Riceve l'indennità di accompagnamento</label>
        <label class="spunta"><input type="checkbox" name="iseeEntroLimite" ${d.agevolazioni.iseeEntroLimite ? 'checked' : ''} /> ISEE sociosanitario fino a 6.000 €</label>
        <label class="spunta"><input type="checkbox" name="prestazioneUniversale" ${d.agevolazioni.prestazioneUniversale ? 'checked' : ''} /> Riceve già la Prestazione universale (assegno di 850 € al mese)</label>
        <div class="verifica-agevolazioni"></div>
      </section>

      <section>
        <h2>Documenti della persona assistita</h2>
        <small class="nota">Le agevolazioni dipendono da documenti che scadono. L'app li mette tra le Scadenze due mesi prima. Il rinnovo dell'ISEE si ricorda da solo ogni gennaio se usi la Prestazione universale.</small>
        <label>Revisione dell'invalidità o dell'accompagnamento<input name="revisioneInvalidita" type="date" value="${esc(d.documentiAssistito.revisioneInvalidita)}" /></label>
        <label>Scadenza del certificato di non autosufficienza<input name="certificatoNonAutosufficienza" type="date" value="${esc(d.documentiAssistito.certificatoNonAutosufficienza)}" /></label>
        ${campo('Altro documento', 'altroDocNome', d.documentiAssistito.altroNome, 'placeholder="es. carta d\'identità, tessera sanitaria"')}
        <label>Scadenza dell'altro documento<input name="altroDocData" type="date" value="${esc(d.documentiAssistito.altroData)}" /></label>
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

  root.querySelector('.vai-backup')?.addEventListener('click', () => document.querySelector('.sotto-schede [data-k=backup]')?.click());
  const f = root.querySelector('#f-rapporto');
  const riep = root.querySelector('.riepilogo');
  const esito = root.querySelector('.esito');
  const termine = root.querySelector('.solo-termine');

  const leggiLocalita = (pre) => ({
    cap: f[`${pre}Cap`].value.replace(/\D/g, '').slice(0, 5),
    citta: f[`${pre}Citta`].value.trim(),
    provincia: f[`${pre}Provincia`].value.trim().toUpperCase().slice(0, 2),
  });
  const leggi = () => ({
    ...d,
    datore: { nome: f.datoreNome.value.trim(), cf: f.datoreCf.value.trim().toUpperCase(), indirizzo: f.datoreIndirizzo.value.trim(), ...leggiLocalita('datore') },
    lavoratrice: { nome: f.lavNome.value.trim(), cf: f.lavCf.value.trim().toUpperCase(), nascita: f.lavNascita.value.trim(), indirizzo: f.lavIndirizzo.value.trim(), ...leggiLocalita('lav') },
    livello: f.livello.value,
    mansioni: f.mansioni.value.trim(),
    luogoLavoro: f.luogoLavoro.value.trim(),
    tipoContratto: f.tipoContratto.value,
    dataFineTermine: f.tipoContratto.value === 'determinato' ? f.dataFineTermine.value : '',
    sostituzione: f.tipoContratto.value === 'determinato' && f.sostituzione.checked,
    tipologia: f.tipologia.value,
    pagaOraria: Number(f.pagaOraria.value) || 0,
    pagaMensile: Number(f.pagaMensile.value) || 0,
    vittoAlloggio: f.vittoAlloggio.checked,
    orario: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((g) => [g, Number(f[`g${g}`].value) || 0]).filter(([, h]) => h > 0)),
    fasciaOraria: f.fasciaOraria.value.trim(),
    dataAssunzione: f.dataAssunzione.value,
    giorniProva: Number(f.giorniProva.value) || 0,
    tredicesimaMensile: f.tredicesimaMensile.checked,
    cassaColf: f.cassaColf.checked,
    scattiAnzianita: f.scattiAnzianita.checked,
    cuaf: !f.parente.checked,
    scadenzaDocumento: f.scadenzaDocumento.value,
    codiceRapportoInps: f.codiceRapportoInps.value.trim(),
    dataCessazione: f.dataCessazione.value,
    pagamento: { modalita: f.modalita.value, iban: f.iban.value.replace(/\s+/g, '').toUpperCase(), intestatario: f.intestatario.value.trim() },
    budgetAnnuo: Number(f.budgetAnnuo.value) > 0 ? Number(f.budgetAnnuo.value) : null,
    detrazione: { assistito: f.assistito.value.trim(), nonAutosufficiente: f.nonAutosufficiente.checked, redditoEntroLimite: f.redditoEntroLimite.checked },
    agevolazioni: { over80: f.over80.checked, accompagnamento: f.accompagnamento.checked, iseeEntroLimite: f.iseeEntroLimite.checked, prestazioneUniversale: f.prestazioneUniversale.checked },
    documentiAssistito: { revisioneInvalidita: f.revisioneInvalidita.value, certificatoNonAutosufficienza: f.certificatoNonAutosufficienza.value, altroNome: f.altroDocNome.value.trim(), altroData: f.altroDocData.value },
  });

  let tipologiaPrima = d.tipologia || 'ore';
  const aggiorna = () => {
    const v = leggi();
    termine.hidden = v.tipoContratto !== 'determinato';
    root.querySelector('.solo-termine-s').hidden = v.tipoContratto !== 'determinato';
    const tip = tipologia(v);
    root.querySelectorAll('.solo-ore').forEach((el) => { el.hidden = tip.mensile; });
    root.querySelectorAll('.solo-mensile').forEach((el) => { el.hidden = !tip.mensile; });
    root.querySelector('.avviso-contanti').hidden = v.pagamento.modalita !== 'contanti';
    const anno = Number(oggiIso().slice(0, 4));
    const t = tabelleAnno(anno);
    // al cambio di tipologia propone minimo, vitto e alloggio
    if (v.tipologia !== tipologiaPrima) {
      tipologiaPrima = v.tipologia;
      if (tip.mensile) {
        const min = minimoContrattuale(t, v);
        if (min && !(Number(f.pagaMensile.value) >= min)) f.pagaMensile.value = min;
        f.vittoAlloggio.checked = !!tip.vitto;
        return aggiorna();
      }
    }
    for (const el of root.querySelectorAll('small.cf[data-for]')) {
      const val = f[el.dataset.for].value.trim();
      if (!val) { el.textContent = ''; el.className = 'cf'; continue; }
      const r = verificaCodiceFiscale(val);
      el.textContent = r.ok ? '✓ Codice fiscale valido' : `✗ ${r.msg}`;
      el.className = `cf ${r.ok ? 'ok' : 'ko'}`;
    }
    const ie = root.querySelector('.iban-esito');
    if (!v.pagamento.iban) { ie.textContent = ''; ie.className = 'cf iban-esito'; }
    else { const r = verificaIban(v.pagamento.iban); ie.textContent = r.ok ? '✓ IBAN valido' : `✗ ${r.msg}`; ie.className = `cf iban-esito ${r.ok ? 'ok' : 'ko'}`; }

    const ESITI = { si: ['✓', 'es-si'], no: ['✗', 'es-no'], forse: ['?', 'es-forse'] };
    root.querySelector('.verifica-agevolazioni').innerHTML = `<h3 class="sottotitolo">Verifica delle agevolazioni</h3>
      <ul class="lista-agevolazioni">${verificaAgevolazioni(v, oggiIso()).map((x) => `<li class="${ESITI[x.esito][1]}"><span class="segno">${ESITI[x.esito][0]}</span><span><strong>${esc(x.nome)}</strong><br><small>${esc(x.testo)}</small></span></li>`).join('')}</ul>
      <p class="nota">Verifica orientativa: per Prestazione universale e detrazione conferma con il patronato o il CAF.</p>`;
    const sett = oreSettimanali(v.orario);
    if ((tip.mensile ? !v.pagaMensile : !v.pagaOraria) || !sett) { riep.innerHTML = ''; return; }
    const minimo = minimoContrattuale(t, v);
    const fascia = fasciaContributiva(v, anno);
    const sim = simulaCosto({ pagaOraria: v.pagaOraria, oreSettimanaliTot: sett, anno, tipoContratto: v.tipoContratto, cuaf: v.cuaf, cassaColf: v.cassaColf, tipologia: v.tipologia, pagaMensile: v.pagaMensile, vittoAlloggio: v.vittoAlloggio, livello: v.livello });
    const paga = tip.mensile ? v.pagaMensile : v.pagaOraria;
    const minTesto = minimo == null
      ? (tip.mensile ? `<strong class="ko">livello non previsto</strong>` : 'da verificare')
      : `${eur(minimo)}${tip.mensile ? '/mese' : '/h'} ${paga >= minimo ? '✓' : '<strong class="ko">sotto il minimo</strong>'}`;
    const oltre = tip.maxSettimanali && sett > tip.maxSettimanali;
    riep.innerHTML = `
      <h2>In sintesi (${anno}${t.provvisorie ? `, valori ${t.annoTabelle}` : ''})</h2>
      <dl>
        <div><dt>Ore settimanali</dt><dd>${sett}${oltre ? ` <strong class="ko">oltre ${tip.maxSettimanali}</strong>` : ''}</dd></div>
        <div><dt>Minimo livello ${v.livello}</dt><dd>${minTesto}</dd></div>
        ${tip.mensile ? `<div><dt>Paga oraria equivalente</dt><dd>${eur(normalizzaRapporto(v).pagaOraria)}</dd></div>` : ''}
        <div><dt>Contributi INPS</dt><dd>${eur(fascia.totaleOrario)}/h, di cui ${eur(fascia.datoreOrario)} a tuo carico</dd></div>
        <div><dt>Costo medio mensile</dt><dd><strong>${eur(sim.costoMensile)}</strong></dd></div>
        <div><dt>Paga oraria netta</dt><dd>${eur(sim.pagaNettaOraria)}</dd></div>
        <div><dt>Netto medio alla lavoratrice</dt><dd>${eur(sim.nettoMedioLavoratrice)}</dd></div>
        <div><dt>Versamento INPS trimestrale</dt><dd>${eur(sim.versamentoTrimestraleInps)}</dd></div>
        ${v.budgetAnnuo ? `<div><dt>Costo annuo / budget</dt><dd>${eur(sim.costoAnnuo)} su ${eur(v.budgetAnnuo)} ${sim.costoAnnuo > v.budgetAnnuo ? '<strong class="ko">oltre</strong>' : '✓'}</dd></div>` : ''}
      </dl>
      <p class="nota">${fascia.nome}. Il costo comprende paga, 13ª, contributi a tuo carico e TFR${sim.vittoAlloggioMese ? `; vitto e alloggio valgono ${eur(sim.vittoAlloggioMese)} al mese ai fini di 13ª e TFR` : ''}.</p>`;
  };

  f.addEventListener('input', () => { if (esito) esito.textContent = ''; aggiorna(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = leggi();
    if (!v.dataAssunzione) { esito.textContent = 'Inserisci la data di assunzione.'; esito.className = 'esito ko'; return; }
    for (const [chi, p] of [['del datore', v.datore], ['della lavoratrice', v.lavoratrice]]) {
      if (p.cap && !/^\d{5}$/.test(p.cap)) { esito.textContent = `Il CAP ${chi} deve avere 5 cifre.`; esito.className = 'esito ko'; return; }
      if (p.provincia && !/^[A-Z]{2}$/.test(p.provincia)) { esito.textContent = `La provincia ${chi} va indicata con la sigla di 2 lettere (es. RM).`; esito.className = 'esito ko'; return; }
    }
    if (v.pagamento.iban && !verificaIban(v.pagamento.iban).ok) { esito.textContent = 'Controlla l\'IBAN della lavoratrice.'; esito.className = 'esito ko'; return; }
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    esito.textContent = 'Salvataggio…';
    esito.className = 'esito';
    try {
      const salvato = await salvaRapporto(app.rapporto?.id, v);
      app.rapporto = { ...app.rapporto, ...salvato, ruolo: app.rapporto?.ruolo ?? 'titolare' };
      await ricaricaDati();
      app.bozzaRapporto = null;
      toast('Dati del rapporto salvati');
      if (nuovo) {
        try { localStorage.setItem('badante-rapporto', salvato.id); } catch { /* */ }
        location.reload();
      }
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

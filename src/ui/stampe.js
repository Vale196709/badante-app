// Documenti stampabili. Si aprono in anteprima; "Stampa" usa la stampa del browser,
// da cui si può anche scegliere "Salva come PDF" (PC e iPhone).
import { app, eur, num, esc, dataIt, oggiIso, nomeMeseMaiusc } from '../stato.js';
import { oreSettimanali } from '../engine/calcolo.js';
import { riepilogoAnno, contributiDeducibili } from '../engine/annuale.js';
import { MOTIVI } from '../engine/cessazione.js';
import { REGOLE_CCNL } from '../engine/tabelle.js';
import { voceT, meseT } from '../i18n.js';
import { condizioniMese, condizioniAl } from '../engine/variazioni.js';

const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const CCNL = 'CCNL sulla disciplina del rapporto di lavoro domestico (rinnovo del 28/10/2025) sottoscritto da Fidaldo e Domina con Filcams-CGIL, Fisascat-CISL, Uiltucs e Federcolf';

export function apriStampa(titolo, corpo) {
  document.querySelector('.stampa-overlay')?.remove();
  const el = document.createElement('div');
  el.className = 'stampa-overlay';
  el.innerHTML = `
    <div class="stampa-barra">
      <button type="button" class="secondario chiudi">Chiudi</button>
      <span>${esc(titolo)}</span>
      <button type="button" class="primario stampa">Stampa / PDF</button>
    </div>
    <div class="stampa-area"><article class="foglio">${corpo}
      <footer class="foglio-piede">Documento generato il ${dataIt(oggiIso())} con l'app Badante di Maria (v${__VERSIONE__}) · verificare i dati prima della firma</footer>
    </article></div>`;
  document.body.appendChild(el);
  document.body.classList.add('in-stampa');
  const prima = document.title;
  document.title = titolo;
  el.querySelector('.chiudi').addEventListener('click', () => { el.remove(); document.body.classList.remove('in-stampa'); document.title = prima; });
  el.querySelector('.stampa').addEventListener('click', () => window.print());
}

const parti = (d) => `
  <table class="parti"><tr>
    <td><span class="et">Datore di lavoro</span><strong>${esc(d.datore.nome)}</strong><br>C.F. ${esc(d.datore.cf)}${d.datore.indirizzo ? `<br>${esc(d.datore.indirizzo)}` : ''}</td>
    <td><span class="et">Lavoratrice</span><strong>${esc(d.lavoratrice.nome)}</strong><br>C.F. ${esc(d.lavoratrice.cf || '—')}${d.lavoratrice.indirizzo ? `<br>${esc(d.lavoratrice.indirizzo)}` : ''}</td>
  </tr></table>`;

const firme = (sx = 'Il datore di lavoro', dx = 'La lavoratrice') => `
  <div class="firme"><div><span>${sx}</span></div><div><span>${dx}</span></div></div>`;

const orarioTesto = (d) => Object.entries(d.orario).map(([g, h]) => `${GIORNI[g - 1]} ${num(h, h % 1 ? 1 : 0)} ore`).join(', ');

// ---------- Cedolino ----------
export function stampaCedolino(m, salvato, { traduci = false } = {}) {
  const d = app.rapporto.dati;
  const r = m.risultato;
  const titolo = `Cedolino ${nomeMeseMaiusc(m.mese)} ${m.anno}`;
  // traduzione affiancata per la lavoratrice: il testo italiano resta quello valido
  const tr = (cod) => (traduci && voceT(cod) ? `<br><span class="trad">${esc(voceT(cod))}</span>` : '');
  apriStampa(titolo, `
    <h1>Prospetto paga · ${nomeMeseMaiusc(m.mese)} ${m.anno}${traduci && voceT('titolo') ? `<br><span class="trad">${esc(voceT('titolo'))} · ${esc(meseT(m.mese))} ${m.anno}</span>` : ''}</h1>
    ${parti(d)}
    <p class="meta">Livello ${esc(condizioniMese(d, m.anno, m.mese).livello)} · non convivente · ${oreSettimanali(condizioniMese(d, m.anno, m.mese).orario)} ore settimanali · assunzione ${dataIt(d.dataAssunzione)}${d.codiceRapportoInps ? ` · cod. rapporto INPS ${esc(d.codiceRapportoInps)}` : ''}</p>
    <table class="dati">
      <thead><tr><th>Voce</th><th class="num">Ore</th><th class="num">Tariffa €</th><th class="num">Importo €</th></tr></thead>
      <tbody>
        ${r.voci.map((v) => `<tr><td>${esc(v.descrizione)}${tr(v.codice)}</td><td class="num">${v.quantita != null ? num(v.quantita) : ''}</td><td class="num">${v.tariffa != null ? num(v.tariffa) : ''}</td><td class="num">${num(v.importo)}</td></tr>`).join('')}
        <tr class="tot"><td colspan="3">Totale lordo${tr('lordo')}</td><td class="num">${num(r.lordo)}</td></tr>
        ${r.trattenute.map((x) => `<tr><td colspan="3">${esc(x.descrizione)}${tr(x.codice)}</td><td class="num">−${num(x.importo)}</td></tr>`).join('')}
        ${r.anticipoTfr ? `<tr><td colspan="3">Anticipo TFR${tr('anticipo')}</td><td class="num">${num(r.anticipoTfr)}</td></tr>` : ''}
        <tr class="tot grande"><td colspan="3">NETTO DA PAGARE${tr('netto')}</td><td class="num">${eur(r.netto)}</td></tr>
      </tbody>
    </table>
    <h2>Contatori</h2>
    <table class="dati compatta">
      <tr><td>Ferie maturate nel mese / residue</td><td class="num">${num(r.accantonamenti.ferieMaturateOre)} h / ${num(r.contatori.ferieResidueOre)} h</td></tr>
      <tr><td>Rateo tredicesima del mese${d.tredicesimaMensile ? ' (pagato)' : ` · maturata nell'anno ${eur(r.contatori.tredicesimaMaturata)}`}</td><td class="num">${eur(r.accantonamenti.rateoTredicesima)}</td></tr>
      <tr><td>TFR accantonato nel mese / totale</td><td class="num">${eur(r.accantonamenti.tfrMese)} / ${eur(r.contatori.tfrAccantonato)}</td></tr>
      ${r.accantonamenti.rivalutazioneTfr ? `<tr><td>Rivalutazione TFR anno precedente</td><td class="num">${eur(r.accantonamenti.rivalutazioneTfr)}</td></tr>` : ''}
      <tr><td>Giorni di malattia nell'anno</td><td class="num">${r.contatori.giorniMalattiaAnno}</td></tr>
    </table>
    <h2>Contributi del mese</h2>
    <table class="dati compatta">
      <tr><td>Ore retribuite ai fini INPS (${esc(r.contributi.fascia)})</td><td class="num">${num(r.contributi.oreContributive)}</td></tr>
      <tr><td>Contributi INPS: a carico lavoratrice / datore</td><td class="num">${eur(r.contributi.inpsLavoratore)} / ${eur(r.contributi.inpsDatore)}</td></tr>
      <tr><td>Cassa Colf: a carico lavoratrice / datore</td><td class="num">${eur(r.contributi.cassaColfLavoratore)} / ${eur(r.contributi.cassaColfDatore)}</td></tr>
      <tr><td>Totale da versare con il pagoPA trimestrale</td><td class="num">${eur(r.contributi.daVersareAInps)}</td></tr>
    </table>
    <p class="piccolo">Il datore di lavoro domestico non è sostituto d'imposta: nessuna ritenuta IRPEF è applicata.</p>
    ${salvato?.pagato_at ? `<p>Pagato il ${dataIt(salvato.pagato_at)}.</p>` : ''}
    ${salvato?.ricevuta_at ? `<p class="firma-digitale">Ricevuta confermata nell'app da ${esc(salvato.ricevuta_da)} il ${new Date(salvato.ricevuta_at).toLocaleString('it-IT')}.</p>` : ''}
    <p>Per ricevuta della somma netta di ${eur(r.netto)}.</p>
    ${salvato?.ricevuta_firma
      ? `<div class="firme"><div><span>Il datore di lavoro</span></div><div class="con-firma"><img src="${salvato.ricevuta_firma}" alt="Firma della lavoratrice" /><span>La lavoratrice (per ricevuta)</span></div></div>`
      : firme('Il datore di lavoro', 'La lavoratrice (per ricevuta)')}`);
}

// ---------- Lettera di assunzione ----------
export function stampaLetteraAssunzione() {
  const d = app.rapporto.dati;
  const sett = oreSettimanali(d.orario);
  apriStampa('Lettera di assunzione', `
    <h1>Contratto di lavoro domestico</h1>
    <p class="meta">Lettera di assunzione ai sensi del ${CCNL} e del D.Lgs. 152/1997 come modificato dal D.Lgs. 104/2022</p>
    ${parti(d)}
    ${d.lavoratrice.nascita ? `<p>La lavoratrice è nata a ${esc(d.lavoratrice.nascita)}.</p>` : ''}
    <ol class="clausole">
      <li><strong>Inizio e durata.</strong> Il rapporto inizia il ${dataIt(d.dataAssunzione)} ed è a ${d.tipoContratto === 'determinato' ? `tempo determinato fino al ${dataIt(d.dataFineTermine)}` : 'tempo indeterminato'}.</li>
      <li><strong>Periodo di prova.</strong> ${d.giorniProva ? `${d.giorniProva} giorni di lavoro effettivo, durante i quali ciascuna parte può recedere senza preavviso.` : 'Non previsto.'}</li>
      <li><strong>Inquadramento e mansioni.</strong> Livello ${esc(d.livello)} del CCNL, lavoratrice non convivente. Mansioni: ${esc(d.mansioni)}.</li>
      <li><strong>Luogo di lavoro.</strong> ${esc(d.luogoLavoro || d.datore.indirizzo || 'abitazione del datore di lavoro')}.</li>
      <li><strong>Orario.</strong> ${num(sett, sett % 1 ? 1 : 0)} ore settimanali così distribuite: ${orarioTesto(d)}${d.fasciaOraria ? `, di norma nella fascia ${esc(d.fasciaOraria)}` : ''}. Riposo settimanale la domenica.</li>
      <li><strong>Retribuzione.</strong> ${eur(d.pagaOraria)} lordi l'ora, pagati mensilmente entro la fine del mese sulla base delle ore effettivamente prestate, con prospetto paga. Straordinari, festività, ferie, malattia e permessi sono retribuiti secondo il CCNL.</li>
      <li><strong>Tredicesima.</strong> ${d.tredicesimaMensile ? 'Per accordo tra le parti è corrisposta in ratei mensili insieme alla retribuzione.' : 'È corrisposta a dicembre, in proporzione ai mesi lavorati.'}</li>
      <li><strong>Ferie.</strong> 26 giorni lavorativi l'anno (settimana di 6 giorni), da concordare tra le parti.</li>
      <li><strong>Trattamento di fine rapporto.</strong> Accantonato ogni anno nella misura della retribuzione annua divisa per 13,5 e rivalutato per legge; è possibile un anticipo annuo fino al 70% del maturato.</li>
      <li><strong>Previdenza e assistenza.</strong> Il datore versa i contributi INPS e${d.cassaColf !== false ? ' il contributo di assistenza contrattuale Cas.Sa.Colf,' : ''} trattenendo la quota a carico della lavoratrice. Il rapporto è comunicato all'INPS entro le ore 24 del giorno precedente l'inizio.</li>
      <li><strong>Preavviso.</strong> In caso di recesso si applicano i termini di preavviso del CCNL, ridotti alla metà in caso di dimissioni.</li>
      <li><strong>Rinvio.</strong> Per quanto non previsto si applicano il CCNL citato e le norme di legge.</li>
    </ol>
    <p>Luogo e data: ______________________, ${dataIt(d.dataAssunzione) || '___/___/______'}</p>
    ${firme('Il datore di lavoro', 'La lavoratrice, per accettazione')}`);
}

// ---------- Informativa privacy ----------
export function stampaPrivacy() {
  const d = app.rapporto.dati;
  apriStampa('Informativa privacy', `
    <h1>Informativa sul trattamento dei dati personali</h1>
    <p class="meta">Art. 13 del Regolamento (UE) 2016/679 (GDPR)</p>
    <p><strong>Titolare del trattamento:</strong> ${esc(d.datore.nome)}, C.F. ${esc(d.datore.cf)}${d.datore.indirizzo ? `, ${esc(d.datore.indirizzo)}` : ''}.</p>
    <p><strong>Interessata:</strong> ${esc(d.lavoratrice.nome)}.</p>
    <ol class="clausole">
      <li><strong>Finalità.</strong> I dati sono trattati per gestire il rapporto di lavoro domestico: retribuzione e prospetti paga, adempimenti verso INPS e Cas.Sa.Colf, certificazioni dei compensi, gestione di assenze, malattia e ferie.</li>
      <li><strong>Base giuridica.</strong> Esecuzione del contratto di lavoro e adempimento di obblighi di legge (art. 6, par. 1, lett. b e c del GDPR). I dati relativi alla salute, come i certificati di malattia, sono trattati per adempiere obblighi in materia di diritto del lavoro (art. 9, par. 2, lett. b).</li>
      <li><strong>Dati trattati.</strong> Dati anagrafici e di contatto, codice fiscale, documento di identità e di soggiorno ove previsto, presenze, retribuzioni, coordinate di pagamento, certificati medici.</li>
      <li><strong>Modalità.</strong> Su carta e con strumenti elettronici. I dati sono registrati in un'applicazione con accesso protetto da credenziali, con archivio presso un fornitore di servizi cloud con server nell'Unione Europea, che agisce come responsabile del trattamento.</li>
      <li><strong>Destinatari.</strong> INPS, INAIL, Cas.Sa.Colf, eventuali consulenti del lavoro, CAF o patronati incaricati e le autorità quando richiesto dalla legge. I dati non sono diffusi né trasferiti fuori dall'Unione Europea.</li>
      <li><strong>Conservazione.</strong> Per la durata del rapporto e per i 10 anni successivi alla sua cessazione, salvo termini diversi previsti dalla legge.</li>
      <li><strong>Natura del conferimento.</strong> Obbligatoria: senza i dati non è possibile instaurare e gestire il rapporto.</li>
      <li><strong>Diritti.</strong> L'interessata può chiedere accesso, rettifica, cancellazione nei limiti di legge, limitazione, portabilità e opporsi al trattamento rivolgendosi al titolare, e può proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</li>
    </ol>
    <p>Data: ${dataIt(d.dataAssunzione) || '___/___/______'}</p>
    ${firme('Il titolare del trattamento', 'La lavoratrice, per presa visione')}`);
}

// ---------- Dichiarazione annuale dei compensi ----------
export function stampaDichiarazione(catena, anno) {
  const d = app.rapporto.dati;
  const a = riepilogoAnno(catena, anno);
  apriStampa(`Dichiarazione compensi ${anno}`, `
    <h1>Dichiarazione dei compensi corrisposti · anno ${anno}</h1>
    <p class="meta">Dichiarazione sostitutiva della certificazione dei redditi per il lavoro domestico (il datore di lavoro domestico non è sostituto d'imposta)</p>
    ${parti(d)}
    <p>Il sottoscritto ${esc(d.datore.nome)} dichiara di aver corrisposto a ${esc(d.lavoratrice.nome)}, per il rapporto di lavoro domestico in essere dal ${dataIt(d.dataAssunzione)}, nel periodo dal ${dataIt(`${anno}-01-01` < d.dataAssunzione ? d.dataAssunzione : `${anno}-01-01`)} al ${dataIt(d.dataCessazione && d.dataCessazione < `${anno}-12-31` ? d.dataCessazione : `${anno}-12-31`)}, le seguenti somme:</p>
    <table class="dati">
      <tr><td>Retribuzioni lorde complessive</td><td class="num">${eur(a.lordo)}</td></tr>
      <tr><td>di cui tredicesima mensilità</td><td class="num">${eur(a.tredicesima)}</td></tr>
      <tr><td>Contributi previdenziali e assistenziali a carico della lavoratrice, trattenuti</td><td class="num">${eur(a.contributiLavoratrice)}</td></tr>
      <tr class="tot"><td>Reddito di lavoro dipendente (retribuzioni meno contributi a carico)</td><td class="num">${eur(a.imponibileFiscale)}</td></tr>
      <tr><td>Anticipi di TFR corrisposti nell'anno</td><td class="num">${eur(a.anticipiTfr)}</td></tr>
      <tr><td>Ore retribuite nell'anno</td><td class="num">${num(a.oreContributive)}</td></tr>
    </table>
    <h2>Dettaglio mensile</h2>
    <table class="dati compatta">
      <thead><tr><th>Mese</th><th class="num">Ore lavorate</th><th class="num">Lordo €</th><th class="num">Netto €</th></tr></thead>
      <tbody>${a.mensile.map((m) => `<tr><td>${nomeMeseMaiusc(m.mese)}</td><td class="num">${num(m.ore)}</td><td class="num">${num(m.lordo)}</td><td class="num">${num(m.netto)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="piccolo">Nessuna ritenuta IRPEF è stata operata. Il documento è rilasciato per gli usi consentiti dalla legge (dichiarazione dei redditi, ISEE, permesso di soggiorno).</p>
    <p>Luogo e data: ______________________, ${dataIt(oggiIso())}</p>
    ${firme('Il datore di lavoro', 'La lavoratrice, per ricevuta')}`);
}

// ---------- Prospetto annuale per il datore ----------
export function stampaProspettoAnnuale(catena, anno) {
  const d = app.rapporto.dati;
  const a = riepilogoAnno(catena, anno);
  const ded = contributiDeducibili(catena, anno, app.versamenti);
  apriStampa(`Prospetto costi ${anno}`, `
    <h1>Prospetto dei costi · anno ${anno}</h1>
    ${parti(d)}
    <table class="dati compatta">
      <thead><tr><th>Mese</th><th class="num">Ore</th><th class="num">Lordo €</th><th class="num">Netto €</th><th class="num">Costo datore €</th><th>Stato</th></tr></thead>
      <tbody>${a.mensile.map((m) => `<tr><td>${nomeMeseMaiusc(m.mese)}</td><td class="num">${num(m.ore)}</td><td class="num">${num(m.lordo)}</td><td class="num">${num(m.netto)}</td><td class="num">${num(m.costo)}</td><td>${esc(m.stato)}</td></tr>`).join('')}
      <tr class="tot"><td>Totale</td><td class="num">${num(a.oreLavorate)}</td><td class="num">${num(a.lordo)}</td><td class="num">${num(a.netto)}</td><td class="num">${num(a.costoDatore)}</td><td></td></tr></tbody>
    </table>
    <table class="dati">
      <tr><td>Contributi INPS e Cas.Sa.Colf da versare (quota datore + lavoratrice)</td><td class="num">${eur(a.versamentiInps)}</td></tr>
      <tr><td>di cui a carico del datore</td><td class="num">${eur(a.contributiDatore)}</td></tr>
      <tr><td>TFR maturato nell'anno</td><td class="num">${eur(a.tfrMaturato)}</td></tr>
      <tr class="tot"><td>Contributi a carico del datore pagati nell'anno (4° trim. ${anno - 1} + 1°–3° trim. ${anno})${ded.trimestriRegistrati ? ` · ${ded.trimestriRegistrati} trimestri da pagamenti registrati` : ' · stima dai cedolini'}</td><td class="num">${eur(ded.pagati)}</td></tr>
      <tr><td>Importo deducibile dal reddito (massimo ${eur(ded.massimo)})</td><td class="num">${eur(ded.deducibili)}</td></tr>
    </table>
    <p class="piccolo">Il costo del datore comprende retribuzione, rateo di tredicesima, contributi a suo carico e TFR maturato. La deduzione vale per i contributi effettivamente pagati nell'anno solare: conservare le ricevute pagoPA. Le spese per l'assistenza di persone non autosufficienti possono dare diritto a un'ulteriore detrazione, a condizioni di reddito: verificare con il CAF.</p>`);
}

// ---------- Prospetto TFR ----------
export function stampaTfr(catena) {
  const d = app.rapporto.dati;
  let righe = '';
  for (const m of catena) {
    const r = m.risultato;
    righe += `<tr><td>${nomeMeseMaiusc(m.mese)} ${m.anno}</td><td class="num">${num(r.accantonamenti.tfrMese)}</td><td class="num">${r.accantonamenti.rivalutazioneTfr ? num(r.accantonamenti.rivalutazioneTfr) : ''}</td><td class="num">${r.anticipoTfr ? `−${num(r.anticipoTfr)}` : ''}</td><td class="num">${num(r.contatori.tfrAccantonato)}</td></tr>`;
  }
  const ult = catena[catena.length - 1]?.risultato.contatori.tfrAccantonato ?? 0;
  apriStampa('Prospetto TFR', `
    <h1>Prospetto del trattamento di fine rapporto</h1>
    ${parti(d)}
    <table class="dati compatta">
      <thead><tr><th>Mese</th><th class="num">Quota €</th><th class="num">Rivalutazione €</th><th class="num">Anticipi €</th><th class="num">Fondo €</th></tr></thead>
      <tbody>${righe}<tr class="tot"><td colspan="4">TFR accantonato</td><td class="num">${eur(ult)}</td></tr></tbody>
    </table>
    <p class="piccolo">Quota annua = retribuzione dell'anno (con tredicesima) / 13,5. Rivalutazione annua: 1,5% fisso + 75% dell'inflazione ISTAT di dicembre. Anticipo massimo: ${REGOLE_CCNL.anticipoTfrMassimo * 100}% del maturato, una volta l'anno.</p>`);
}

// ---------- Conteggi di fine rapporto ----------
export function stampaCessazione(c) {
  const d = app.rapporto.dati;
  apriStampa('Conteggi di fine rapporto', `
    <h1>Conteggi di fine rapporto</h1>
    ${parti(d)}
    <p class="meta">Cessazione il ${dataIt(c.dataCessazione)} · ${esc(MOTIVI[c.motivo])} · preavviso ${c.giorniPreavviso} giorni</p>
    <table class="dati">
      ${c.voci.map((v) => `<tr><td>${esc(v.descrizione)}</td><td class="num">${num(v.importo)}</td></tr>`).join('')}
      <tr class="tot"><td>Totale lordo spettanze finali</td><td class="num">${eur(c.lordo)}</td></tr>
      <tr><td>Contributi a carico della lavoratrice sulle indennità</td><td class="num">−${num(c.trattenute)}</td></tr>
      <tr class="tot grande"><td>NETTO DA PAGARE</td><td class="num">${eur(c.netto)}</td></tr>
    </table>
    <p class="piccolo">A questi importi si aggiunge lo stipendio dell'ultimo mese, da elaborare in Presenze e cedolini. Contributi a carico del datore sulle indennità: ${eur(c.contributiDatore)}.</p>
    <ul class="piccolo">${c.note.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <p>Per ricevuta e a saldo di ogni spettanza relativa al rapporto di lavoro.</p>
    ${firme('Il datore di lavoro', 'La lavoratrice (per ricevuta)')}`);
}

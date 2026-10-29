import { fmtEur, fmtNum, fmtOre } from './formato.js';
// Scadenze e avvisi di monitoraggio del rapporto.
import { euro, isoDate, oreSettimanali } from './calcolo.js';
import { festivitaAnno, tabelleAnno, REGOLE_CCNL as R, minimoContrattuale, tipologia } from './tabelle.js';
import { variazioniOrdinate, condizioniAl } from './variazioni.js';

const addGiorni = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const ultimoGiorno = (a, m) => isoDate(a, m, new Date(Date.UTC(a, m, 0)).getUTCDate());

/** Se la data cade di sabato, domenica o festivo, slitta al primo giorno lavorativo. */
export function primoLavorativo(iso) {
  let d = iso;
  for (;;) {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay();
    if (dow !== 0 && dow !== 6 && !festivitaAnno(Number(d.slice(0, 4))).includes(d)) return d;
    d = addGiorni(d, 1);
  }
}

const NOMI_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const nomeMese = (m) => NOMI_MESI[m - 1];

/**
 * @param catena   calcolaCatena fino al mese corrente (o oltre)
 * @param oggi     'YYYY-MM-DD'
 * @param fatte    Set di chiavi già segnate come fatte
 */
export function generaScadenze(rapporto, catena, oggi, fatte = new Set()) {
  const out = [];
  const add = (s) => out.push({ ...s, fatta: fatte.has(s.chiave) });
  if (!rapporto?.dataAssunzione) return out;
  const annoOggi = Number(oggi.slice(0, 4));
  const [annoAss] = rapporto.dataAssunzione.split('-').map(Number);

  // Contributi trimestrali INPS (più Cassa Colf)
  const trimestri = new Map();
  for (const m of catena) {
    const q = Math.ceil(m.mese / 3);
    const k = `${m.anno}-T${q}`;
    const t = trimestri.get(k) || { anno: m.anno, q, importo: 0, ore: 0, mesi: 0 };
    t.importo += m.risultato.contributi.daVersareAInps;
    t.ore += m.risultato.contributi.oreContributive;
    t.mesi++;
    trimestri.set(k, t);
  }
  for (const [k, t] of trimestri) {
    const aAnno = t.q === 4 ? t.anno + 1 : t.anno;
    const aMese = t.q === 4 ? 1 : t.q * 3 + 1;
    add({
      chiave: `inps-${k}`,
      data: primoLavorativo(isoDate(aAnno, aMese, 10)),
      categoria: 'Contributi',
      titolo: `Contributi INPS ${t.q}° trimestre ${t.anno}`,
      descrizione: `${fmtOre(euro(t.ore))} ore${t.mesi < 3 ? ' (trimestre ancora in corso o parziale)' : ''}. Pagamento con avviso pagoPA dal Portale dei pagamenti INPS.`,
      importo: euro(t.importo),
    });
  }

  // Stipendio e cedolino mensile
  for (const m of catena) {
    add({
      chiave: `stipendio-${m.anno}-${m.mese}`,
      data: ultimoGiorno(m.anno, m.mese),
      categoria: 'Stipendio',
      titolo: `Stipendio e cedolino di ${nomeMese(m.mese)} ${m.anno}`,
      descrizione: m.stato === 'pagato' ? 'Pagato.' : 'Confermare le presenze, pagare il netto e far firmare la ricevuta.',
      importo: m.risultato.netto,
      completataDa: m.stato === 'pagato',
    });
  }

  for (let a = annoAss; a <= annoOggi + 1; a++) {
    // Tredicesima
    if (!rapporto.tredicesimaMensile) {
      add({ chiave: `13-${a}`, data: isoDate(a, 12, 23), categoria: 'Stipendio', titolo: `Tredicesima ${a}`, descrizione: 'Si paga con lo stipendio di dicembre, in tempo per Natale.' });
    }
    // Dichiarazione compensi anno precedente
    if (a > annoAss) {
      add({
        chiave: `dich-${a - 1}`,
        data: isoDate(a, 2, 28),
        categoria: 'Documenti',
        titolo: `Dichiarazione compensi ${a - 1} alla lavoratrice`,
        descrizione: 'Consigliato entro febbraio. Obbligatorio almeno 30 giorni prima della scadenza della sua dichiarazione dei redditi. Si stampa dalla sezione Documenti.',
      });
      add({
        chiave: `tabelle-${a}`,
        data: isoDate(a, 2, 15),
        categoria: 'Aggiornamenti',
        titolo: `Aggiornare minimi e contributi ${a}`,
        completataDa: !tabelleAnno(a).provvisorie,
        descrizione: 'A inizio anno escono i nuovi minimi CCNL e la circolare INPS sui contributi: vanno inseriti nell\'app prima di confermare i cedolini dell\'anno.',
      });
      add({
        chiave: `tfr-${a - 1}`,
        data: isoDate(a, 1, 31),
        categoria: 'Aggiornamenti',
        titolo: `Rivalutazione TFR ${a - 1}`,
        descrizione: 'A metà gennaio ISTAT pubblica l\'inflazione di dicembre: serve per completare la rivalutazione del TFR.',
      });
    }
  }

  // Fine del periodo di prova (giorni di lavoro effettivo)
  const giorniProva = Number(rapporto.giorniProva) || 0;
  if (giorniProva > 0 && oreSettimanali(rapporto.orario) > 0) {
    let d = rapporto.dataAssunzione, contati = 0;
    for (let i = 0; i < 400 && contati < giorniProva; i++) {
      const dow = ((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
      if ((rapporto.orario[dow] || 0) > 0 && !festivitaAnno(Number(d.slice(0, 4))).includes(d)) contati++;
      if (contati < giorniProva) d = addGiorni(d, 1);
    }
    add({ chiave: 'prova', data: d, informativa: true, categoria: 'Contratto', titolo: 'Fine del periodo di prova', descrizione: `${giorniProva} giorni di lavoro effettivo. Durante la prova si può recedere senza preavviso.` });
  }

  // Scadenza documento di soggiorno della lavoratrice
  if (rapporto.scadenzaDocumento) {
    add({ chiave: `doc-${rapporto.scadenzaDocumento}`, data: addGiorni(rapporto.scadenzaDocumento, -60), categoria: 'Contratto', titolo: 'Rinnovo documento della lavoratrice', descrizione: `Il documento scade il ${rapporto.scadenzaDocumento.split('-').reverse().join('/')}: verificare per tempo il rinnovo.` });
  }

  // Pratiche INPS: assunzione, variazioni, cessazione
  add({
    chiave: 'inps-assunzione', data: addGiorni(rapporto.dataAssunzione, -1), informativa: true, categoria: 'Pratiche INPS',
    titolo: 'Comunicare l\'assunzione all\'INPS',
    descrizione: 'Entro le ore 24 del giorno prima dell\'inizio del lavoro. La guida con i dati da inserire è in Documenti → Pratiche INPS.',
  });
  for (const v of variazioniOrdinate(rapporto)) {
    add({
      chiave: `inps-var-${v.dal}`, data: addGiorni(v.dal, 4), categoria: 'Pratiche INPS',
      titolo: `Comunicare all'INPS la variazione dal ${v.dal.split('-').reverse().join('/')}`,
      descrizione: 'Nuova paga, orario o livello: va comunicata con il servizio INPS di variazione del rapporto di lavoro domestico. Consigliato entro 5 giorni. Guida in Documenti → Pratiche INPS.',
    });
  }
  if (rapporto.dataCessazione) {
    const dc = rapporto.dataCessazione;
    add({ chiave: 'cess-inps', data: addGiorni(dc, 5), categoria: 'Pratiche INPS', titolo: 'Comunicare la cessazione all\'INPS', descrizione: 'Entro 5 giorni dalla fine del rapporto. Guida in Documenti → Pratiche INPS.' });
    add({ chiave: 'cess-spettanze', data: dc, categoria: 'Stipendio', titolo: 'Pagare le spettanze finali', descrizione: 'Ultimo stipendio, ferie non godute, ratei di 13ª, TFR ed eventuale preavviso: conteggi nel Simulatore.' });
    add({ chiave: 'cess-dich', data: dc, categoria: 'Documenti', titolo: 'Consegnare la dichiarazione dei compensi', descrizione: 'Alla fine del rapporto, con le ultime spettanze.' });
  }

  // Contratto a termine
  if (rapporto.tipoContratto === 'determinato' && rapporto.dataFineTermine) {
    add({ chiave: `termine-${rapporto.dataFineTermine}`, data: addGiorni(rapporto.dataFineTermine, -30), categoria: 'Contratto', titolo: 'Scadenza del contratto a termine', descrizione: `Il contratto termina il ${rapporto.dataFineTermine.split('-').reverse().join('/')}: decidere se proroga o cessazione.` });
  }

  return out
    .map((s) => ({ ...s, fatta: s.fatta || !!s.completataDa || (s.informativa && s.data < oggi) }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Avvisi di monitoraggio sullo stato del rapporto. */
export function avvisiRapporto(rapporto, catena, oggi) {
  const avvisi = [];
  const ultimo = catena[catena.length - 1];
  if (!ultimo) return avvisi;
  const s = ultimo.risultato.contatori;
  const oreAnnueFerie = R.giorniFerieAnnui * (oreSettimanali(rapporto.orario) / 6);
  if (s.ferieResidueOre > oreAnnueFerie) {
    avvisi.push({ livello: 'attenzione', testo: `Ferie residue ${fmtNum(s.ferieResidueOre, 1)} ore, più di un anno di maturato: vanno pianificate.` });
  }
  const meseOggi = oggi.slice(0, 7);
  const arretrati = catena.filter((m) => `${m.anno}-${String(m.mese).padStart(2, '0')}` < meseOggi && m.stato !== 'pagato');
  if (arretrati.length) {
    avvisi.push({ livello: 'attenzione', testo: `${arretrati.length} ${arretrati.length === 1 ? 'mese passato non risulta pagato' : 'mesi passati non risultano pagati'}: ${arretrati.map((m) => `${nomeMese(m.mese)} ${m.anno}`).join(', ')}.` });
  }
  const t = tabelleAnno(Number(oggi.slice(0, 4)));
  if (t.provvisorie) avvisi.push({ livello: 'attenzione', testo: `Mancano minimi e contributi ${oggi.slice(0, 4)}: i calcoli usano i valori ${t.annoTabelle}.` });
  const c = condizioniAl(rapporto, oggi);
  const minimo = minimoContrattuale(t, c);
  if (tipologia(c).mensile) {
    if (minimo && (Number(c.pagaMensile) || 0) < minimo) avvisi.push({ livello: 'grave', testo: `La retribuzione mensile è sotto il minimo del livello ${c.livello} (${fmtEur(minimo)}).` });
  } else if (minimo && c.pagaOraria < minimo) avvisi.push({ livello: 'grave', testo: `La paga oraria è sotto il minimo del livello ${c.livello} (${fmtEur(minimo)}).` });
  for (const m of catena) for (const a of m.risultato.avvisi || []) {
    if (a.includes('conservazione del posto') || a.includes('non pagata')) avvisi.push({ livello: 'attenzione', testo: `${nomeMese(m.mese)} ${m.anno}: ${a}` });
  }
  return avvisi;
}

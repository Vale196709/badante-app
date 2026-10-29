// Motore di calcolo del cedolino per lavoro domestico non convivente pagato a ore.
// Funzioni pure: ricevono dati, restituiscono risultati. Nessun accesso a rete o archivio.

import { tabelleAnno, REGOLE_CCNL } from './tabelle.js';

export const euro = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const ore2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// ---------- Date ----------
const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (a, m, g) => `${a}-${pad(m)}-${pad(g)}`;
const giorniNelMese = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
// 1 = lunedì ... 7 = domenica
const giornoSettimana = (iso) => {
  const d = new Date(iso + 'T00:00:00Z').getUTCDay();
  return d === 0 ? 7 : d;
};
const diffGiorni = (da, a) =>
  Math.round((new Date(a + 'T00:00:00Z') - new Date(da + 'T00:00:00Z')) / 86400000);

export function mesiAnzianita(dataAssunzione, alGiorno) {
  const [a1, m1, g1] = dataAssunzione.split('-').map(Number);
  const [a2, m2, g2] = alGiorno.split('-').map(Number);
  let mesi = (a2 - a1) * 12 + (m2 - m1);
  if (g2 < g1) mesi -= 1;
  return Math.max(0, mesi);
}

// ---------- Orario ----------
// rapporto.orario: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 } → ore per giorno della settimana
export function oreSettimanali(orario) {
  return Object.values(orario).reduce((s, h) => s + h, 0);
}

/**
 * Calendario del mese: per ogni giorno le ore programmate e se è festività.
 * Il primo e l'ultimo giorno del rapporto limitano il calcolo.
 */
export function calendarioMese(rapporto, anno, mese) {
  const t = tabelleAnno(anno);
  const giorni = [];
  for (let g = 1; g <= giorniNelMese(anno, mese); g++) {
    const iso = isoDate(anno, mese, g);
    const attivo =
      iso >= rapporto.dataAssunzione && (!rapporto.dataCessazione || iso <= rapporto.dataCessazione);
    giorni.push({
      data: iso,
      giornoSettimana: giornoSettimana(iso),
      festivita: t.festivita.includes(iso),
      oreProgrammate: attivo ? rapporto.orario[giornoSettimana(iso)] || 0 : 0,
      attivo,
    });
  }
  return giorni;
}

/** Ore ordinarie "previste" nel mese: ore programmate esclusi i giorni festivi. */
export function orePreviste(rapporto, anno, mese) {
  return ore2(
    calendarioMese(rapporto, anno, mese)
      .filter((g) => !g.festivita)
      .reduce((s, g) => s + g.oreProgrammate, 0)
  );
}

// ---------- Contributi ----------
export function retribuzioneOrariaEffettiva(pagaOraria) {
  // non convivente: paga oraria + 1/12 per la quota di tredicesima
  return euro(pagaOraria + pagaOraria / 12);
}

export function fasciaContributiva(rapporto, anno) {
  const t = tabelleAnno(anno).inps;
  const tab = rapporto.tipoContratto === 'determinato' ? t.determinato : t.indeterminato;
  const settimanali = oreSettimanali(rapporto.orario);
  const effettiva = retribuzioneOrariaEffettiva(rapporto.pagaOraria);
  let fascia, nome;
  if (settimanali > t.sogliaOreSettimanali) {
    fascia = tab.oltre24;
    nome = `oltre ${t.sogliaOreSettimanali} ore settimanali`;
  } else {
    const idx = tab.fasce.findIndex((f) => effettiva <= f.fino);
    fascia = tab.fasce[idx];
    nome = `fascia ${idx + 1} (retribuzione oraria effettiva ${effettiva.toFixed(2)} €)`;
  }
  const totale = rapporto.cuaf === false ? fascia.senzaCuaf : fascia.conCuaf;
  return {
    nome,
    retribuzioneEffettiva: effettiva,
    totaleOrario: totale,
    lavoratoreOrario: fascia.lavoratore,
    datoreOrario: euro(totale - fascia.lavoratore),
  };
}

// ---------- Cedolino ----------
/**
 * @param rapporto  { pagaOraria, orario, dataAssunzione, dataCessazione?, livello,
 *                    tipoContratto: 'indeterminato'|'determinato', cuaf: bool,
 *                    tredicesimaMensile: bool, cassaColf: bool }
 * @param presenze  { anno, mese,
 *                    oreOrdinarie?          (default: ore previste del mese meno ferie/malattia),
 *                    oreAggiuntive?         (ore extra pagate a tariffa normale),
 *                    straordinari?: { diurno, notturno, festivo },
 *                    oreFerie?              (ore di ferie godute),
 *                    malattia?: [{ inizio, fine }],
 *                    festivitaLavorate?     (ore lavorate in giorno festivo, oltre la festività pagata) }
 * @param stato     contatori progressivi { ferieResidueOre, tfrAccantonato, tredicesimaMaturata,
 *                    anno, giorniMalattiaAnno }
 */
export function calcolaCedolino(rapporto, presenze, stato = {}) {
  const { anno, mese } = presenze;
  const t = tabelleAnno(anno);
  const R = REGOLE_CCNL;
  const paga = rapporto.pagaOraria;
  const settimanali = oreSettimanali(rapporto.orario);
  const cal = calendarioMese(rapporto, anno, mese);
  const avvisi = [];

  // Contatori: si azzerano quelli annuali al cambio d'anno
  const s = {
    ferieResidueOre: stato.ferieResidueOre ?? 0,
    tfrAccantonato: stato.tfrAccantonato ?? 0,
    tredicesimaMaturata: stato.anno === anno ? stato.tredicesimaMaturata ?? 0 : 0,
    giorniMalattiaAnno: stato.anno === anno ? stato.giorniMalattiaAnno ?? 0 : 0,
  };

  // Controllo minimo contrattuale
  const minimo = t.minimiOrariNonConviventi[rapporto.livello];
  if (minimo && paga < minimo) {
    avvisi.push(`Paga oraria ${paga.toFixed(2)} € sotto il minimo del livello ${rapporto.livello} (${minimo.toFixed(2)} €).`);
  }

  const voci = [];
  const voce = (codice, descrizione, quantita, tariffa, extra = {}) => {
    const importo = euro(quantita * tariffa);
    if (quantita > 0) voci.push({ codice, descrizione, quantita: ore2(quantita), unita: 'ore', tariffa: euro(tariffa), importo, ...extra });
    return importo;
  };

  // --- Malattia ---
  const anzianita = mesiAnzianita(rapporto.dataAssunzione, isoDate(anno, mese, giorniNelMese(anno, mese)));
  const regolaMal = R.malattia.find((r) => anzianita < r.finoMesi);
  let oreMalattia50 = 0, oreMalattia100 = 0, oreMalattiaNonPagate = 0, oreMalattiaProgrammate = 0;
  for (const ev of presenze.malattia || []) {
    for (const g of cal) {
      if (g.data < ev.inizio || g.data > ev.fine) continue;
      const giornoEvento = diffGiorni(ev.inizio, g.data) + 1;
      const dentroLimite = s.giorniMalattiaAnno < regolaMal.giorniRetribuiti;
      s.giorniMalattiaAnno += 1; // giorni di calendario
      if (g.festivita) continue; // la festività viene pagata come tale
      oreMalattiaProgrammate += g.oreProgrammate;
      if (!dentroLimite) oreMalattiaNonPagate += g.oreProgrammate;
      else if (giornoEvento <= 3) oreMalattia50 += g.oreProgrammate;
      else oreMalattia100 += g.oreProgrammate;
    }
  }
  if (s.giorniMalattiaAnno > regolaMal.comportoGiorni) {
    avvisi.push(`Malattia oltre il periodo di conservazione del posto (${regolaMal.comportoGiorni} giorni): verificare con un consulente prima di qualsiasi decisione.`);
  }

  // --- Ore ordinarie ---
  const oreFerie = presenze.oreFerie || 0;
  const previste = cal.filter((g) => !g.festivita).reduce((x, g) => x + g.oreProgrammate, 0);
  const oreOrdinarie = presenze.oreOrdinarie ?? Math.max(0, previste - oreFerie - oreMalattiaProgrammate);

  let imponibile = 0; // base per 13ª e TFR (esclusi straordinari)
  imponibile += voce('ORD', 'Ore ordinarie lavorate', oreOrdinarie, paga);
  imponibile += voce('AGG', 'Ore aggiuntive (tariffa normale)', presenze.oreAggiuntive || 0, paga);

  // --- Festività: 1/6 dell'orario settimanale per ciascuna festività del mese (rapporto attivo) ---
  const nFest = cal.filter((g) => g.festivita && g.attivo).length;
  const oreFest = nFest * (settimanali / R.divisoreFestivita);
  imponibile += voce('FES', `Festività retribuite (${nFest})`, oreFest, paga);

  // --- Ferie ---
  imponibile += voce('FER', 'Ferie godute', oreFerie, paga);

  // --- Malattia ---
  imponibile += voce('MAL50', 'Malattia giorni 1-3 (50%)', oreMalattia50, paga * R.malattiaPercentuali.primiTreGiorni);
  imponibile += voce('MAL100', 'Malattia dal 4° giorno (100%)', oreMalattia100, paga);
  if (oreMalattiaNonPagate > 0) {
    avvisi.push(`${ore2(oreMalattiaNonPagate)} ore di malattia oltre i ${regolaMal.giorniRetribuiti} giorni retribuiti nell'anno: assenza giustificata ma non pagata.`);
  }

  // --- Straordinari e lavoro festivo (non entrano nella base di 13ª e TFR) ---
  const st = presenze.straordinari || {};
  let straord = 0;
  straord += voce('STD', 'Straordinario diurno (+25%)', st.diurno || 0, paga * (1 + R.maggiorazioni.diurno));
  straord += voce('STN', 'Straordinario notturno (+50%)', st.notturno || 0, paga * (1 + R.maggiorazioni.notturno));
  straord += voce('STF', 'Straordinario domenicale/festivo (+60%)', st.festivo || 0, paga * (1 + R.maggiorazioni.festivo));
  straord += voce('FLV', 'Ore lavorate in festività (+60%)', presenze.festivitaLavorate || 0, paga * (1 + R.maggiorazioni.festivo));

  // --- 13ª ---
  const rateo13 = euro(imponibile / 12);
  let tredicesimaPagata = 0;
  if (rapporto.tredicesimaMensile) {
    tredicesimaPagata = rateo13;
    voci.push({ codice: '13M', descrizione: 'Rateo tredicesima (pagato mensilmente)', quantita: null, unita: null, tariffa: null, importo: rateo13 });
  } else {
    s.tredicesimaMaturata = euro(s.tredicesimaMaturata + rateo13);
    const ultimoMese = mese === 12 || (rapporto.dataCessazione && rapporto.dataCessazione.slice(0, 7) === isoDate(anno, mese, 1).slice(0, 7));
    if (ultimoMese) {
      tredicesimaPagata = s.tredicesimaMaturata;
      voci.push({ codice: '13A', descrizione: 'Tredicesima mensilità', quantita: null, unita: null, tariffa: null, importo: tredicesimaPagata });
      s.tredicesimaMaturata = 0;
    }
  }

  const lordo = euro(imponibile + straord + tredicesimaPagata);

  // --- Contributi ---
  const fascia = fasciaContributiva(rapporto, anno);
  const oreContributive = ore2(
    oreOrdinarie + (presenze.oreAggiuntive || 0) + oreFest + oreFerie + oreMalattia50 + oreMalattia100 +
    (st.diurno || 0) + (st.notturno || 0) + (st.festivo || 0) + (presenze.festivitaLavorate || 0)
  );
  const inpsLavoratore = euro(oreContributive * fascia.lavoratoreOrario);
  const inpsDatore = euro(oreContributive * fascia.datoreOrario);
  const cc = rapporto.cassaColf === false ? { datore: 0, lavoratore: 0 } : t.cassaColf;
  const cassaLavoratore = euro(oreContributive * cc.lavoratore);
  const cassaDatore = euro(oreContributive * cc.datore);

  const trattenute = [
    { codice: 'INPS', descrizione: `Contributi INPS a carico lavoratrice (${oreContributive} h × ${fascia.lavoratoreOrario.toFixed(2)} €)`, importo: inpsLavoratore },
  ];
  if (cassaLavoratore > 0) {
    trattenute.push({ codice: 'CCOLF', descrizione: `Cassa Colf a carico lavoratrice (${oreContributive} h × ${cc.lavoratore.toFixed(2)} €)`, importo: cassaLavoratore });
  }
  const totTrattenute = euro(trattenute.reduce((x, v) => x + v.importo, 0));
  const netto = euro(lordo - totTrattenute);

  // --- TFR: (imponibile del mese + rateo 13ª) / 13,5 ---
  const tfrMese = euro((imponibile + rateo13) / R.divisoreTfr);
  s.tfrAccantonato = euro(s.tfrAccantonato + tfrMese);

  // --- Ferie: maturazione in ore ---
  const ferieMaturateMese = (R.giorniFerieAnnui * (settimanali / 6)) / 12;
  s.ferieResidueOre = Math.round((s.ferieResidueOre + ferieMaturateMese - oreFerie) * 1e6) / 1e6;
  if (s.ferieResidueOre < 0) avvisi.push('Ferie godute oltre quelle maturate.');

  // --- Costo per il datore (competenza del mese) ---
  const costoDatore = euro(imponibile + straord + rateo13 + tfrMese + inpsDatore + cassaDatore);

  return {
    periodo: { anno, mese },
    voci,
    lordo,
    trattenute,
    totaleTrattenute: totTrattenute,
    netto,
    contributi: {
      fascia: fascia.nome,
      oreContributive,
      orarioTotale: fascia.totaleOrario,
      inpsLavoratore,
      inpsDatore,
      inpsTotale: euro(inpsLavoratore + inpsDatore),
      cassaColfLavoratore: cassaLavoratore,
      cassaColfDatore: cassaDatore,
      daVersareAInps: euro(inpsLavoratore + inpsDatore + cassaLavoratore + cassaDatore),
    },
    accantonamenti: {
      rateoTredicesima: rateo13,
      tfrMese,
      ferieMaturateOre: ore2(ferieMaturateMese),
    },
    costoDatore,
    contatori: { ...s, anno },
    anzianitaMesi: anzianita,
    avvisi,
  };
}

// ---------- Simulatore costo medio ----------
/**
 * Costo medio mensile su base annua (52 settimane / 12), utile per confrontare tariffe.
 */
export function simulaCosto({ pagaOraria, oreSettimanaliTot, anno, tipoContratto = 'indeterminato', cuaf = true, cassaColf = true }) {
  const orario = { 1: oreSettimanaliTot }; // solo il totale conta per il simulatore
  const rapporto = { pagaOraria, orario, tipoContratto, cuaf };
  const t = tabelleAnno(anno);
  const oreMese = ore2((oreSettimanaliTot * 52) / 12);
  const retribuzione = euro(oreMese * pagaOraria);
  const rateo13 = euro(retribuzione / 12);
  const fascia = fasciaContributiva(rapporto, anno);
  const cc = cassaColf ? t.cassaColf : { datore: 0, lavoratore: 0 };
  const inpsDatore = euro(oreMese * fascia.datoreOrario);
  const inpsLavoratore = euro(oreMese * fascia.lavoratoreOrario);
  const cassaDatore = euro(oreMese * cc.datore);
  const cassaLavoratore = euro(oreMese * cc.lavoratore);
  const tfr = euro((retribuzione + rateo13) / REGOLE_CCNL.divisoreTfr);
  const costoMensile = euro(retribuzione + rateo13 + inpsDatore + cassaDatore + tfr);
  return {
    oreMese,
    fascia: fascia.nome,
    retribuzione,
    rateo13,
    inpsDatore,
    cassaColfDatore: cassaDatore,
    tfr,
    costoMensile,
    costoAnnuo: euro(costoMensile * 12),
    nettoMedioLavoratrice: euro(retribuzione + rateo13 - inpsLavoratore - cassaLavoratore),
    versamentoTrimestraleInps: euro((inpsDatore + inpsLavoratore + cassaDatore + cassaLavoratore) * 3),
  };
}

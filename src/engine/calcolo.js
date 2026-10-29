import { fmtEur, fmtOre } from './formato.js';
// Motore di calcolo del cedolino per lavoro domestico non convivente pagato a ore.
// Funzioni pure: ricevono dati, restituiscono risultati. Nessun accesso a rete o archivio.

import { tabelleAnno, REGOLE_CCNL, tipologia, minimoContrattuale } from './tabelle.js';

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

// ---------- Rapporti con paga mensile ----------
/** Paga oraria equivalente di una retribuzione mensile (52 settimane / 12 mesi). */
export function pagaOrariaDaMensile(pagaMensile, settimanali) {
  return settimanali > 0 ? euro((pagaMensile * 12) / (52 * settimanali)) : 0;
}

/**
 * Completa i dati del rapporto: per le tipologie mensili ricava la paga oraria equivalente,
 * usata per straordinari, ore aggiuntive, ferie non godute e fascia INPS.
 */
export function normalizzaRapporto(d) {
  if (!d || !tipologia(d).mensile) return d;
  return { ...d, pagaOraria: pagaOrariaDaMensile(Number(d.pagaMensile) || 0, oreSettimanali(d.orario || {})) };
}

const giorniLavoroSettimana = (orario) => Object.values(orario || {}).filter((h) => h > 0).length;

/** Valore convenzionale mensile di vitto e alloggio (26 giornate), se forniti in natura. */
export function valoreVittoAlloggioMese(rapporto, anno) {
  if (!tipologia(rapporto).mensile || !rapporto.vittoAlloggio) return 0;
  return euro(tabelleAnno(anno).vittoAlloggio.totale * 26);
}

// ---------- Contributi ----------
/**
 * Retribuzione oraria effettiva per la fascia INPS: paga oraria + 1/12 di tredicesima
 * (+ quota oraria di vitto e alloggio, se forniti al lavoratore convivente).
 */
export function retribuzioneOrariaEffettiva(pagaOraria, rapporto = null, anno = null) {
  let va = 0;
  if (rapporto?.vittoAlloggio && tipologia(rapporto).mensile && anno) {
    const sett = oreSettimanali(rapporto.orario || {});
    if (sett > 0) va = (tabelleAnno(anno).vittoAlloggio.totale * giorniLavoroSettimana(rapporto.orario)) / sett;
  }
  return euro(pagaOraria + pagaOraria / 12 + va);
}

export function fasciaContributiva(rapporto0, anno) {
  const rapporto = normalizzaRapporto(rapporto0);
  const t = tabelleAnno(anno).inps;
  // a termine: contributo aggiuntivo, salvo i contratti per sostituire lavoratori assenti
  const tab = rapporto.tipoContratto === 'determinato' && !rapporto.sostituzione ? t.determinato : t.indeterminato;
  const settimanali = oreSettimanali(rapporto.orario);
  const effettiva = retribuzioneOrariaEffettiva(rapporto.pagaOraria, rapporto, anno);
  let fascia, nome;
  if (settimanali > t.sogliaOreSettimanali) {
    fascia = tab.oltre24;
    nome = `oltre ${t.sogliaOreSettimanali} ore settimanali`;
  } else {
    const idx = tab.fasce.findIndex((f) => effettiva <= f.fino);
    fascia = tab.fasce[idx];
    nome = `fascia ${idx + 1} (retribuzione oraria effettiva ${fmtEur(effettiva)})`;
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
export function calcolaCedolino(rapporto0, presenze, stato = {}) {
  const rapporto = normalizzaRapporto(rapporto0);
  const { anno, mese } = presenze;
  const t = tabelleAnno(anno);
  const R = REGOLE_CCNL;
  const tip = tipologia(rapporto);
  const mensile = tip.mensile;
  const pagaMensile = Number(rapporto.pagaMensile) || 0;
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
    tfrFondoInizioAnno: stato.tfrFondoInizioAnno ?? 0,
    anticipoTfrAnno: stato.anno === anno ? stato.anticipoTfrAnno ?? 0 : 0,
  };
  if (t.provvisorie) {
    avvisi.push(`Tabelle ${anno} non ancora inserite: calcolo provvisorio con i valori ${t.annoTabelle}.`);
  }

  // Rivalutazione annuale del TFR: al primo mese di un nuovo anno si rivaluta il fondo
  // esistente al 31/12 dell'anno prima di quello appena chiuso.
  let rivalutazioneTfr = 0;
  if (stato.anno && stato.anno < anno) {
    const infl = tabelleAnno(stato.anno).inflazioneTfr;
    const tasso = R.rivalutazioneTfrFissa + (infl != null ? R.rivalutazioneTfrQuotaIstat * infl : 0);
    rivalutazioneTfr = euro(s.tfrFondoInizioAnno * tasso);
    if (infl == null && s.tfrFondoInizioAnno > 0) {
      avvisi.push(`Rivalutazione TFR ${stato.anno} calcolata solo sulla quota fissa 1,5%: manca il dato ISTAT di dicembre.`);
    }
    s.tfrAccantonato = euro(s.tfrAccantonato + rivalutazioneTfr);
    s.tfrFondoInizioAnno = s.tfrAccantonato;
  }

  // Controllo minimo contrattuale
  const minimo = minimoContrattuale(t, rapporto);
  if (mensile) {
    if (minimo && pagaMensile < minimo) avvisi.push(`Retribuzione mensile ${fmtEur(pagaMensile)} sotto il minimo (${tip.breve}, livello ${rapporto.livello}: ${fmtEur(minimo)}).`);
    if (minimo == null) avvisi.push(`Il livello ${rapporto.livello} non è previsto per: ${tip.breve.toLowerCase()}.`);
    if (tip.maxSettimanali && settimanali > tip.maxSettimanali) avvisi.push(`Orario di ${fmtOre(settimanali)} h oltre il massimo di ${tip.maxSettimanali} h settimanali.`);
  } else if (minimo && paga < minimo) {
    avvisi.push(`Paga oraria ${fmtEur(paga)} sotto il minimo del livello ${rapporto.livello} (${fmtEur(minimo)}).`);
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
  let giorniMal50 = 0, giorniMalNonPagati = 0;
  for (const ev of presenze.malattia || []) {
    for (const g of cal) {
      if (g.data < ev.inizio || g.data > ev.fine) continue;
      const giornoEvento = diffGiorni(ev.inizio, g.data) + 1;
      const dentroLimite = s.giorniMalattiaAnno < regolaMal.giorniRetribuiti;
      s.giorniMalattiaAnno += 1; // giorni di calendario
      if (g.festivita) continue; // la festività viene pagata come tale
      oreMalattiaProgrammate += g.oreProgrammate;
      const lavorativo = g.oreProgrammate > 0;
      if (!dentroLimite) { oreMalattiaNonPagate += g.oreProgrammate; if (lavorativo) giorniMalNonPagati++; }
      else if (giornoEvento <= 3) { oreMalattia50 += g.oreProgrammate; if (lavorativo) giorniMal50++; }
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
  const nFest = cal.filter((g) => g.festivita && g.attivo).length;
  const oreFest = nFest * (settimanali / R.divisoreFestivita);

  if (mensile) {
    // Retribuzione mensile fissa: comprende ferie, festività, permessi e malattia retribuita.
    // Nei mesi di inizio o fine rapporto si paga 1/26 per ogni giornata (domeniche escluse).
    const giornaliera = pagaMensile / 26;
    const meseIntero = cal.every((g) => g.attivo);
    if (meseIntero) {
      imponibile += voce('MEN', `Retribuzione mensile (${tip.breve.toLowerCase()})`, 1, pagaMensile, { unita: 'mese' });
    } else {
      const gg = Math.min(26, cal.filter((g) => g.attivo && g.giornoSettimana !== 7).length);
      imponibile += voce('MEN', `Retribuzione per ${gg} giornate (1/26)`, gg, giornaliera, { unita: 'gg' });
    }
    const giorniAssenza = presenze.giorniAssenza || 0;
    imponibile += voce('ASS', 'Assenze non retribuite (1/26)', giorniAssenza, -giornaliera, { unita: 'gg' });
    imponibile += voce('MAL50', 'Malattia giorni 1-3: riduzione 50%', giorniMal50, -giornaliera * (1 - R.malattiaPercentuali.primiTreGiorni), { unita: 'gg' });
    imponibile += voce('MALNP', 'Malattia oltre i giorni retribuiti', giorniMalNonPagati, -giornaliera, { unita: 'gg' });
    imponibile += voce('AGG', 'Ore aggiuntive (tariffa normale)', presenze.oreAggiuntive || 0, paga);
  } else {
    imponibile += voce('ORD', 'Ore ordinarie lavorate', oreOrdinarie, paga);
    imponibile += voce('AGG', 'Ore aggiuntive (tariffa normale)', presenze.oreAggiuntive || 0, paga);

    // --- Festività: 1/6 dell'orario settimanale per ciascuna festività del mese (rapporto attivo) ---
    imponibile += voce('FES', `Festività retribuite (${nFest})`, oreFest, paga);

    // --- Ferie e permessi retribuiti ---
    imponibile += voce('FER', 'Ferie godute', oreFerie, paga);
    imponibile += voce('PER', 'Permessi retribuiti', presenze.orePermessi || 0, paga);

    // --- Malattia ---
    imponibile += voce('MAL50', 'Malattia giorni 1-3 (50%)', oreMalattia50, paga * R.malattiaPercentuali.primiTreGiorni);
    imponibile += voce('MAL100', 'Malattia dal 4° giorno (100%)', oreMalattia100, paga);
  }
  imponibile = euro(imponibile);
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

  // --- 13ª --- (per i conviventi comprende il valore convenzionale di vitto e alloggio)
  const vittoAlloggio = valoreVittoAlloggioMese(rapporto, anno);
  const rateo13 = euro((imponibile + vittoAlloggio) / 12);
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

  // --- Anticipo TFR (non soggetto a contributi, pagato insieme allo stipendio) ---
  const anticipoTfr = euro(presenze.anticipoTfr || 0);
  if (anticipoTfr > 0) {
    const max = euro(s.tfrAccantonato * R.anticipoTfrMassimo);
    if (anticipoTfr > max) avvisi.push(`Anticipo TFR oltre il 70% del maturato (massimo ${fmtEur(max)}).`);
    if (s.anticipoTfrAnno > 0) avvisi.push('Il CCNL prevede un solo anticipo TFR l\'anno.');
    s.tfrAccantonato = euro(s.tfrAccantonato - anticipoTfr);
    s.anticipoTfrAnno = euro(s.anticipoTfrAnno + anticipoTfr);
  }

  // --- Contributi ---
  const fascia = fasciaContributiva(rapporto, anno);
  const oreContributive = ore2(
    oreOrdinarie + (presenze.oreAggiuntive || 0) + oreFest + oreFerie + (presenze.orePermessi || 0) + oreMalattia50 + oreMalattia100 +
    (st.diurno || 0) + (st.notturno || 0) + (st.festivo || 0) + (presenze.festivitaLavorate || 0)
  );
  const inpsLavoratore = euro(oreContributive * fascia.lavoratoreOrario);
  const inpsDatore = euro(oreContributive * fascia.datoreOrario);
  const cc = rapporto.cassaColf === false ? { datore: 0, lavoratore: 0 } : t.cassaColf;
  const cassaLavoratore = euro(oreContributive * cc.lavoratore);
  const cassaDatore = euro(oreContributive * cc.datore);

  const trattenute = [
    { codice: 'INPS', descrizione: `Contributi INPS a carico lavoratrice (${fmtOre(oreContributive)} h × ${fmtEur(fascia.lavoratoreOrario)})`, importo: inpsLavoratore },
  ];
  if (cassaLavoratore > 0) {
    trattenute.push({ codice: 'CCOLF', descrizione: `Cassa Colf a carico lavoratrice (${fmtOre(oreContributive)} h × ${fmtEur(cc.lavoratore)})`, importo: cassaLavoratore });
  }
  const totTrattenute = euro(trattenute.reduce((x, v) => x + v.importo, 0));
  const netto = euro(lordo - totTrattenute + anticipoTfr);

  // --- TFR: (imponibile del mese + rateo 13ª) / 13,5 ---
  const tfrMese = euro((imponibile + vittoAlloggio + rateo13) / R.divisoreTfr);
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
    anticipoTfr,
    oreLavorate: ore2(oreOrdinarie + (presenze.oreAggiuntive || 0) + (st.diurno || 0) + (st.notturno || 0) + (st.festivo || 0) + (presenze.festivitaLavorate || 0)),
    tipologia: rapporto.tipologia || 'ore',
    vittoAlloggioMese: vittoAlloggio,
    accantonamenti: {
      rivalutazioneTfr,
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
export function simulaCosto({ pagaOraria, oreSettimanaliTot, anno, tipoContratto = 'indeterminato', cuaf = true, cassaColf = true, tipologia: tipo = 'ore', pagaMensile = 0, vittoAlloggio = false, livello = null }) {
  const orario = { 1: oreSettimanaliTot }; // solo il totale conta per il simulatore
  const mensile = tipologia({ tipologia: tipo }).mensile;
  if (mensile) {
    // per vitto e alloggio servono i giorni di lavoro: si assumono 6 giorni a settimana
    for (let g = 1; g <= 6; g++) orario[g] = oreSettimanaliTot / 6;
    pagaOraria = pagaOrariaDaMensile(pagaMensile, oreSettimanaliTot);
  }
  const rapporto = { pagaOraria, orario, tipoContratto, cuaf, tipologia: tipo, pagaMensile, vittoAlloggio, livello };
  const t = tabelleAnno(anno);
  const oreMese = ore2((oreSettimanaliTot * 52) / 12);
  const retribuzione = mensile ? euro(pagaMensile) : euro(oreMese * pagaOraria);
  const va = valoreVittoAlloggioMese(rapporto, anno);
  const rateo13 = euro((retribuzione + va) / 12);
  const fascia = fasciaContributiva(rapporto, anno);
  const cc = cassaColf ? t.cassaColf : { datore: 0, lavoratore: 0 };
  const inpsDatore = euro(oreMese * fascia.datoreOrario);
  const inpsLavoratore = euro(oreMese * fascia.lavoratoreOrario);
  const cassaDatore = euro(oreMese * cc.datore);
  const cassaLavoratore = euro(oreMese * cc.lavoratore);
  const tfr = euro((retribuzione + va + rateo13) / REGOLE_CCNL.divisoreTfr);
  const minimo = livello ? minimoContrattuale(t, rapporto) : null;
  const costoMensile = euro(retribuzione + rateo13 + inpsDatore + cassaDatore + tfr);
  return {
    oreMese,
    pagaOraria,
    minimo,
    mensile,
    vittoAlloggioMese: va,
    fascia: fascia.nome,
    retribuzione,
    rateo13,
    inpsDatore,
    cassaColfDatore: cassaDatore,
    tfr,
    costoMensile,
    costoAnnuo: euro(costoMensile * 12),
    nettoMedioLavoratrice: euro(retribuzione + rateo13 - inpsLavoratore - cassaLavoratore),
    // paga oraria netta: lorda meno contributi a carico della lavoratrice (nessuna IRPEF trattenuta)
    pagaNettaOraria: euro(pagaOraria - fascia.lavoratoreOrario - cc.lavoratore),
    // netta oraria comprensiva della quota di tredicesima
    nettaOrariaCon13: oreMese ? euro((retribuzione + rateo13 - inpsLavoratore - cassaLavoratore) / oreMese) : 0,
    costoOrario: oreMese ? euro(costoMensile / oreMese) : 0,
    versamentoTrimestraleInps: euro((inpsDatore + inpsLavoratore + cassaDatore + cassaLavoratore) * 3),
  };
}

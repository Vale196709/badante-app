// Tabelle annuali CCNL Lavoro Domestico e INPS.
// Ogni anno si aggiunge un nuovo blocco: il codice di calcolo non cambia.
// Se per un anno mancano le tabelle si usano quelle dell'ultimo anno disponibile
// e il calcolo lo segnala come "provvisorio".

export const TABELLE = {
  2026: {
    anno: 2026,
    fonti: [
      'Minimi: accordo parti sociali 11/02/2026',
      'Contributi: Circolare INPS n. 9 del 3/2/2026',
    ],

    // Minimi retributivi orari per lavoratori NON conviventi (Tabella C), dal 1/1/2026.
    minimiOrariNonConviventi: {
      A: 6.51,
      AS: 6.76,
      B: 7.01,
      BS: 7.45,
      C: 7.86,
      CS: 8.30,
      D: 9.57,
      DS: 9.97,
    },

    // Minimi mensili per lavoratori conviventi a tempo pieno (Tabella A).
    // Ai livelli D e DS si aggiunge l'indennità di funzione.
    minimiMensiliConviventi: { A: 908.10, AS: 958.55, B: 983.16, BS: 1053.39, C: 1123.63, CS: 1193.84, D: 1404.51, DS: 1474.73 },
    indennitaFunzione: { D: 207.69, DS: 207.69 },
    // Conviventi a tempo parziale, massimo 30 ore settimanali (Tabella B).
    minimiMensiliConviventiPT: { B: 702.25, BS: 737.39, C: 814.60 },
    // Assistenza notturna a persone non autosufficienti, mensile (Tabella D).
    minimiAssistenzaNotturna: { BS: 1211.38, CS: 1372.91, DS: 1695.99 },
    // Presenza notturna, livello unico mensile (Tabella E).
    minimoPresenzaNotturna: 811.09,
    // Indennità giornaliera di vitto e alloggio (Tabella F).
    vittoAlloggio: { pranzoColazione: 2.33, cena: 2.33, alloggio: 2.00, totale: 6.66 },

    // Contributi INPS orari. La fascia si sceglie sulla "retribuzione oraria effettiva" =
    // paga oraria + vitto/alloggio orario (conviventi) + quota oraria di 13ª (1/12).
    inps: {
      sogliaOreSettimanali: 24,
      indeterminato: {
        fasce: [
          { fino: 9.61, conv: 8.52, conCuaf: 1.70, senzaCuaf: 1.71, lavoratore: 0.43 },
          { fino: 11.70, conv: 9.61, conCuaf: 1.92, senzaCuaf: 1.93, lavoratore: 0.48 },
          { fino: Infinity, conv: 11.70, conCuaf: 2.34, senzaCuaf: 2.34, lavoratore: 0.59 },
        ],
        oltre24: { conv: 6.20, conCuaf: 1.24, senzaCuaf: 1.25, lavoratore: 0.31 },
      },
      determinato: {
        fasce: [
          { fino: 9.61, conv: 8.52, conCuaf: 1.82, senzaCuaf: 1.83, lavoratore: 0.43 },
          { fino: 11.70, conv: 9.61, conCuaf: 2.05, senzaCuaf: 2.06, lavoratore: 0.48 },
          { fino: Infinity, conv: 11.70, conCuaf: 2.50, senzaCuaf: 2.51, lavoratore: 0.59 },
        ],
        oltre24: { conv: 6.20, conCuaf: 1.32, senzaCuaf: 1.33, lavoratore: 0.31 },
      },
    },

    // Contributo di assistenza contrattuale Cas.Sa.Colf, versato insieme ai contributi INPS.
    cassaColf: { datore: 0.04, lavoratore: 0.02, daVerificare: true },

    // Inflazione ISTAT (FOI) dicembre/dicembre per la rivalutazione del TFR dell'anno.
    // null finché ISTAT non pubblica il dato di dicembre (a metà gennaio dell'anno dopo).
    inflazioneTfr: null,
  },
};

// Tipologie di rapporto. Quelle "mensili" hanno una retribuzione fissa al mese.
export const TIPOLOGIE = {
  ore: { nome: 'Non convivente, pagata a ore', breve: 'A ore', mensile: false },
  convivente: { nome: 'Convivente a tempo pieno (fino a 54 h/sett.)', breve: 'Convivente', mensile: true, maxSettimanali: 54, minimi: 'minimiMensiliConviventi', vitto: true },
  conviventePT: { nome: 'Convivente part-time (fino a 30 h/sett.)', breve: 'Convivente part-time', mensile: true, maxSettimanali: 30, minimi: 'minimiMensiliConviventiPT', vitto: true },
  notturna: { nome: 'Assistenza notturna a non autosufficienti', breve: 'Assistenza notturna', mensile: true, minimi: 'minimiAssistenzaNotturna', vitto: false },
  presenza: { nome: 'Presenza notturna (dalle 21 alle 8)', breve: 'Presenza notturna', mensile: true, minimi: 'minimoPresenzaNotturna', vitto: false },
};
export const tipologia = (d) => TIPOLOGIE[d?.tipologia] || TIPOLOGIE.ore;

/** Minimo contrattuale (orario o mensile) per tipologia e livello; null se non previsto. */
export function minimoContrattuale(t, d) {
  const tip = tipologia(d);
  if (!tip.mensile) return t.minimiOrariNonConviventi?.[d.livello] ?? null;
  const tab = t[tip.minimi];
  if (typeof tab === 'number') return tab;
  const base = tab?.[d.livello];
  if (base == null) return null;
  return tip.minimi === 'minimiMensiliConviventi' ? base + (t.indennitaFunzione?.[d.livello] || 0) : base;
}

// Regole del CCNL che non cambiano di anno in anno.
export const REGOLE_CCNL = {
  maggiorazioni: {
    diurno: 0.25,   // straordinario dalle 6 alle 22
    notturno: 0.50, // straordinario dalle 22 alle 6
    festivo: 0.60,  // domenica o festività
  },
  // Ferie: 26 giorni lavorativi l'anno su settimana di 6 giorni.
  // Per i lavoratori a ore: ore ferie annue = 26 × (ore settimanali / 6).
  giorniFerieAnnui: 26,
  // Festività per lavoratori a ore: 1/6 dell'orario settimanale per ogni festività.
  divisoreFestivita: 6,
  // TFR: retribuzione annua (inclusa 13ª) / 13,5; rivalutazione 1,5% + 75% inflazione ISTAT.
  divisoreTfr: 13.5,
  rivalutazioneTfrFissa: 0.015,
  rivalutazioneTfrQuotaIstat: 0.75,
  anticipoTfrMassimo: 0.70, // una volta l'anno
  // Permessi individuali retribuiti (art. 19), ore annue
  permessi: { conviventi: 16, conviventiPT: 12, nonConviventi: 12, oreSogliaPiena: 30 },
  // Scatti di anzianità (art. 37): 4% del minimo per ogni biennio, massimo 7, non assorbibili.
  scattiAnzianita: { percentuale: 0.04, ogniMesi: 24, massimo: 7 },
  // Malattia: giorni retribuiti nell'anno solare e conservazione del posto, per anzianità.
  malattia: [
    { finoMesi: 6, giorniRetribuiti: 8, comportoGiorni: 10 },
    { finoMesi: 24, giorniRetribuiti: 10, comportoGiorni: 45 },
    { finoMesi: Infinity, giorniRetribuiti: 15, comportoGiorni: 180 },
  ],
  malattiaPercentuali: { primiTreGiorni: 0.5, dalQuarto: 1.0 },
  // Preavviso (giorni di calendario) in caso di licenziamento; per le dimissioni è la metà.
  preavviso: [
    { oreDa: 25, finoAnni: 5, giorni: 15 },
    { oreDa: 25, finoAnni: Infinity, giorni: 30 },
    { oreDa: 0, finoAnni: 2, giorni: 8 },
    { oreDa: 0, finoAnni: Infinity, giorni: 15 },
  ],
  // Deduzione IRPEF dei contributi a carico del datore (art. 10 TUIR)
  deduzioneContributiMax: 1549.37,
  // Detrazione 19% spese per addetti all'assistenza di non autosufficienti (art. 15 TUIR)
  detrazioneAssistenza: { aliquota: 0.19, spesaMassima: 2100, limiteReddito: 40000 },
  // Prestazione universale (D.Lgs. 29/2024): assegno di assistenza per over 80 con accompagnamento,
  // ISEE sociosanitario fino a 6.000 €, da usare per lavoro domestico regolare (almeno 15 h/sett.)
  // e da rendicontare ogni trimestre. In vigore fino al 31/12/2026 salvo proroga.
  prestazioneUniversale: { importoMensile: 850, etaMinima: 80, iseeMassimo: 6000, oreMinime: 15, fine: '2026-12-31' },
  // Esonero contributivo per assunzioni a tempo indeterminato da parte di over 80 con accompagnamento
  // (DL 19/2024): finestra 1/4/2024–31/12/2025, mai resa operativa dall'INPS, non rinnovata per il 2026.
  esoneroOver80: { dal: '2024-04-01', al: '2025-12-31', massimoAnnuo: 3000, operativo: false },
};

// ---------- Festività nazionali ----------
function pasqua(anno) {
  // algoritmo di Meeus/Jones/Butcher
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anno, mese - 1, giorno));
}
const iso = (d) => d.toISOString().slice(0, 10);

export const NOMI_FESTIVITA = {
  '01-01': 'Capodanno', '01-06': 'Epifania', '04-25': 'Liberazione', '05-01': 'Festa del lavoro',
  '06-02': 'Festa della Repubblica', '08-15': 'Ferragosto', '10-04': 'San Francesco',
  '11-01': 'Ognissanti', '12-08': 'Immacolata', '12-25': 'Natale', '12-26': 'Santo Stefano',
};

/** Festività nazionali retribuite dell'anno (il 4 ottobre dal 2026). */
export function festivitaAnno(anno) {
  const fisse = Object.keys(NOMI_FESTIVITA).filter((md) => md !== '10-04' || anno >= 2026);
  const p = pasqua(anno);
  const pasquetta = new Date(p.getTime() + 86400000);
  return [...fisse.map((md) => `${anno}-${md}`), iso(pasquetta)].sort();
}

export function nomeFestivita(data) {
  const md = data.slice(5);
  if (NOMI_FESTIVITA[md]) return NOMI_FESTIVITA[md];
  return 'Lunedì dell\'Angelo';
}

// Tabelle inserite dall'utente nell'app (hanno la precedenza su quelle incluse nel codice).
let personalizzate = {};
export function impostaTabellePersonalizzate(mappa) {
  personalizzate = {};
  for (const [anno, dati] of Object.entries(mappa || {})) {
    personalizzate[anno] = ripristinaInfinito({ ...dati, anno: Number(anno) });
  }
}
export function tutteLeTabelle() {
  return { ...TABELLE, ...personalizzate };
}
// In JSON Infinity diventa null: l'ultima fascia INPS non ha limite superiore.
function ripristinaInfinito(t) {
  for (const tipo of ['indeterminato', 'determinato']) {
    const f = t.inps?.[tipo]?.fasce;
    if (f?.length) f[f.length - 1].fino = Infinity;
  }
  return t;
}

/** Tabelle dell'anno; se mancano usa l'ultimo anno disponibile, segnalandolo. */
export function tabelleAnno(anno) {
  const tutte = tutteLeTabelle();
  const anni = Object.keys(tutte).map(Number).sort((a, b) => a - b);
  const scelto = tutte[anno] ? anno : anni.filter((a) => a <= anno).pop() ?? anni[0];
  // le tabelle inserite a mano possono non avere le voci per conviventi e notturni:
  // in quel caso si usano quelle dell'ultimo anno incluso nell'app
  const incluso = TABELLE[Math.max(...Object.keys(TABELLE).map(Number).filter((a) => a <= Math.max(scelto, 2026)))];
  return {
    ...incluso,
    ...tutte[scelto],
    festivita: festivitaAnno(anno),
    provvisorie: scelto !== anno,
    annoTabelle: scelto,
    personalizzate: !!personalizzate[scelto],
  };
}

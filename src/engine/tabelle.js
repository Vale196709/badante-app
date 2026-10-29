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
      // C, CS, D, DS: da inserire dopo verifica sulla tabella ministeriale.
    },

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

/** Tabelle dell'anno; se mancano usa l'ultimo anno disponibile, segnalandolo. */
export function tabelleAnno(anno) {
  const anni = Object.keys(TABELLE).map(Number).sort((a, b) => a - b);
  const scelto = TABELLE[anno] ? anno : anni.filter((a) => a <= anno).pop() ?? anni[0];
  return {
    ...TABELLE[scelto],
    festivita: festivitaAnno(anno),
    provvisorie: scelto !== anno,
    annoTabelle: scelto,
  };
}

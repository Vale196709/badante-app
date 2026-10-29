// Tabelle annuali CCNL Lavoro Domestico e INPS.
// Ogni anno si aggiunge un nuovo blocco: il codice di calcolo non cambia.
// Ogni valore riporta la fonte; i valori marcati `daVerificare` vanno ricontrollati
// prima dell'uso definitivo.

export const TABELLE = {
  2026: {
    anno: 2026,

    // Minimi retributivi orari per lavoratori NON conviventi (Tabella C), dal 1/1/2026.
    // Fonte: accordo parti sociali 11/02/2026; Informazione Fiscale, PMI.it.
    minimiOrariNonConviventi: {
      A: 6.51,
      AS: 6.76,
      B: 7.01,
      BS: 7.45,
      // C, CS, D, DS: da inserire dopo verifica sulla tabella ministeriale.
    },

    // Contributi INPS orari 2026 – Circolare INPS n. 9 del 3/2/2026.
    // La fascia si sceglie sulla "retribuzione oraria effettiva" =
    // paga oraria + vitto/alloggio orario (conviventi) + quota oraria di 13ª (1/12).
    inps: {
      sogliaOreSettimanali: 24, // oltre 24 h/sett. si applica il contributo fisso
      indeterminato: {
        fasce: [
          { fino: 9.61, conv: 8.52, conCuaf: 1.70, senzaCuaf: 1.71, lavoratore: 0.43 },
          { fino: 11.70, conv: 9.61, conCuaf: 1.92, senzaCuaf: 1.93, lavoratore: 0.48 },
          { fino: Infinity, conv: 11.70, conCuaf: 2.34, senzaCuaf: 2.34, lavoratore: 0.59 },
        ],
        oltre24: { conv: 6.20, conCuaf: 1.24, senzaCuaf: 1.25, lavoratore: 0.31 },
      },
      // Tempo determinato: include il contributo addizionale 1,40%.
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

    // Festività nazionali retribuite. Dal 2026 torna festivo il 4 ottobre (San Francesco).
    // Pasqua 2026: 5 aprile → Lunedì dell'Angelo 6 aprile.
    festivita: [
      '2026-01-01', '2026-01-06', '2026-04-06', '2026-04-25', '2026-05-01',
      '2026-06-02', '2026-08-15', '2026-10-04', '2026-11-01', '2026-12-08',
      '2026-12-25', '2026-12-26',
    ],
  },
};

// Regole del CCNL che non cambiano di anno in anno.
export const REGOLE_CCNL = {
  // Maggiorazioni straordinario
  maggiorazioni: {
    diurno: 0.25,   // dalle 6 alle 22
    notturno: 0.50, // dalle 22 alle 6
    festivo: 0.60,  // domenica o festività
  },
  // Ferie: 26 giorni lavorativi l'anno su settimana di 6 giorni.
  // Per i lavoratori a ore: ore ferie annue = 26 × (ore settimanali / 6).
  giorniFerieAnnui: 26,
  // Festività per lavoratori a ore: 1/6 dell'orario settimanale per ogni festività.
  divisoreFestivita: 6,
  // TFR: retribuzione annua (inclusa 13ª) / 13,5
  divisoreTfr: 13.5,
  // Malattia: giorni retribuiti nell'anno solare e conservazione del posto, per anzianità.
  malattia: [
    { finoMesi: 6, giorniRetribuiti: 8, comportoGiorni: 10 },
    { finoMesi: 24, giorniRetribuiti: 10, comportoGiorni: 45 },
    { finoMesi: Infinity, giorniRetribuiti: 15, comportoGiorni: 180 },
  ],
  malattiaPercentuali: { primiTreGiorni: 0.5, dalQuarto: 1.0 },
};

export function tabelleAnno(anno) {
  const t = TABELLE[anno];
  if (!t) throw new Error(`Tabelle ${anno} non ancora inserite: aggiornale prima di calcolare.`);
  return t;
}

// Dalle presenze giorno per giorno ai dati del cedolino.
//
// Ogni giorno del mese può avere un record { tipo, ore, extra, extraTipo, nota }:
//   tipo  'L' lavorato · 'F' ferie · 'M' malattia · 'P' permesso retribuito
//         'A' assenza non retribuita · '' giorno senza lavoro programmato
//   ore   per 'L' ore lavorate (oltre l'orario programmato diventano ore aggiuntive);
//         per 'P' ore di permesso (le restanti del giorno si considerano lavorate)
//   extra ore di straordinario aggiunte, con extraTipo 'diurno' | 'notturno'
// I giorni senza record seguono l'orario programmato (lavorato, o festività se festivo).

import { calendarioMese } from './calcolo.js';

export const TIPI = {
  L: 'Lavorato',
  F: 'Ferie',
  M: 'Malattia',
  P: 'Permesso retribuito',
  A: 'Assenza non retribuita',
  '': 'Riposo',
};

/** Record di default per un giorno del calendario. */
export function giornoPredefinito(g) {
  if (!g.attivo) return { tipo: '', ore: 0 };
  if (g.festivita) return { tipo: '', ore: 0 }; // festività pagata a parte
  return g.oreProgrammate > 0 ? { tipo: 'L', ore: g.oreProgrammate } : { tipo: '', ore: 0 };
}

/** Giorni del mese con il record effettivo (salvato o predefinito). */
export function giorniMese(rapporto, anno, mese, salvati = {}) {
  return calendarioMese(rapporto, anno, mese).map((g) => ({
    ...g,
    ...giornoPredefinito(g),
    ...(salvati[g.data] || {}),
  }));
}

/**
 * Converte le presenze giornaliere nel formato del motore.
 * @param malattiaInCorsoDal data d'inizio di una malattia proseguita dal mese precedente
 */
export function presenzeDaGiorni(rapporto, anno, mese, salvati = {}, extra = {}, malattiaInCorsoDal = null) {
  const giorni = giorniMese(rapporto, anno, mese, salvati);
  let oreOrdinarie = 0, oreAggiuntive = 0, oreFerie = 0, orePermessi = 0, festivitaLavorate = 0, giorniAssenza = 0;
  const straordinari = { diurno: 0, notturno: 0, festivo: 0 };
  const malattia = [];
  let corrente = null;

  for (const g of giorni) {
    if (g.tipo === 'M') {
      if (!corrente) {
        corrente = { inizio: g.data === giorni[0].data && malattiaInCorsoDal ? malattiaInCorsoDal : g.data, fine: g.data };
        malattia.push(corrente);
      } else corrente.fine = g.data;
      continue;
    }
    corrente = null;

    if (g.tipo === 'L') {
      const ore = Number(g.ore) || 0;
      if (g.festivita) festivitaLavorate += ore;           // lavoro in festività: +60%
      else if (g.giornoSettimana === 7) straordinari.festivo += ore; // domenica: +60%
      else {
        const prog = g.oreProgrammate;
        oreOrdinarie += Math.min(ore, prog);
        oreAggiuntive += Math.max(0, ore - prog);
      }
    } else if (g.tipo === 'A' && !g.festivita && g.oreProgrammate > 0) {
      giorniAssenza += 1;
    } else if (g.tipo === 'F' && !g.festivita) {
      oreFerie += g.oreProgrammate;
    } else if (g.tipo === 'P' && !g.festivita) {
      // permesso di tutta la giornata o di poche ore: le ore restanti del giorno sono lavorate
      const perm = Math.min(Number(g.ore) || g.oreProgrammate, g.oreProgrammate || Number(g.ore) || 0);
      orePermessi += perm;
      oreOrdinarie += Math.max(0, g.oreProgrammate - perm);
    }
    const ex = Number(g.extra) || 0;
    if (ex > 0) straordinari[g.extraTipo === 'notturno' ? 'notturno' : 'diurno'] += ex;
  }

  const ultimo = giorni[giorni.length - 1];
  return {
    anno,
    mese,
    oreOrdinarie,
    oreAggiuntive,
    oreFerie,
    orePermessi,
    festivitaLavorate,
    giorniAssenza,
    straordinari,
    malattia,
    anticipoTfr: Number(extra.anticipoTfr) || 0,
    // per collegare una malattia che continua nel mese successivo
    malattiaAperta: ultimo?.tipo === 'M' ? malattia[malattia.length - 1].inizio : null,
  };
}

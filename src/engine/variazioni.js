// Variazioni di paga, orario e livello nel tempo. Le condizioni iniziali sono quelle
// della scheda Rapporto; ogni variazione vale dal primo giorno del mese indicato.
import { isoDate, normalizzaRapporto } from './calcolo.js';

export function variazioniOrdinate(d) {
  return [...(d?.variazioni || [])].sort((a, b) => a.dal.localeCompare(b.dal));
}

/** Condizioni in vigore in una data (YYYY-MM-DD). */
export function condizioniAl(d, iso) {
  const c = { ...d };
  for (const v of variazioniOrdinate(d)) {
    if (v.dal > iso) break;
    if (v.pagaOraria != null) c.pagaOraria = v.pagaOraria;
    if (v.pagaMensile != null) c.pagaMensile = v.pagaMensile;
    if (v.orario) c.orario = v.orario;
    if (v.livello) c.livello = v.livello;
  }
  return normalizzaRapporto(c);
}

/** Condizioni del mese: quelle in vigore il primo giorno del mese. */
export const condizioniMese = (d, anno, mese) => condizioniAl(d, isoDate(anno, mese, 1));

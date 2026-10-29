// Calcolo progressivo di tutti i mesi dall'assunzione: i contatori (ferie, TFR, 13ª,
// malattia) di ogni mese dipendono da quelli precedenti.
// I cedolini confermati o pagati restano "congelati": si usa il risultato salvato.

import { calcolaCedolino } from './calcolo.js';
import { presenzeDaGiorni } from './presenze.js';
import { condizioniMese } from './variazioni.js';

export const chiaveMese = (anno, mese) => `${anno}-${String(mese).padStart(2, '0')}`;

function* mesiTra(daIso, aAnno, aMese) {
  let [a, m] = daIso.split('-').map(Number);
  while (a < aAnno || (a === aAnno && m <= aMese)) {
    yield { anno: a, mese: m };
    m++;
    if (m > 12) { m = 1; a++; }
  }
}

/**
 * @param rapporto  dati del rapporto
 * @param cedolini  righe salvate { anno, mese, presenze: { giorni, extra }, risultato, stato }
 * @param fino      { anno, mese } ultimo mese da calcolare (incluso)
 * @returns array di { anno, mese, risultato, presenze, salvato, stato, statoPrima }
 */
export function calcolaCatena(rapporto, cedolini, fino) {
  if (!rapporto?.dataAssunzione || !(rapporto.pagaOraria || rapporto.pagaMensile)) return [];
  const perMese = new Map(cedolini.map((c) => [chiaveMese(c.anno, c.mese), c]));
  let ultimoMese = fino;
  if (rapporto.dataCessazione) {
    const [ca, cm] = rapporto.dataCessazione.split('-').map(Number);
    if (ca < fino.anno || (ca === fino.anno && cm < fino.mese)) ultimoMese = { anno: ca, mese: cm };
  }
  const out = [];
  let stato = {};
  let malattiaAperta = null;
  for (const { anno, mese } of mesiTra(rapporto.dataAssunzione, ultimoMese.anno, ultimoMese.mese)) {
    const salvato = perMese.get(chiaveMese(anno, mese));
    const cond = condizioniMese(rapporto, anno, mese); // paga, orario e livello del mese
    const presenze = presenzeDaGiorni(cond, anno, mese, salvato?.presenze?.giorni, salvato?.presenze?.extra, malattiaAperta);
    let risultato;
    if (salvato && salvato.stato !== 'bozza' && salvato.risultato?.contatori) {
      risultato = salvato.risultato; // congelato
    } else {
      risultato = calcolaCedolino(cond, presenze, stato);
    }
    out.push({ anno, mese, risultato, presenze, salvato: salvato || null, stato: salvato?.stato ?? 'da fare', statoPrima: stato });
    stato = risultato.contatori;
    malattiaAperta = presenze.malattiaAperta;
  }
  return out;
}

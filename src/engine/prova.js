// Periodo di prova (CCNL lavoro domestico 2025-2028, art. 12).
import { oreSettimanali } from './calcolo.js';
import { festivitaAnno } from './tabelle.js';

const addGiorni = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

/** 30 giorni di lavoro effettivo per i conviventi (qualsiasi livello) e per i livelli D e DS; 8 per gli altri. */
export function giorniProvaCcnl(r) {
  const convivente = ['convivente', 'conviventePT'].includes(r.tipologia);
  return convivente || ['D', 'DS'].includes(r.livello) ? 30 : 8;
}

/** Data dell'ultimo giorno di prova: si contano i giorni di lavoro effettivo (giorni dell'orario, esclusi i festivi). */
export function finePeriodoProva(rapporto) {
  const giorniProva = Number(rapporto.giorniProva) || 0;
  if (giorniProva <= 0 || !rapporto.dataAssunzione || !(oreSettimanali(rapporto.orario || {}) > 0)) return null;
  let d = rapporto.dataAssunzione, contati = 0;
  for (let i = 0; i < 400 && contati < giorniProva; i++) {
    const dow = ((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
    if ((rapporto.orario[dow] || 0) > 0 && !festivitaAnno(Number(d.slice(0, 4))).includes(d) && !(rapporto.santoPatrono && d.slice(5) === rapporto.santoPatrono)) contati++;
    if (contati < giorniProva) d = addGiorni(d, 1);
  }
  return d;
}

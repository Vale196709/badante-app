// Coda delle ore segnate senza connessione: restano sul telefono e partono appena torna la rete.
import { segnaOre } from './dati.js';

const chiave = (id) => `badante-ore-coda-${id}`;

export function leggiCoda(rapportoId) {
  try { return JSON.parse(localStorage.getItem(chiave(rapportoId)) || '[]'); } catch { return []; }
}
function scriviCoda(rapportoId, righe) {
  try {
    if (righe.length) localStorage.setItem(chiave(rapportoId), JSON.stringify(righe));
    else localStorage.removeItem(chiave(rapportoId));
    return true;
  } catch { return false; }
}

/** Aggiunge righe alla coda (una per giorno: l'ultima vince). */
export function mettiInCoda(rapportoId, righe) {
  const m = new Map(leggiCoda(rapportoId).map((r) => [r.data, r]));
  for (const r of righe) m.set(r.data, r);
  return scriviCoda(rapportoId, [...m.values()]);
}

/** Errore di rete (non un rifiuto del server). */
export const erroreDiRete = (e) => !navigator.onLine || e instanceof TypeError || /fetch|network|rete|Failed to/i.test(e?.message || '');

/** Prova a inviare la coda; restituisce il numero di giorni inviati. */
export async function svuotaCoda(rapportoId) {
  const righe = leggiCoda(rapportoId);
  if (!righe.length || !navigator.onLine) return 0;
  await segnaOre(rapportoId, righe);
  scriviCoda(rapportoId, []);
  return righe.length;
}

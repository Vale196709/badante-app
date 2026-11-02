// Segnalazione automatica degli errori dell'app (tabella errori_app, script 07).
// Non contiene dati del rapporto: solo il messaggio tecnico, la pagina e il dispositivo.
import { supabase } from './supabase.js';

const inviati = new Set();
let contesto = () => ({});

/** Funzione che restituisce { rapportoId, ruolo, pagina, versione } al momento dell'errore. */
export function impostaContestoErrori(fn) { contesto = fn; }

export async function segnalaErrore(err, extra = '') {
  try {
    const messaggio = String(err?.message || err || 'Errore sconosciuto').slice(0, 500);
    // errori di rete o di accesso scaduto non sono difetti dell'app
    if (/Failed to fetch|NetworkError|Load failed|JWT expired|AbortError/i.test(messaggio)) return;
    const c = contesto();
    const chiave = `${c.pagina}|${messaggio}`;
    if (inviati.has(chiave) || inviati.size > 20) return; // una volta per errore e per sessione
    inviati.add(chiave);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('errori_app').insert({
      rapporto_id: c.rapportoId || null,
      ruolo: c.ruolo || null,
      versione: String(c.versione || '').slice(0, 40),
      pagina: String(c.pagina || '').slice(0, 60),
      messaggio,
      dettaglio: String((err?.stack || '') + (extra ? `\n${extra}` : '')).slice(0, 2000),
      dispositivo: navigator.userAgent.slice(0, 200),
    });
  } catch { /* la segnalazione non deve mai disturbare */ }
}

export function attivaSegnalazioni() {
  window.addEventListener('error', (e) => segnalaErrore(e.error || e.message, `${e.filename || ''}:${e.lineno || ''}`));
  window.addEventListener('unhandledrejection', (e) => segnalaErrore(e.reason));
}

export async function caricaErrori(rapportoId) {
  const { data, error } = await supabase.from('errori_app').select('quando, chi, ruolo, versione, pagina, messaggio, dispositivo')
    .eq('rapporto_id', rapportoId).order('quando', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

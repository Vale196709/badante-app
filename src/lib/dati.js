// Lettura e scrittura dei dati sul cloud (Supabase). Le regole di accesso stanno nel database.
import { supabase } from './supabase.js';

const ok = ({ data, error }) => { if (error) throw error; return data; };

/** Accetta gli inviti per la propria email e restituisce i rapporti visibili con il ruolo. */
export async function caricaContesto(user) {
  try { await supabase.rpc('accetta_inviti'); } catch { /* funzione non ancora installata */ }
  const rapporti = ok(await supabase.from('rapporti').select('id, user_id, dati, contatori, updated_at').order('created_at'));
  const out = [];
  for (const r of rapporti) {
    let ruolo = 'titolare';
    if (r.user_id !== user.id) {
      const acc = ok(await supabase.from('accessi').select('ruolo').eq('rapporto_id', r.id).eq('user_id', user.id).maybeSingle());
      ruolo = acc?.ruolo ?? 'lettore';
    }
    out.push({ ...r, ruolo });
  }
  return out;
}

export async function salvaRapporto(id, dati) {
  const q = id
    ? supabase.from('rapporti').update({ dati }).eq('id', id)
    : supabase.from('rapporti').insert({ dati });
  return ok(await q.select('id, user_id, dati, contatori, updated_at').single());
}

// ---------- Cedolini ----------
export async function caricaCedolini(rapportoId) {
  return ok(await supabase.from('cedolini')
    .select('id, anno, mese, presenze, risultato, stato, pagato_at, ricevuta_at, ricevuta_da, updated_at')
    .eq('rapporto_id', rapportoId).order('anno').order('mese'));
}

export async function salvaCedolino(rapportoId, { anno, mese, presenze, risultato, stato, pagato_at = null }) {
  return ok(await supabase.from('cedolini')
    .upsert({ rapporto_id: rapportoId, anno, mese, presenze, risultato, stato, pagato_at }, { onConflict: 'rapporto_id,anno,mese' })
    .select('id, anno, mese, presenze, risultato, stato, pagato_at, ricevuta_at, ricevuta_da, updated_at').single());
}

export async function firmaRicevuta(cedolinoId) {
  return ok(await supabase.rpc('firma_ricevuta', { cid: cedolinoId }));
}

// ---------- Scadenze ----------
export async function caricaScadenzeFatte(rapportoId) {
  try {
    return new Set(ok(await supabase.from('scadenze_fatte').select('chiave').eq('rapporto_id', rapportoId)).map((r) => r.chiave));
  } catch { return new Set(); }
}

export async function segnaScadenza(rapportoId, chiave, fatta) {
  if (fatta) ok(await supabase.from('scadenze_fatte').upsert({ rapporto_id: rapportoId, chiave }));
  else ok(await supabase.from('scadenze_fatte').delete().eq('rapporto_id', rapportoId).eq('chiave', chiave));
}

// ---------- Accessi ----------
export async function caricaAccessi(rapportoId) {
  const accessi = ok(await supabase.from('accessi').select('user_id, email, ruolo, created_at').eq('rapporto_id', rapportoId).order('created_at'));
  const inviti = ok(await supabase.from('inviti').select('id, email, ruolo, created_at').eq('rapporto_id', rapportoId).order('created_at'));
  return { accessi, inviti };
}

export async function creaInvito(rapportoId, email, ruolo) {
  return ok(await supabase.from('inviti').upsert({ rapporto_id: rapportoId, email: email.trim().toLowerCase(), ruolo }, { onConflict: 'rapporto_id,email' }).select().single());
}

export async function eliminaInvito(id) {
  ok(await supabase.from('inviti').delete().eq('id', id));
}

export async function eliminaAccesso(rapportoId, userId) {
  ok(await supabase.from('accessi').delete().eq('rapporto_id', rapportoId).eq('user_id', userId));
}

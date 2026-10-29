// Lettura e scrittura dei dati sul cloud. Una sola riga "rapporto" per utente (v1).
import { supabase } from './supabase.js';

export async function caricaRapporto() {
  const { data, error } = await supabase
    .from('rapporti')
    .select('id, dati, contatori, updated_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // null se non ancora creato
}

export async function salvaRapporto(id, dati) {
  if (id) {
    const { data, error } = await supabase
      .from('rapporti').update({ dati }).eq('id', id)
      .select('id, dati, contatori, updated_at').single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('rapporti').insert({ dati })
    .select('id, dati, contatori, updated_at').single();
  if (error) throw error;
  return data;
}

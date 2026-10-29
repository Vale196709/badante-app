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
    .select('*')
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

// ---------- Tabelle annuali personalizzate ----------
const facoltativo = async (promessa, vuoto) => {
  try { return ok(await promessa); } catch (e) {
    if (/does not exist|schema cache|Could not find/i.test(e.message)) return vuoto; // script 03 non ancora eseguito
    throw e;
  }
};

export async function caricaTabelle(rapportoId) {
  const righe = await facoltativo(supabase.from('tabelle_annuali').select('anno, dati, updated_at').eq('rapporto_id', rapportoId), []);
  return Object.fromEntries(righe.map((r) => [r.anno, r.dati]));
}
export async function salvaTabelle(rapportoId, anno, dati) {
  ok(await supabase.from('tabelle_annuali').upsert({ rapporto_id: rapportoId, anno, dati, updated_at: new Date().toISOString() }));
}
export async function eliminaTabelle(rapportoId, anno) {
  ok(await supabase.from('tabelle_annuali').delete().eq('rapporto_id', rapportoId).eq('anno', anno));
}

// ---------- Versamenti INPS ----------
export async function caricaVersamenti(rapportoId) {
  return facoltativo(supabase.from('versamenti').select('anno, trimestre, data_pagamento, importo, nota').eq('rapporto_id', rapportoId), []);
}
export async function salvaVersamento(rapportoId, v) {
  ok(await supabase.from('versamenti').upsert({ rapporto_id: rapportoId, ...v }));
}
export async function eliminaVersamento(rapportoId, anno, trimestre) {
  ok(await supabase.from('versamenti').delete().eq('rapporto_id', rapportoId).eq('anno', anno).eq('trimestre', trimestre));
}

// ---------- Archivio documenti ----------
export async function caricaDocumenti(rapportoId) {
  return facoltativo(supabase.from('documenti').select('*').eq('rapporto_id', rapportoId).order('created_at', { ascending: false }), []);
}
export async function caricaFile(rapportoId, file, { categoria, visibile, nome }) {
  const pulito = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
  const percorso = `${rapportoId}/${crypto.randomUUID()}-${pulito}`;
  ok(await supabase.storage.from('documenti').upload(percorso, file, { contentType: file.type || 'application/octet-stream' }));
  try {
    ok(await supabase.from('documenti').insert({
      rapporto_id: rapportoId, nome: nome || file.name, categoria, percorso,
      dimensione: file.size, tipo_file: file.type, visibile_lavoratrice: !!visibile,
      caricato_da: (await supabase.auth.getUser()).data.user?.email,
    }));
  } catch (e) {
    await supabase.storage.from('documenti').remove([percorso]);
    throw e;
  }
}
export async function linkFile(percorso) {
  const { data, error } = await supabase.storage.from('documenti').createSignedUrl(percorso, 300);
  if (error) throw error;
  return data.signedUrl;
}
export async function aggiornaDocumento(id, campi) {
  ok(await supabase.from('documenti').update(campi).eq('id', id));
}
export async function eliminaDocumento(doc) {
  ok(await supabase.storage.from('documenti').remove([doc.percorso]));
  ok(await supabase.from('documenti').delete().eq('id', doc.id));
}

// ---------- Richieste ferie e permessi ----------
export async function caricaRichieste(rapportoId) {
  return facoltativo(supabase.from('richieste').select('*').eq('rapporto_id', rapportoId).order('dal', { ascending: false }), []);
}
export async function creaRichiesta(rapportoId, r) {
  ok(await supabase.from('richieste').insert({ rapporto_id: rapportoId, ...r }));
}
export async function decidiRichiesta(id, stato, risposta, email) {
  ok(await supabase.from('richieste').update({ stato, risposta: risposta || null, deciso_da: email, deciso_at: new Date().toISOString() }).eq('id', id));
}
export async function ritiraRichiesta(id) {
  ok(await supabase.from('richieste').delete().eq('id', id));
}

// ---------- Firma grafica ----------
export async function firmaRicevutaConFirma(cedolinoId, firmaPng) {
  return ok(await supabase.rpc('firma_ricevuta', { cid: cedolinoId, firma: firmaPng || null }));
}

// ---------- Backup ----------
export async function esportaTutto(rapporto) {
  const id = rapporto.id;
  const [cedolini, fatte, tabelle, versamenti, richieste, documenti] = await Promise.all([
    caricaCedolini(id),
    facoltativo(supabase.from('scadenze_fatte').select('chiave, fatto_at, nota').eq('rapporto_id', id), []),
    facoltativo(supabase.from('tabelle_annuali').select('anno, dati').eq('rapporto_id', id), []),
    caricaVersamenti(id),
    caricaRichieste(id),
    caricaDocumenti(id),
  ]);
  return {
    formato: 'badante-backup',
    versione: 1,
    esportato_il: new Date().toISOString(),
    rapporto: { dati: rapporto.dati, contatori: rapporto.contatori ?? {} },
    cedolini: cedolini.map(({ id: _i, ...c }) => c),
    scadenze_fatte: fatte,
    tabelle_annuali: tabelle,
    versamenti,
    richieste: richieste.map(({ id: _i, rapporto_id: _r, ...x }) => x),
    documenti: documenti.map(({ id: _i, rapporto_id: _r, ...x }) => x), // solo l'elenco: i file restano nell'archivio
  };
}

/** Ripristina un backup nel rapporto indicato (o ne crea uno). Restituisce il rapporto. */
export async function importaTutto(rapportoId, b) {
  if (b?.formato !== 'badante-backup') throw new Error('Il file non è un backup di questa app.');
  const rapporto = await salvaRapporto(rapportoId, b.rapporto.dati);
  const id = rapporto.id;
  const conId = (arr) => (arr || []).map((x) => ({ ...x, rapporto_id: id }));
  if (b.cedolini?.length) {
    ok(await supabase.from('cedolini').upsert(conId(b.cedolini).map(({ ricevuta_at, ricevuta_da, ricevuta_firma, updated_at, ...c }) => c), { onConflict: 'rapporto_id,anno,mese' }));
  }
  if (b.scadenze_fatte?.length) ok(await supabase.from('scadenze_fatte').upsert(conId(b.scadenze_fatte)));
  if (b.tabelle_annuali?.length) ok(await supabase.from('tabelle_annuali').upsert(conId(b.tabelle_annuali)));
  if (b.versamenti?.length) ok(await supabase.from('versamenti').upsert(conId(b.versamenti)));
  return rapporto;
}

// ---------- Promemoria e notifiche ----------
export async function caricaPromemoria(rapportoId) {
  const r = await facoltativo(supabase.from('promemoria').select('*').eq('rapporto_id', rapportoId).maybeSingle(), null);
  return r;
}
export async function salvaPromemoria(rapportoId, p) {
  ok(await supabase.from('promemoria').upsert({ rapporto_id: rapportoId, ...p, updated_at: new Date().toISOString() }));
}
export async function caricaDispositivi(rapportoId) {
  return facoltativo(supabase.from('notifiche_dispositivi').select('endpoint, email, dispositivo, created_at, user_id').eq('rapporto_id', rapportoId), []);
}
export async function iscriviDispositivo(rapportoId, sub, dispositivo) {
  const j = sub.toJSON();
  await supabase.from('notifiche_dispositivi').delete().eq('endpoint', j.endpoint);
  ok(await supabase.from('notifiche_dispositivi').insert({ endpoint: j.endpoint, rapporto_id: rapportoId, chiavi: j.keys, dispositivo }));
}
export async function togliDispositivo(endpoint) {
  ok(await supabase.from('notifiche_dispositivi').delete().eq('endpoint', endpoint));
}

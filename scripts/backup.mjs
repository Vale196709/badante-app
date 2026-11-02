// Backup settimanale automatico: esporta i dati di ogni rapporto nel formato del Ripristino
// dell'app, lo cifra con la password del segreto BACKUP_PASSWORD e lo manda per email.
// Gira su GitHub Actions con l'utente "Sola lettura" dei promemoria.
//
// Segreti: PROMEMORIA_EMAIL, PROMEMORIA_PASSWORD, GMAIL_USER, GMAIL_APP_PASSWORD, BACKUP_PASSWORD
//          BACKUP_EMAIL (facoltativo: destinatario; se manca, GMAIL_USER)
// Con BACKUP_PROVA=1 non invia nulla e salva i file nella cartella corrente.
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const env = Object.fromEntries(readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
  .split('\n').filter((r) => r.includes('=')).map((r) => [r.slice(0, r.indexOf('=')).trim(), r.slice(r.indexOf('=') + 1).trim()]));
const PROVA = process.env.BACKUP_PROVA === '1';
const MAX_ALLEGATO = 18 * 1024 * 1024; // Gmail accetta allegati fino a 25 MB (il base64 pesa un terzo in più)
const ITERAZIONI = 310000;

const b64 = (u8) => Buffer.from(u8).toString('base64');

export async function cifra(oggetto, password) {
  const enc = new TextEncoder();
  const sale = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const chiave = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: ITERAZIONI }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const dati = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, enc.encode(JSON.stringify(oggetto))));
  return { formato: 'badante-backup-cifrato', versione: 1, algoritmo: 'AES-256-GCM/PBKDF2-SHA256', iterazioni: ITERAZIONI, sale: b64(sale), iv: b64(iv), dati: b64(dati) };
}

async function esporta(sb, r, conFile) {
  const id = r.id;
  const leggi = async (q, vuoto = []) => { const { data, error } = await q; return error ? vuoto : data ?? vuoto; };
  const [cedolini, fatte, tabelle, versamenti, richieste, documenti, promemoria, ore] = await Promise.all([
    leggi(sb.from('cedolini').select('*').eq('rapporto_id', id).order('anno').order('mese')),
    leggi(sb.from('scadenze_fatte').select('chiave, fatto_at, nota').eq('rapporto_id', id)),
    leggi(sb.from('tabelle_annuali').select('anno, dati').eq('rapporto_id', id)),
    leggi(sb.from('versamenti').select('anno, trimestre, data_pagamento, importo, nota').eq('rapporto_id', id)),
    leggi(sb.from('richieste').select('*').eq('rapporto_id', id)),
    leggi(sb.from('documenti').select('*').eq('rapporto_id', id)),
    leggi(sb.from('promemoria').select('attivo, email, giorni_anticipo').eq('rapporto_id', id).maybeSingle(), null),
    leggi(sb.from('ore_segnate').select('*').eq('rapporto_id', id)),
  ]);
  const docs = [];
  let byte = 0;
  for (const { id: _i, rapporto_id: _r, ...x } of documenti) {
    const voce = { ...x };
    if (conFile && (x.dimensione || 0) + byte < MAX_ALLEGATO) {
      const { data, error } = await sb.storage.from('documenti').download(x.percorso);
      if (!error && data) { const buf = Buffer.from(await data.arrayBuffer()); voce.contenuto = buf.toString('base64'); byte += buf.length; }
    }
    docs.push(voce);
  }
  return {
    formato: 'badante-backup', versione: 2, versioneApp: `backup automatico ${JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version}`,
    esportato_il: new Date().toISOString(),
    rapporto: { dati: r.dati, contatori: r.contatori ?? {} },
    cedolini: cedolini.map(({ id: _i, rapporto_id: _r, user_id: _u, ...c }) => c),
    scadenze_fatte: fatte, tabelle_annuali: tabelle, versamenti,
    richieste: richieste.map(({ id: _i, rapporto_id: _r, ...x }) => x),
    ore_segnate: ore.map(({ rapporto_id: _r, ...x }) => x),
    documenti: docs, promemoria,
    fileInclusi: docs.some((d) => d.contenuto),
  };
}

async function principale() {
  const mancano = ['PROMEMORIA_EMAIL', 'PROMEMORIA_PASSWORD', 'BACKUP_PASSWORD', ...(PROVA ? [] : ['GMAIL_USER', 'GMAIL_APP_PASSWORD'])].filter((k) => !process.env[k]);
  if (mancano.length) throw new Error(`Backup non configurato: mancano i segreti ${mancano.join(', ')}.`);
  if (process.env.BACKUP_PASSWORD.length < 10) throw new Error('BACKUP_PASSWORD troppo corta: usane una di almeno 10 caratteri.');

  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error: errLogin } = await sb.auth.signInWithPassword({ email: process.env.PROMEMORIA_EMAIL, password: process.env.PROMEMORIA_PASSWORD });
  if (errLogin) throw new Error(`Accesso a Supabase non riuscito: ${errLogin.message}`);
  const { data: rapporti, error } = await sb.from('rapporti').select('id, dati, contatori');
  if (error) throw error;

  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const allegati = [];
  const righe = [];
  for (const r of rapporti) {
    const nome = r.dati?.lavoratrice?.nome || 'rapporto';
    let dati = await esporta(sb, r, true);
    let busta = await cifra(dati, process.env.BACKUP_PASSWORD);
    if (JSON.stringify(busta).length > MAX_ALLEGATO * 1.4) { dati = await esporta(sb, r, false); busta = await cifra(dati, process.env.BACKUP_PASSWORD); }
    const file = `badante-${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${oggi}.badante`;
    allegati.push({ filename: file, content: JSON.stringify(busta), contentType: 'application/octet-stream' });
    const conFile = dati.documenti.filter((d) => d.contenuto).length;
    righe.push(`• ${nome}: ${dati.cedolini.length} cedolini, ${dati.versamenti.length} versamenti, ${dati.documenti.length} documenti (${conFile} con il file)`);
    console.log(`${nome}: backup pronto (${Math.round(JSON.stringify(busta).length / 1024)} KB).`);
  }
  if (!allegati.length) { console.log('Nessun rapporto visibile: niente da salvare.'); return; }
  if (PROVA) { for (const a of allegati) writeFileSync(a.filename, a.content); console.log('[PROVA] file salvati, nessuna email.'); return; }

  const posta = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') } });
  const testo = `Backup settimanale di Badante di Maria del ${oggi.split('-').reverse().join('/')}:\n\n${righe.join('\n')}\n\n`
    + 'Il file allegato è cifrato con la password del backup. Per ripristinarlo: app → Impostazioni → Backup → Ripristina da un backup, scegli il file e inserisci la password.\n'
    + 'Conserva qualche email di backup: se un dato viene cancellato per errore, si recupera dalla copia della settimana prima.\n';
  await posta.sendMail({ from: `Badante di Maria <${process.env.GMAIL_USER}>`, to: process.env.BACKUP_EMAIL || process.env.GMAIL_USER, subject: `Badante di Maria – backup del ${oggi.split('-').reverse().join('/')}`, text: testo, attachments: allegati });
  console.log(`Email di backup inviata con ${allegati.length} allegati.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principale().catch((e) => { console.error(e.message); process.exit(1); });
}

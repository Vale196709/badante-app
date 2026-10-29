// Promemoria giornalieri: email e notifiche per le scadenze del rapporto di lavoro.
// Gira ogni mattina su GitHub Actions. Accede a Supabase con un utente "Sola lettura".
//
// Segreti richiesti (GitHub → Settings → Secrets and variables → Actions):
//   PROMEMORIA_EMAIL, PROMEMORIA_PASSWORD   utente di sola lettura creato in Supabase
//   GMAIL_USER, GMAIL_APP_PASSWORD          account Gmail da cui partono le email (password per le app)
//   VAPID_PRIVATE_KEY                       chiave privata delle notifiche
// Con PROMEMORIA_PROVA=1 non invia nulla e stampa cosa invierebbe.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { calcolaCatena } from '../src/engine/catena.js';
import { generaScadenze } from '../src/engine/scadenze.js';
import { impostaTabellePersonalizzate } from '../src/engine/tabelle.js';
import { fmtEur } from '../src/engine/formato.js';

const env = Object.fromEntries(readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
  .split('\n').filter((r) => r.includes('=')).map((r) => [r.slice(0, r.indexOf('=')).trim(), r.slice(r.indexOf('=') + 1).trim()]));
const PROVA = process.env.PROMEMORIA_PROVA === '1';
const URL_APP = 'https://vale196709.github.io/badante-app/';

function oggiRoma() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // YYYY-MM-DD
}
const giorniTra = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const dataIt = (iso) => iso.split('-').reverse().join('/');

/** Scadenze da ricordare oggi. */
export function daRicordare(scadenze, oggi, anticipo) {
  const lunedi = new Date(oggi + 'T12:00:00Z').getUTCDay() === 1;
  return scadenze.filter((s) => {
    if (s.fatta) return false;
    const g = giorniTra(oggi, s.data);
    return g === anticipo || g === 1 || g === 0 || (g < 0 && lunedi);
  }).map((s) => ({ ...s, tra: giorniTra(oggi, s.data) }));
}

const quando = (g) => (g === 0 ? 'oggi' : g === 1 ? 'domani' : g > 1 ? `tra ${g} giorni` : `scaduta da ${-g} giorni`);

async function principale() {
  const mancano = ['PROMEMORIA_EMAIL', 'PROMEMORIA_PASSWORD'].filter((k) => !process.env[k]);
  if (mancano.length) { console.log(`Promemoria non configurati (mancano: ${mancano.join(', ')}): nessun invio.`); return; }

  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error: errLogin } = await sb.auth.signInWithPassword({ email: process.env.PROMEMORIA_EMAIL, password: process.env.PROMEMORIA_PASSWORD });
  if (errLogin) throw new Error(`Accesso a Supabase non riuscito: ${errLogin.message}`);
  await sb.rpc('accetta_inviti');

  const posta = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') } })
    : null;
  if (process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(`mailto:${process.env.GMAIL_USER || 'noreply@example.com'}`, env.VITE_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }

  const oggi = oggiRoma();
  const [anno, mese] = oggi.split('-').map(Number);
  const { data: rapporti, error } = await sb.from('rapporti').select('id, dati');
  if (error) throw error;
  console.log(`${oggi}: ${rapporti.length} rapporti visibili.`);

  for (const r of rapporti) {
    const { data: p } = await sb.from('promemoria').select('*').eq('rapporto_id', r.id).maybeSingle();
    if (!p?.attivo || !r.dati?.dataAssunzione) continue;
    const [{ data: cedolini }, { data: fatte }, { data: tabelle }, { data: richieste }] = await Promise.all([
      sb.from('cedolini').select('*').eq('rapporto_id', r.id),
      sb.from('scadenze_fatte').select('chiave').eq('rapporto_id', r.id),
      sb.from('tabelle_annuali').select('anno, dati').eq('rapporto_id', r.id),
      sb.from('richieste').select('stato').eq('rapporto_id', r.id),
    ]);
    impostaTabellePersonalizzate(Object.fromEntries((tabelle || []).map((t) => [t.anno, t.dati])));
    let fino = { anno, mese };
    for (const c of cedolini || []) if (c.anno > fino.anno || (c.anno === fino.anno && c.mese > fino.mese)) fino = { anno: c.anno, mese: c.mese };
    const catena = calcolaCatena(r.dati, cedolini || [], fino);
    const scadenze = generaScadenze(r.dati, catena, oggi, new Set((fatte || []).map((f) => f.chiave)));
    const elenco = daRicordare(scadenze, oggi, p.giorni_anticipo);
    const inAttesa = (richieste || []).filter((x) => x.stato === 'in attesa').length;
    if (!elenco.length && !inAttesa) { console.log(`${r.dati.lavoratrice?.nome}: niente da ricordare.`); continue; }

    const nome = r.dati.lavoratrice?.nome || 'rapporto di lavoro';
    const righe = elenco.map((s) => `• ${s.titolo}${s.importo != null ? ` (${fmtEur(s.importo)})` : ''}: ${quando(s.tra)}, ${dataIt(s.data)}`);
    if (inAttesa) righe.push(`• ${inAttesa} ${inAttesa === 1 ? 'richiesta' : 'richieste'} di ferie o permessi in attesa di risposta`);
    const oggetto = elenco.length
      ? `Badante – ${elenco.length === 1 ? elenco[0].titolo : `${elenco.length} scadenze`} (${nome})`
      : `Badante – richieste in attesa (${nome})`;
    const testo = `Promemoria per ${nome}:\n\n${righe.join('\n')}\n\nApri l'app: ${URL_APP}\n`;
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#111">
      <p>Promemoria per <strong>${nome}</strong>:</p>
      <ul style="padding-left:18px">${righe.map((x) => `<li style="margin-bottom:6px">${x.slice(2)}</li>`).join('')}</ul>
      <p><a href="${URL_APP}" style="display:inline-block;background:#0a7f78;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Apri l'app</a></p>
      <p style="color:#6c6c70;font-size:12px">Puoi cambiare destinatari e anticipo in Impostazioni → Promemoria.</p></div>`;

    if (PROVA) { console.log(`[PROVA] email a ${p.email.join(', ')}\n${oggetto}\n${testo}`); continue; }

    if (posta && p.email?.length) {
      await posta.sendMail({ from: `Badante <${process.env.GMAIL_USER}>`, to: p.email.join(', '), subject: oggetto, text: testo, html });
      console.log(`Email inviata a ${p.email.length} destinatari.`);
    }
    if (process.env.VAPID_PRIVATE_KEY) {
      const { data: disp } = await sb.from('notifiche_dispositivi').select('endpoint, chiavi').eq('rapporto_id', r.id);
      const corpo = JSON.stringify({ title: elenco.length ? `${elenco[0].titolo}` : 'Richieste in attesa', body: righe.map((x) => x.slice(2)).join('\n'), tag: `promemoria-${oggi}`, url: URL_APP });
      for (const d of disp || []) {
        try { await webpush.sendNotification({ endpoint: d.endpoint, keys: d.chiavi }, corpo); }
        catch (e) { console.log(`Notifica non consegnata (${e.statusCode ?? e.message}): dispositivo probabilmente disiscritto.`); }
      }
      console.log(`Notifiche inviate a ${disp?.length ?? 0} dispositivi.`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principale().catch((e) => { console.error(e.message); process.exit(1); });
}

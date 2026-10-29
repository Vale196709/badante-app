// Promemoria: email automatiche e notifiche su questo dispositivo.
import { app, puoModificare, isTitolare, esc, dataIt, toast } from '../stato.js';
import { caricaPromemoria, salvaPromemoria, caricaDispositivi, iscriviDispositivo, togliDispositivo } from '../lib/dati.js';

const CHIAVE_PUBBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const daBase64 = (s) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...b].map((c) => c.charCodeAt(0)));
};
const nomeDispositivo = () => {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'PC Windows';
  return 'Dispositivo';
};
const installata = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iOS = () => /iPhone|iPad/.test(navigator.userAgent);

async function iscrizioneCorrente() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function mostraPromemoria(root) {
  root.innerHTML = '<p class="caricamento">Caricamento…</p>';
  const mod = puoModificare();
  let p, dispositivi, mia;
  try {
    [p, dispositivi, mia] = await Promise.all([caricaPromemoria(app.rapporto.id), caricaDispositivi(app.rapporto.id), iscrizioneCorrente()]);
  } catch (e) {
    root.innerHTML = `<div class="avviso grave">Promemoria non ancora attivi nel database: esegui lo script <code>supabase/04_promemoria.sql</code> in Supabase. (${esc(e.message)})</div>`;
    return;
  }
  p = p ?? { attivo: false, email: [app.user.email], giorni_anticipo: 3 };
  const supporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const iscritto = mia && dispositivi.some((x) => x.endpoint === mia.endpoint);

  root.innerHTML = `
    <section class="card">
      <h2>Email</h2>
      <p class="nota" style="margin:0 0 12px">Ogni mattina l'app controlla le scadenze e manda un'email ${p.giorni_anticipo} giorni prima, il giorno prima e il giorno stesso. Il lunedì ricorda anche quelle scadute e non segnate come fatte.</p>
      <form class="form-promemoria">
        <fieldset class="tutto" ${mod ? '' : 'disabled'}>
          <label class="spunta"><input type="checkbox" name="attivo" ${p.attivo ? 'checked' : ''} /> Promemoria attivi</label>
          <label>Destinatari (separati da virgola)<input name="email" value="${esc(p.email.join(', '))}" inputmode="email" /></label>
          <label>Primo avviso, giorni prima della scadenza<input type="number" name="giorni" min="1" max="30" value="${p.giorni_anticipo}" /></label>
        </fieldset>
        ${mod ? '<button type="submit" class="primario">Salva</button>' : ''}
      </form>
    </section>

    <section class="card">
      <h2>Notifiche su questo dispositivo</h2>
      ${!supporta ? `<p class="nota" style="margin:0">${iOS() && !installata()
          ? 'Su iPhone le notifiche funzionano solo con l\'app aggiunta alla schermata Home: in Safari tocca Condividi → Aggiungi alla schermata Home, poi apri l\'app da lì e torna qui.'
          : 'Questo browser non supporta le notifiche.'}</p>`
        : `<p class="nota" style="margin:0 0 12px">Ricevi gli stessi promemoria come notifica ${iscritto ? '(attive su questo dispositivo)' : ''}.</p>
           <div class="azioni-mese">
             ${iscritto
               ? '<button type="button" class="secondario" data-a="prova">Invia una notifica di prova</button><button type="button" class="link ko" data-a="disattiva">Disattiva su questo dispositivo</button>'
               : '<button type="button" class="primario" data-a="attiva">Attiva le notifiche</button>'}
           </div>`}
      ${dispositivi.length ? `<h3 class="sottotitolo">Dispositivi iscritti</h3><ul class="lista-file">${dispositivi.map((x) => `
        <li><span>${esc(x.dispositivo || 'Dispositivo')} · ${esc(x.email)}</span><small>dal ${dataIt(x.created_at)}${mia?.endpoint === x.endpoint ? ' · questo dispositivo' : ''}</small>
        ${isTitolare() || x.user_id === app.user.id ? `<button type="button" class="link ko" data-togli="${esc(x.endpoint)}">Togli</button>` : ''}</li>`).join('')}</ul>` : ''}
    </section>

    ${isTitolare() ? `<section class="card">
      <h2>Come si attivano gli invii</h2>
      <p class="nota" style="margin:0 0 10px">Gli invii partono ogni mattina da GitHub, gratis. Serve una configurazione una tantum:</p>
      <ol class="passi">
        <li>In Supabase crea un utente per i promemoria (Authentication → Users → Add user, con Auto Confirm), per esempio <strong>promemoria.badante@example.com</strong>, con una password lunga.</li>
        <li>In Impostazioni → Accessi invitalo con il ruolo <strong>Sola lettura</strong>: potrà solo leggere, non modificare.</li>
        <li>Su GitHub, nel repository: Settings → Secrets and variables → Actions → New repository secret. Crea i segreti indicati nella guida del progetto (utente e password dei promemoria, la tua Gmail con una password per le app, la chiave delle notifiche).</li>
      </ol>
    </section>` : ''}`;

  root.querySelector('.form-promemoria').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const email = f.email.value.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => x.includes('@'));
    try {
      await salvaPromemoria(app.rapporto.id, { attivo: f.attivo.checked, email, giorni_anticipo: Math.min(30, Math.max(1, Number(f.giorni.value) || 3)) });
      toast('Promemoria salvati');
      mostraPromemoria(root);
    } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  });
  root.querySelector('[data-a=attiva]')?.addEventListener('click', async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('Notifiche non consentite: si abilitano dalle impostazioni del telefono', 'ko'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: daBase64(CHIAVE_PUBBLICA) });
      await iscriviDispositivo(app.rapporto.id, sub, nomeDispositivo());
      toast('Notifiche attive');
      mostraPromemoria(root);
    } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  });
  root.querySelector('[data-a=prova]')?.addEventListener('click', async () => {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Badante', { body: 'Le notifiche funzionano: qui arriveranno i promemoria delle scadenze.', icon: `${import.meta.env.BASE_URL}icons/icon-192.png` });
  });
  root.querySelector('[data-a=disattiva]')?.addEventListener('click', async () => {
    try {
      const sub = await iscrizioneCorrente();
      if (sub) { await togliDispositivo(sub.endpoint); await sub.unsubscribe(); }
      toast('Notifiche disattivate');
      mostraPromemoria(root);
    } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  });
  root.querySelectorAll('[data-togli]').forEach((b) => b.addEventListener('click', async () => {
    try { await togliDispositivo(b.dataset.togli); mostraPromemoria(root); } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  }));
}

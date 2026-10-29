import './style.css';
import { supabase } from './lib/supabase.js';
import { caricaContesto, caricaCedolini, caricaScadenzeFatte, caricaTabelle, caricaVersamenti, caricaRichieste, caricaDocumenti } from './lib/dati.js';
import { impostaTabellePersonalizzate } from './engine/tabelle.js';
import { LINGUE, linguaCorrente, impostaLingua, t } from './i18n.js';
import { app, esc } from './stato.js';
import { mostraLogin } from './ui/login.js';
import { RAPPORTO_VUOTO } from './ui/rapporto.js';
import { mostraImpostazioni } from './ui/impostazioni.js';
import { mostraHome } from './ui/home.js';
import { mostraMesi } from './ui/mesi.js';
import { mostraSimulatore } from './ui/simulatore.js';
import { mostraDocumenti } from './ui/documenti.js';
import { mostraScadenze } from './ui/scadenze.js';
import { mostraLavoratrice, mostraRichiesteLavoratrice, mostraDocumentiLavoratrice } from './ui/lavoratrice.js';

const root = document.getElementById('app');
let utenteCorrente;
let sezione = null;

const SEZIONI = {
  home: { titolo: 'Riepilogo', mostra: mostraHome, ruoli: ['titolare', 'gestore', 'lettore'] },
  mesi: { titolo: 'Presenze e cedolini', mostra: mostraMesi, ruoli: ['titolare', 'gestore', 'lettore'] },
  scadenze: { titolo: 'Scadenze', mostra: mostraScadenze, ruoli: ['titolare', 'gestore', 'lettore'] },
  simulatore: { titolo: 'Simulatore', mostra: mostraSimulatore, ruoli: ['titolare', 'gestore', 'lettore'] },
  documenti: { titolo: 'Documenti', mostra: mostraDocumenti, ruoli: ['titolare', 'gestore', 'lettore'] },
  impostazioni: { titolo: 'Impostazioni', mostra: mostraImpostazioni, ruoli: ['titolare', 'gestore', 'lettore'] },
  lavoratrice: { titolo: () => t('tabCedolini'), mostra: mostraLavoratrice, ruoli: ['lavoratrice'] },
  lavRichieste: { titolo: () => t('tabRichieste'), mostra: mostraRichiesteLavoratrice, ruoli: ['lavoratrice'] },
  lavDocumenti: { titolo: () => t('tabDocumenti'), mostra: mostraDocumentiLavoratrice, ruoli: ['lavoratrice'] },
};
const RUOLI = { titolare: 'Titolare', gestore: 'Gestore', lettore: 'Sola lettura', lavoratrice: 'Lavoratrice' };

export async function ricaricaDati() {
  if (!app.rapporto?.id) { app.cedolini = []; app.fatte = new Set(); return; }
  const id = app.rapporto.id;
  const lav = app.rapporto.ruolo === 'lavoratrice';
  const [cedolini, fatte, tabelle, versamenti, richieste, documenti] = await Promise.all([
    caricaCedolini(id),
    lav ? new Set() : caricaScadenzeFatte(id),
    caricaTabelle(id),
    lav ? [] : caricaVersamenti(id),
    caricaRichieste(id),
    caricaDocumenti(id),
  ]);
  Object.assign(app, { cedolini, fatte, versamenti, richieste, documenti });
  impostaTabellePersonalizzate(tabelle);
}

export function vai(nome) {
  sezione = nome;
  root.querySelectorAll('nav.schede button').forEach((x) => x.toggleAttribute('aria-current', x.dataset.s === nome));
  const el = root.querySelector('#contenuto');
  el.innerHTML = '';
  window.scrollTo(0, 0);
  SEZIONI[nome].mostra(el, { vai, ricaricaDati });
}

async function mostraApp(user) {
  root.innerHTML = '<p class="caricamento">Caricamento…</p>';
  try {
    app.user = user;
    app.rapporti = await caricaContesto(user);
    app.rapporto = app.rapporti[0] ?? { id: null, dati: null, ruolo: 'titolare' };
    if (app.rapporto.dati) {
      const d = app.rapporto.dati;
      app.rapporto.dati = { ...RAPPORTO_VUOTO, ...d, datore: { ...RAPPORTO_VUOTO.datore, ...d.datore }, lavoratrice: { ...RAPPORTO_VUOTO.lavoratrice, ...d.lavoratrice } };
    }
    await ricaricaDati();
  } catch (e) {
    root.innerHTML = `<main class="contenuto"><p class="errore">Impossibile leggere i dati: ${esc(e.message)}</p>
      <button class="secondario" onclick="location.reload()">Riprova</button></main>`;
    return;
  }
  const ruolo = app.rapporto.ruolo;
  const visibili = Object.entries(SEZIONI).filter(([, s]) => s.ruoli.includes(ruolo));
  if (!sezione || !SEZIONI[sezione].ruoli.includes(ruolo)) sezione = app.rapporto.dati || ruolo === 'lavoratrice' ? visibili[0][0] : 'impostazioni';
  const lav = ruolo === 'lavoratrice';
  const titolo = (s) => (typeof s.titolo === 'function' ? s.titolo() : s.titolo);

  root.innerHTML = `
    <header class="barra">
      <span class="logo"><img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" width="28" height="28" /> Badante</span>
      <span class="chi">
        ${lav ? `<select class="lingua" aria-label="${t('lingua')}">${Object.entries(LINGUE).map(([k, v]) => `<option value="${k}" ${k === linguaCorrente() ? 'selected' : ''}>${v}</option>`).join('')}</select>`
              : `<span class="ruolo">${RUOLI[ruolo]}</span>`}
        <button class="esci" type="button">${lav ? t('esci') : 'Esci'}</button></span>
    </header>
    <nav class="schede">
      ${visibili.map(([k, s]) => `<button type="button" data-s="${k}">${esc(titolo(s))}</button>`).join('')}
    </nav>
    <main id="contenuto" class="contenuto"></main>
    <footer class="piede">Accesso come ${esc(user.email)}</footer>`;

  root.querySelector('.esci').addEventListener('click', () => supabase.auth.signOut());
  root.querySelector('.lingua')?.addEventListener('change', (e) => { impostaLingua(e.target.value); mostraApp(user); });
  root.querySelectorAll('nav.schede button').forEach((b) => b.addEventListener('click', () => vai(b.dataset.s)));
  vai(sezione);
}

supabase.auth.onAuthStateChange((_evento, session) => {
  const user = session?.user ?? null;
  if (utenteCorrente !== undefined && (user?.id ?? null) === (utenteCorrente?.id ?? null)) return;
  utenteCorrente = user;
  // fuori dal callback, come raccomandato da Supabase
  setTimeout(() => (user ? mostraApp(user) : mostraLogin(root)), 0);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

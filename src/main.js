import './style.css';
import { supabase } from './lib/supabase.js';
import { caricaContesto, caricaCedolini, caricaScadenzeFatte } from './lib/dati.js';
import { app, esc } from './stato.js';
import { mostraLogin } from './ui/login.js';
import { mostraRapporto, RAPPORTO_VUOTO } from './ui/rapporto.js';
import { mostraHome } from './ui/home.js';
import { mostraMesi } from './ui/mesi.js';
import { mostraSimulatore } from './ui/simulatore.js';
import { mostraDocumenti } from './ui/documenti.js';
import { mostraScadenze } from './ui/scadenze.js';
import { mostraAccessi } from './ui/accessi.js';
import { mostraLavoratrice } from './ui/lavoratrice.js';

const root = document.getElementById('app');
let utenteCorrente;
let sezione = null;

const SEZIONI = {
  home: { titolo: 'Riepilogo', mostra: mostraHome, ruoli: ['titolare', 'gestore', 'lettore'] },
  mesi: { titolo: 'Presenze e cedolini', mostra: mostraMesi, ruoli: ['titolare', 'gestore', 'lettore'] },
  scadenze: { titolo: 'Scadenze', mostra: mostraScadenze, ruoli: ['titolare', 'gestore', 'lettore'] },
  simulatore: { titolo: 'Simulatore', mostra: mostraSimulatore, ruoli: ['titolare', 'gestore', 'lettore'] },
  documenti: { titolo: 'Documenti', mostra: mostraDocumenti, ruoli: ['titolare', 'gestore', 'lettore'] },
  rapporto: { titolo: 'Rapporto', mostra: mostraRapporto, ruoli: ['titolare', 'gestore', 'lettore'] },
  accessi: { titolo: 'Accessi', mostra: mostraAccessi, ruoli: ['titolare'] },
  lavoratrice: { titolo: 'I miei cedolini', mostra: mostraLavoratrice, ruoli: ['lavoratrice'] },
};
const RUOLI = { titolare: 'Titolare', gestore: 'Gestore', lettore: 'Sola lettura', lavoratrice: 'Lavoratrice' };

export async function ricaricaDati() {
  if (!app.rapporto?.id) { app.cedolini = []; app.fatte = new Set(); return; }
  [app.cedolini, app.fatte] = await Promise.all([caricaCedolini(app.rapporto.id), caricaScadenzeFatte(app.rapporto.id)]);
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
  if (!sezione || !SEZIONI[sezione].ruoli.includes(ruolo)) sezione = app.rapporto.dati ? visibili[0][0] : 'rapporto';

  root.innerHTML = `
    <header class="barra">
      <span class="logo"><img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" width="28" height="28" /> Badante</span>
      <span class="chi"><span class="ruolo">${RUOLI[ruolo]}</span><button class="esci" type="button">Esci</button></span>
    </header>
    <nav class="schede">
      ${visibili.map(([k, s]) => `<button type="button" data-s="${k}">${s.titolo}</button>`).join('')}
    </nav>
    <main id="contenuto" class="contenuto"></main>
    <footer class="piede">Accesso come ${esc(user.email)}</footer>`;

  root.querySelector('.esci').addEventListener('click', () => supabase.auth.signOut());
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

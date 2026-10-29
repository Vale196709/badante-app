import './style.css';
import { supabase } from './lib/supabase.js';
import { mostraLogin } from './ui/login.js';
import { mostraRapporto } from './ui/rapporto.js';

const root = document.getElementById('app');
let sezione = 'rapporto';
let utenteCorrente;

const SEZIONI = {
  rapporto: { titolo: 'Rapporto', mostra: mostraRapporto },
  cedolini: { titolo: 'Cedolini', mostra: (el) => { el.innerHTML = '<p class="vuoto">I cedolini mensili arrivano nella prossima fase.</p>'; } },
  scadenze: { titolo: 'Scadenze', mostra: (el) => { el.innerHTML = '<p class="vuoto">Lo scadenziario arriva in una fase successiva.</p>'; } },
};

function mostraApp(user) {
  root.innerHTML = `
    <header class="barra">
      <span class="logo"><img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" width="28" height="28" /> Badante</span>
      <button class="esci" type="button">Esci</button>
    </header>
    <nav class="schede">
      ${Object.entries(SEZIONI).map(([k, s]) => `<button type="button" data-s="${k}" ${k === sezione ? 'aria-current="page"' : ''}>${s.titolo}</button>`).join('')}
    </nav>
    <main id="contenuto" class="contenuto"></main>
    <footer class="piede">Accesso come ${user.email}</footer>`;

  root.querySelector('.esci').addEventListener('click', () => supabase.auth.signOut());
  root.querySelectorAll('nav.schede button').forEach((b) =>
    b.addEventListener('click', () => {
      sezione = b.dataset.s;
      root.querySelectorAll('nav.schede button').forEach((x) => x.toggleAttribute('aria-current', x === b));
      SEZIONI[sezione].mostra(root.querySelector('#contenuto'));
    })
  );
  SEZIONI[sezione].mostra(root.querySelector('#contenuto'));
}

supabase.auth.onAuthStateChange((_evento, session) => {
  const user = session?.user ?? null;
  // evita di ridisegnare quando cambia solo il token
  if (utenteCorrente !== undefined && (user?.id ?? null) === (utenteCorrente?.id ?? null)) return;
  utenteCorrente = user;
  user ? mostraApp(user) : mostraLogin(root);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

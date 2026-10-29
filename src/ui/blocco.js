// Schermata di blocco: chiede Face ID / impronta prima di mostrare i dati.
import { supabase } from '../lib/supabase.js';
import { sblocca, sbloccoAttivo, sbloccatoOra, dimenticaSblocco, MINUTI_BLOCCO } from '../lib/sblocco.js';
import { app } from '../stato.js';

let nascostaDal = null;

export function mostraBlocco() {
  if (document.querySelector('.blocco')) return;
  const el = document.createElement('div');
  el.className = 'blocco';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="blocco-card">
      <img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" width="64" height="64" />
      <h1>Badante di Maria</h1>
      <p>App bloccata</p>
      <button type="button" class="primario sblocca">Sblocca</button>
      <p class="errore" role="alert" hidden></p>
      <button type="button" class="link esci-blocco">Esci e accedi con la password</button>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('bloccato');
  const err = el.querySelector('.errore');
  const prova = async () => {
    err.hidden = true;
    try {
      await sblocca();
      el.remove();
      document.body.classList.remove('bloccato');
    } catch (e) {
      err.textContent = e.name === 'NotAllowedError' ? 'Sblocco annullato o non riuscito. Riprova.' : `Sblocco non riuscito: ${e.message}`;
      err.hidden = false;
    }
  };
  el.querySelector('.sblocca').addEventListener('click', prova);
  el.querySelector('.esci-blocco').addEventListener('click', async () => {
    el.remove();
    document.body.classList.remove('bloccato');
    await supabase.auth.signOut();
  });
}

/** Da chiamare dopo l'accesso: blocca subito se serve, e dopo qualche minuto in background. */
export function controllaBlocco(user) {
  if (sbloccoAttivo(user) && !sbloccatoOra()) mostraBlocco();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { nascostaDal = Date.now(); return; }
  if (nascostaDal && Date.now() - nascostaDal > MINUTI_BLOCCO * 60000 && app.user && sbloccoAttivo(app.user)) {
    dimenticaSblocco();
    mostraBlocco();
  }
  nascostaDal = null;
});

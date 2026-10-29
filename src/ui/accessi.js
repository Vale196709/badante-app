// Gestione degli accessi profilati (solo per il titolare).
import { app, esc, dataIt, toast } from '../stato.js';
import { caricaAccessi, creaInvito, eliminaInvito, eliminaAccesso } from '../lib/dati.js';

const RUOLI = {
  gestore: { nome: 'Gestore', descr: 'Familiare o consulente: inserisce presenze, conferma cedolini, modifica i dati. Non gestisce gli accessi.' },
  lettore: { nome: 'Sola lettura', descr: 'Vede tutto (cedolini, costi, scadenze, documenti) ma non modifica nulla.' },
  lavoratrice: { nome: 'Lavoratrice', descr: 'Vede i propri cedolini confermati, ferie e TFR e i documenti condivisi; firma la ricevuta dello stipendio e chiede ferie e permessi. Può scegliere la lingua.' },
};

export async function mostraAccessi(root) {
  if (!app.rapporto?.id) { root.innerHTML = '<p class="vuoto">Salva prima i dati del rapporto.</p>'; return; }
  root.innerHTML = '<p class="caricamento">Caricamento…</p>';
  let dati;
  try {
    dati = await caricaAccessi(app.rapporto.id);
  } catch (e) {
    root.innerHTML = `<div class="avviso grave">Gli accessi non sono ancora attivi nel database: esegui lo script <code>supabase/02_ruoli.sql</code> nel SQL Editor di Supabase. (${esc(e.message)})</div>`;
    return;
  }

  root.innerHTML = `
    <section class="card">
      <h2>Chi può entrare</h2>
      <ul class="lista-accessi">
        <li><span><strong>${esc(app.user.email)}</strong><br><small>Titolare · tutto, compresa questa pagina</small></span></li>
        ${dati.accessi.map((a) => `<li><span><strong>${esc(a.email)}</strong><br><small>${RUOLI[a.ruolo].nome} · dal ${dataIt(a.created_at)}</small></span>
          <button type="button" class="link ko" data-revoca="${a.user_id}">Revoca</button></li>`).join('')}
        ${dati.inviti.map((i) => `<li class="in-attesa"><span><strong>${esc(i.email)}</strong><br><small>${RUOLI[i.ruolo].nome} · in attesa del primo accesso</small></span>
          <button type="button" class="link ko" data-annulla="${i.id}">Annulla</button></li>`).join('')}
      </ul>
    </section>
    <section class="card">
      <h2>Aggiungi una persona</h2>
      <ol class="passi">
        <li>In Supabase apri <strong>Authentication → Users → Add user → Create new user</strong>, inserisci la sua email e una password provvisoria, spunta <strong>Auto Confirm User</strong>.</li>
        <li>Qui sotto scegli il ruolo e invia l'invito con la stessa email.</li>
        <li>Comunica alla persona l'indirizzo dell'app, l'email e la password: al primo accesso vedrà solo ciò che il ruolo consente.</li>
      </ol>
      <form class="form-invito">
        <label>Email<input name="email" type="email" required inputmode="email" autocomplete="off" /></label>
        <fieldset class="ruoli">
          ${Object.entries(RUOLI).map(([k, r], i) => `<label class="scelta-ruolo"><input type="radio" name="ruolo" value="${k}" ${i === 0 ? 'checked' : ''}/><span><strong>${r.nome}</strong><small>${r.descr}</small></span></label>`).join('')}
        </fieldset>
        <button type="submit" class="primario">Invia invito</button>
      </form>
    </section>`;

  root.querySelector('.form-invito').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const email = f.email.value.trim();
    if (!email.includes('@')) return;
    if (email.toLowerCase() === app.user.email.toLowerCase()) { toast('Sei già il titolare', 'ko'); return; }
    try {
      await creaInvito(app.rapporto.id, email, f.ruolo.value);
      toast('Invito registrato');
      mostraAccessi(root);
    } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  });
  root.querySelectorAll('[data-annulla]').forEach((b) => b.addEventListener('click', async () => {
    try { await eliminaInvito(b.dataset.annulla); mostraAccessi(root); } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  }));
  root.querySelectorAll('[data-revoca]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Revocare l\'accesso? La persona non vedrà più nulla di questo rapporto.')) return;
    try { await eliminaAccesso(app.rapporto.id, b.dataset.revoca); mostraAccessi(root); } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  }));
}

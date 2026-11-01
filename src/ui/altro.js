// Pagina "Altro" sul telefono: strumenti, rapporti, account.
import { app, isTitolare, esc, nomeRapporto } from '../stato.js';
import { ICONE, tessera } from './icone.js';
import { supabase } from '../lib/supabase.js';
import { VERSIONE, dataBuildIt } from '../novita.js';
import { apriSchedaImpostazioni } from './impostazioni.js';
import { sbloccoAttivo } from '../lib/sblocco.js';

const RUOLI = { titolare: 'Titolare', gestore: 'Gestore', lettore: 'Sola lettura', lavoratrice: 'Lavoratrice' };

export function mostraAltro(root, { vai, scegliRapporto }) {
  const riga = (attr, icona, colore, testo, sotto = '', chev = true) => `
    <li><button type="button" class="riga-lista" ${attr}>${tessera(icona, colore)}
      <span class="riga-testo">${testo}${sotto ? `<small>${sotto}</small>` : ''}</span>${chev ? ICONE.chevron : ''}</button></li>`;
  root.innerHTML = `
    <h1 class="titolo-pagina">Altro</h1>
    <ul class="gruppo">
      ${riga('data-vai="home"', 'casa', '#1e4e8c', 'Riepilogo', 'Mese in corso, contatori, avvisi e anno')}
      ${riga('data-vai="simulatore"', 'bilancia', '#7a5af8', 'Simulatore', 'Scenari di costo, tipo di rapporto, fine rapporto')}
      ${riga('data-vai="scadenze"', 'campana', '#e0a100', 'Scadenze', 'Stipendi, contributi INPS e pratiche')}
      ${riga('data-vai="impostazioni"', 'ingranaggio', '#8e8e93', 'Impostazioni', 'Rapporto, variazioni, tabelle, promemoria, accessi, registro, backup, sicurezza')}
    </ul>
    <h2 class="testa-gruppo">Rapporti di lavoro</h2>
    <ul class="gruppo">
      ${app.rapporti.map((r) => riga(`data-rapporto="${r.id}"`, 'persona', r.id === app.rapporto.id ? 'var(--tinta)' : '#aeaeb2', esc(nomeRapporto(r)),
        `${RUOLI[r.ruolo]}${r.dati?.tipoContratto === 'determinato' ? ' · a termine' : ''}${r.id === app.rapporto.id ? ' · in uso' : ''}`, r.id !== app.rapporto.id)).join('')}
      ${isTitolare() || !app.rapporti.length ? riga('data-nuovo', 'piu', '#2e9f5a', 'Aggiungi rapporto', 'Per esempio una sostituta durante le ferie') : ''}
    </ul>
    <h2 class="testa-gruppo">Account</h2>
    <ul class="gruppo">
      <li class="riga-info"><span>${esc(app.user.email)}</span><small>${RUOLI[app.rapporto.ruolo]}</small></li>
      ${riga('data-sicurezza', 'scudo', '#1e4e8c', 'Sicurezza', sbloccoAttivo(app.user) ? 'Sblocco con Face ID attivo' : 'Resta collegato, Face ID, testo più grande')}
      ${riga('data-esci', 'esci', '#ff3b30', 'Esci', '', false)}
    </ul>
    <ul class="gruppo">
      ${riga('data-vai="info"', 'documento', '#8691a8', 'Informazioni', `Sviluppata da Valentino<br>Versione ${VERSIONE} · aggiornata il ${dataBuildIt()}`)}
    </ul>`;
  root.querySelectorAll('[data-vai]').forEach((b) => b.addEventListener('click', () => vai(b.dataset.vai)));
  root.querySelectorAll('[data-rapporto]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.rapporto !== app.rapporto.id) scegliRapporto(b.dataset.rapporto); }));
  root.querySelector('[data-nuovo]')?.addEventListener('click', () => scegliRapporto(null));
  root.querySelector('[data-sicurezza]').addEventListener('click', () => { apriSchedaImpostazioni('sicurezza'); vai('impostazioni'); });
  root.querySelector('[data-esci]').addEventListener('click', () => supabase.auth.signOut());
}

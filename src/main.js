import './style.css';
import { supabase } from './lib/supabase.js';
import { caricaOreSegnate } from './lib/dati.js';
import { caricaContesto, caricaCedolini, caricaScadenzeFatte, caricaTabelle, caricaVersamenti, caricaRichieste, caricaDocumenti } from './lib/dati.js';
import { impostaTabellePersonalizzate } from './engine/tabelle.js';
import { LINGUE, linguaCorrente, impostaLingua, t } from './i18n.js';
import { app, esc, nomeRapporto } from './stato.js';
import { ICONE } from './ui/icone.js';
import { mostraLogin } from './ui/login.js';
import { RAPPORTO_VUOTO } from './ui/rapporto.js';
import { mostraImpostazioni } from './ui/impostazioni.js';
import { mostraHome } from './ui/home.js';
import { mostraMesi } from './ui/mesi.js';
import { mostraSimulatore } from './ui/simulatore.js';
import { mostraDocumenti } from './ui/documenti.js';
import { mostraScadenze } from './ui/scadenze.js';
import { mostraAltro } from './ui/altro.js';
import { mostraInfo } from './ui/info.js';
import { mostraReport } from './ui/report.js';
import { VERSIONE, dataBuildIt } from './novita.js';
import { controllaBlocco } from './ui/blocco.js';
import { sessioneScaduta } from './lib/sblocco.js';
import { mostraLavoratrice, mostraRichiesteLavoratrice, mostraDocumentiLavoratrice } from './ui/lavoratrice.js';
import { mostraOreLavoratrice } from './ui/oreLavoratrice.js';
import { mostraFerie } from './ui/ferie.js';
import { mostraCoseDaFare, datiCoseDaFare } from './ui/cosefare.js';

const root = document.getElementById('app');
let utenteCorrente;
let sezione = null;
const GESTIONE = ['titolare', 'gestore', 'lettore'];

// barra: 'basso' = barra in basso su telefono; 'lato' = colonna laterale su PC
const SEZIONI = {
  // ordine del menu scelto dall'utente: Documenti, Report, Simulatore, Presenze, Riepilogo, Cose da fare, Scadenze, Impostazioni
  // (dalla 1.8 sul telefono la barra in basso ha Documenti, Report, Presenze e Cose da fare; il Simulatore è in "Altro")
  documenti: { titolo: 'Documenti', icona: 'documento', mostra: mostraDocumenti, ruoli: GESTIONE, barra: ['basso', 'lato'] },
  report: { titolo: 'Report', icona: 'grafico', mostra: mostraReport, ruoli: GESTIONE, barra: ['basso', 'lato'] },
  simulatore: { titolo: 'Simulatore', icona: 'bilancia', mostra: mostraSimulatore, ruoli: GESTIONE, barra: ['lato'] },
  mesi: { titolo: 'Presenze', titoloLungo: 'Presenze e cedolini', icona: 'calendario', mostra: mostraMesi, ruoli: GESTIONE, barra: ['basso', 'lato'] },
  home: { titolo: 'Riepilogo', icona: 'casa', mostra: mostraHome, ruoli: GESTIONE, barra: ['lato'] },
  cosefare: { titolo: 'Cose da fare', icona: 'spunta', mostra: mostraCoseDaFare, ruoli: GESTIONE, barra: ['basso', 'lato'] },
  scadenze: { titolo: 'Scadenze', icona: 'campana', mostra: mostraScadenze, ruoli: GESTIONE, barra: ['lato'] },
  impostazioni: { titolo: 'Impostazioni', icona: 'ingranaggio', mostra: mostraImpostazioni, ruoli: GESTIONE, barra: ['lato'] },
  altro: { titolo: 'Altro', icona: 'altro', mostra: mostraAltro, ruoli: GESTIONE, barra: ['basso'] },
  ferie: { titolo: 'Ferie', icona: 'calendario', mostra: mostraFerie, ruoli: GESTIONE, barra: [] },
  info: { titolo: 'Informazioni', icona: 'documento', mostra: mostraInfo, ruoli: [...GESTIONE, 'lavoratrice'], barra: [] },
  lavoratrice: { titolo: () => t('tabCedolini'), icona: 'euro', mostra: mostraLavoratrice, ruoli: ['lavoratrice'], barra: ['basso', 'lato'] },
  lavOre: { titolo: () => t('tabOre'), icona: 'orologio', mostra: mostraOreLavoratrice, ruoli: ['lavoratrice'], barra: ['basso', 'lato'] },
  lavRichieste: { titolo: () => t('tabRichieste'), icona: 'valigia', mostra: mostraRichiesteLavoratrice, ruoli: ['lavoratrice'], barra: ['basso', 'lato'] },
  lavDocumenti: { titolo: () => t('tabDocumenti'), icona: 'documento', mostra: mostraDocumentiLavoratrice, ruoli: ['lavoratrice'], barra: ['basso', 'lato'] },
};
export const RUOLI = { titolare: 'Titolare', gestore: 'Gestore', lettore: 'Sola lettura', lavoratrice: 'Lavoratrice' };
const titolo = (s, lungo = false) => (typeof s.titolo === 'function' ? s.titolo() : (lungo && s.titoloLungo) || s.titolo);
const CHIAVE_RAPPORTO = 'badante-rapporto';

export async function ricaricaDati() {
  if (!app.rapporto?.id) { Object.assign(app, { cedolini: [], fatte: new Set(), versamenti: [], richieste: [], documenti: [], ore: [] }); impostaTabellePersonalizzate({}); return; }
  const id = app.rapporto.id;
  const lav = app.rapporto.ruolo === 'lavoratrice';
  const [cedolini, fatte, tabelle, versamenti, richieste, documenti, ore] = await Promise.all([
    caricaCedolini(id),
    lav ? new Set() : caricaScadenzeFatte(id),
    caricaTabelle(id),
    lav ? [] : caricaVersamenti(id),
    caricaRichieste(id),
    caricaDocumenti(id),
    caricaOreSegnate(id),
  ]);
  Object.assign(app, { cedolini, fatte, versamenti, richieste, documenti, ore });
  impostaTabellePersonalizzate(tabelle);
}

const normalizza = (r) => {
  if (!r?.dati) return r;
  const d = r.dati;
  return { ...r, dati: { ...RAPPORTO_VUOTO, ...d, datore: { ...RAPPORTO_VUOTO.datore, ...d.datore }, lavoratrice: { ...RAPPORTO_VUOTO.lavoratrice, ...d.lavoratrice } } };
};

/** Cambia il rapporto attivo (id null = nuovo rapporto da creare). */
export async function scegliRapporto(id, bozza = null) {
  app.bozzaRapporto = id === null ? bozza : null; // dati proposti per il nuovo rapporto (es. sostituta)
  try { localStorage.setItem(CHIAVE_RAPPORTO, id ?? ''); } catch { /* memoria non disponibile */ }
  if (id === null) {
    app.rapporto = { id: null, dati: null, ruolo: 'titolare' };
    sezione = 'impostazioni';
    await ricaricaDati();
    disegnaApp();
    return;
  }
  app.rapporto = app.rapporti.find((r) => r.id === id) ?? app.rapporti[0];
  await ricaricaDati();
  if (!SEZIONI[sezione]?.ruoli.includes(app.rapporto.ruolo)) sezione = null;
  disegnaApp();
}

export function vai(nome) {
  sezione = nome;
  root.querySelectorAll('[data-s]').forEach((x) => x.toggleAttribute('aria-current', x.dataset.s === nome));
  // sul telefono le sezioni fuori dalla barra in basso evidenziano "Altro"
  const basso = root.querySelector('.barra-bassa');
  if (basso && !basso.querySelector(`[data-s="${nome}"]`)) basso.querySelector('[data-s=altro]')?.setAttribute('aria-current', '');
  aggiornaPallini();
  const el = root.querySelector('#contenuto');
  el.innerHTML = '';
  window.scrollTo(0, 0);
  SEZIONI[nome].mostra(el, { vai, ricaricaDati, scegliRapporto, ricaricaApp: () => mostraApp(app.user) });
}

function disegnaApp() {
  const user = app.user;
  const ruolo = app.rapporto.ruolo;
  const lav = ruolo === 'lavoratrice';
  const visibili = Object.entries(SEZIONI).filter(([, s]) => s.ruoli.includes(ruolo));
  // si apre sul Riepilogo (la lavoratrice sui suoi cedolini)
  if (!sezione || !SEZIONI[sezione]?.ruoli.includes(ruolo)) sezione = lav ? visibili[0][0] : app.rapporto.dati ? 'home' : 'impostazioni';
  const piu = app.rapporti.length > 1;

  root.innerHTML = `
    <div class="guscio">
      <aside class="lato" aria-label="Menu">
        <div class="lato-testa">
          <img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" width="34" height="34" />
          <div><strong>Badante di Maria</strong><small>${esc(RUOLI[ruolo])}</small></div>
        </div>
        ${piu || ruolo === 'titolare' ? `<label class="scelta-rapporto">Rapporto
          <select class="sel-rapporto">
            ${app.rapporti.map((r) => `<option value="${r.id}" ${r.id === app.rapporto.id ? 'selected' : ''}>${esc(nomeRapporto(r))}</option>`).join('')}
            ${!app.rapporto.id ? '<option value="" selected>Nuovo rapporto</option>' : ''}
            ${!lav ? '<option value="__nuovo">+ Aggiungi rapporto…</option>' : ''}
          </select></label>` : ''}
        <nav class="lato-nav">
          ${visibili.filter(([, s]) => s.barra.includes('lato')).map(([k, s]) => `<button type="button" data-s="${k}">${ICONE[s.icona]}<span>${esc(titolo(s, true))}</span></button>`).join('')}
        </nav>
        <div class="lato-piede">
          ${lav ? `<select class="lingua" aria-label="${t('lingua')}">${Object.entries(LINGUE).map(([k, v]) => `<option value="${k}" ${k === linguaCorrente() ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}
          <small>${esc(user.email)}</small>
          <small class="autore">Sviluppata da Valentino</small>
          <button type="button" class="link versione" data-s="info">Versione ${esc(VERSIONE)} · ${esc(dataBuildIt().split(' alle')[0])}</button>
          <button type="button" class="esci">${ICONE.esci}<span>${lav ? t('esci') : 'Esci'}</span></button>
        </div>
      </aside>

      <div class="principale">
        <header class="barra-alta">
          <span class="barra-alta-titolo">${esc(app.rapporto.dati ? nomeRapporto(app.rapporto) : 'Badante di Maria')}</span>
          ${lav ? `<select class="lingua" aria-label="${t('lingua')}">${Object.entries(LINGUE).map(([k, v]) => `<option value="${k}" ${k === linguaCorrente() ? 'selected' : ''}>${v}</option>`).join('')}</select>
                   <button type="button" class="esci tondo" aria-label="${t('esci')}">${ICONE.esci}</button>` : ''}
        </header>
        <main id="contenuto" class="contenuto"></main>
      </div>

      <nav class="barra-bassa" aria-label="Sezioni">
        ${visibili.filter(([, s]) => s.barra.includes('basso')).map(([k, s]) => `<button type="button" data-s="${k}">${ICONE[s.icona]}<span>${esc(titolo(s))}</span></button>`).join('')}
      </nav>
    </div>`;

  root.querySelectorAll('.esci').forEach((b) => b.addEventListener('click', () => supabase.auth.signOut()));
  root.querySelectorAll('.lingua').forEach((s) => s.addEventListener('change', (e) => { impostaLingua(e.target.value); disegnaApp(); }));
  root.querySelector('.sel-rapporto')?.addEventListener('change', (e) => scegliRapporto(e.target.value === '__nuovo' ? null : e.target.value));
  root.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => vai(b.dataset.s)));
  vai(sezione);
}

/** Numero di cose urgenti (in ritardo o da fare entro 10 giorni) su "Cose da fare" e sull'icona dell'app. */
export function aggiornaPallini() {
  let n = 0;
  try {
    if (app.rapporto?.dati && app.rapporto.ruolo !== 'lavoratrice') {
      const { percorso, scadenze } = datiCoseDaFare();
      n = scadenze.filter((x) => x.stato === 'ritardo' || x.stato === 'ora').length
        + (percorso?.passi.filter((p) => p.stato === 'ritardo').length || 0);
    }
  } catch { n = 0; }
  root.querySelectorAll('[data-s=cosefare]').forEach((b) => {
    b.querySelector('.pallino')?.remove();
    if (n) b.insertAdjacentHTML('beforeend', `<span class="pallino" aria-label="${n} da fare">${n > 9 ? '9+' : n}</span>`);
  });
  try { if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch { /* non supportato */ }
}

async function mostraApp(user) {
  root.innerHTML = '<p class="caricamento">Caricamento…</p>';
  controllaBlocco(user);
  try {
    app.user = user;
    app.rapporti = (await caricaContesto(user)).map(normalizza);
    let scelto = null;
    try { scelto = localStorage.getItem(CHIAVE_RAPPORTO); } catch { /* */ }
    app.rapporto = app.rapporti.find((r) => r.id === scelto) ?? app.rapporti[0] ?? { id: null, dati: null, ruolo: 'titolare' };
    await ricaricaDati();
  } catch (e) {
    root.innerHTML = `<main class="contenuto"><p class="errore">Impossibile leggere i dati: ${esc(e.message)}</p>
      <button class="secondario" onclick="location.reload()">Riprova</button></main>`;
    return;
  }
  disegnaApp();
}
export { mostraApp };

supabase.auth.onAuthStateChange((_evento, session) => {
  const user = session?.user ?? null;
  if (user && sessioneScaduta()) { supabase.auth.signOut(); return; }
  if (utenteCorrente !== undefined && (user?.id ?? null) === (utenteCorrente?.id ?? null)) return;
  utenteCorrente = user;
  setTimeout(() => (user ? mostraApp(user) : mostraLogin(root)), 0);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

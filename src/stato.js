import { fmtEur, fmtNum } from './engine/formato.js';
// Stato condiviso dell'app e funzioni di supporto per le schermate.
import { calcolaCatena } from './engine/catena.js';

export const app = {
  user: null,
  rapporti: [],
  rapporto: null,  // { id, user_id, dati, ruolo }
  cedolini: [],
  fatte: new Set(),
  versamenti: [],
  richieste: [],
  documenti: [],
};

export const nomeRapporto = (r) => r?.dati?.lavoratrice?.nome || (r?.dati ? 'Rapporto senza nome' : 'Nuovo rapporto');
export const puoModificare = () => ['titolare', 'gestore'].includes(app.rapporto?.ruolo);
export const isTitolare = () => app.rapporto?.ruolo === 'titolare';
export const isLavoratrice = () => app.rapporto?.ruolo === 'lavoratrice';

export function oggiIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Catena dei mesi fino al mese corrente (o all'ultimo mese salvato, se successivo). */
export function catenaCorrente(fino) {
  const d = app.rapporto?.dati;
  if (!d) return [];
  const oggi = oggiIso();
  let target = fino ?? { anno: Number(oggi.slice(0, 4)), mese: Number(oggi.slice(5, 7)) };
  for (const c of app.cedolini) {
    if (c.anno > target.anno || (c.anno === target.anno && c.mese > target.mese)) target = { anno: c.anno, mese: c.mese };
  }
  return calcolaCatena(d, app.cedolini, target);
}

// ---------- formattazione ----------
export const eur = fmtEur;
export const num = (n, dec = 2) => fmtNum(n, dec);
export const dataIt = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const nomeMeseMaiusc = (m) => MESI[m - 1];

export function toast(testo, tipo = 'ok') {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = testo;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('via'), 2600);
  setTimeout(() => el.remove(), 3200);
}

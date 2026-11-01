// La lavoratrice segna le ore lavorate giorno per giorno; il datore le approva.
import { app, num, esc, oggiIso, toast } from '../stato.js';
import { t, meseT, linguaCorrente } from '../i18n.js';
import { calendarioMese } from '../engine/calcolo.js';
import { condizioniMese } from '../engine/variazioni.js';
import { segnaOre, caricaOreSegnate } from '../lib/dati.js';
import { leggiCoda, mettiInCoda, svuotaCoda, erroreDiRete } from '../lib/codaOre.js';

let ascoltoRete = false;

const LOCALI = { it: 'it-IT', ro: 'ro-RO', uk: 'uk-UA', ru: 'ru-RU', en: 'en-GB' };
let meseScelto = null;

export function mostraOreLavoratrice(root, ctx) {
  const d = app.rapporto.dati;
  const oggi = oggiIso();
  const corrente = oggi.slice(0, 7);
  const prec = (() => { const [a, m] = corrente.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`; })();
  const scelte = [corrente, prec].filter((k) => k >= d.dataAssunzione.slice(0, 7));
  if (!scelte.includes(meseScelto)) meseScelto = scelte[0];
  if (!meseScelto) { root.innerHTML = `<p class="vuoto">${t('nessunCedolino')}</p>`; return; }
  const [anno, mese] = meseScelto.split('-').map(Number);
  const chiuso = app.cedolini.some((c) => c.anno === anno && c.mese === mese && c.stato !== 'bozza');
  const cal = calendarioMese(condizioniMese(d, anno, mese), anno, mese).filter((g) => g.attivo && g.data <= oggi);
  const segnate = new Map(app.ore.map((o) => [o.data, o]));
  // ore segnate senza rete, non ancora partite
  const coda = new Map(leggiCoda(app.rapporto.id).map((r) => [r.data, r]));
  for (const [data, r] of coda) segnate.set(data, { ...segnate.get(data), ...r, stato: 'in coda' });
  if (coda.size && navigator.onLine) prova(root, ctx);
  if (!ascoltoRete) {
    ascoltoRete = true;
    window.addEventListener('online', () => { if (document.querySelector('.lista-ore')) prova(document.querySelector('#contenuto'), ctx); });
  }
  const fmtG = new Intl.DateTimeFormat(LOCALI[linguaCorrente()] || 'it-IT', { weekday: 'short', day: 'numeric' });
  const stati = { 'in attesa': t('inAttesa'), approvata: t('approvata'), rifiutata: t('rifiutata'), 'in coda': t('inCoda') };

  root.innerHTML = `
    <h1 class="titolo-pagina">${t('tabOre')}</h1>
    <section class="card">
      <div class="card-testa"><h2>${t('oreTitolo')}</h2>
        ${scelte.length > 1 ? `<select name="mese" aria-label="mese">${scelte.map((k) => `<option value="${k}" ${k === meseScelto ? 'selected' : ''}>${meseT(Number(k.slice(5)))} ${k.slice(0, 4)}</option>`).join('')}</select>` : `<strong>${meseT(mese)} ${anno}</strong>`}</div>
      <p class="nota">${chiuso ? t('meseChiuso') : t('oreSpiega')}</p>
      ${coda.size ? `<div class="avviso attenzione">${t('codaAvviso')}</div>` : ''}
      <ul class="lista-ore">
        ${[...cal].reverse().map((g) => {
          const s = segnate.get(g.data);
          const bloccata = chiuso || s?.stato === 'approvata';
          const prev = g.festivita ? 0 : g.oreProgrammate;
          return `<li class="${g.festivita || !prev ? 'non-lav' : ''}">
            <span class="giorno-ore"><strong>${esc(fmtG.format(new Date(g.data + 'T12:00:00')))}</strong>
              <small>${g.festivita ? t('festivo') : prev ? `${num(prev, prev % 1 ? 1 : 0)} h ${t('previste')}` : t('riposo')}</small></span>
            ${s ? `<span class="pillola ${s.stato === 'approvata' ? 'pagato' : s.stato === 'rifiutata' ? 'rifiutata' : s.stato === 'in coda' ? 'in-coda' : 'bozza'}">${stati[s.stato]}</span>` : '<span></span>'}
            <input type="number" min="0" max="16" step="0.5" inputmode="decimal" data-g="${g.data}" data-prev="${prev}"
              value="${s ? Number(s.ore) : ''}" placeholder="${prev ? num(prev, 1) : '0'}" ${bloccata ? 'disabled' : ''} aria-label="${t('ore')}" />
          </li>`;
        }).join('')}
      </ul>
      ${chiuso ? '' : `<div class="azioni-mese">
        <button type="button" class="secondario come-orario">${t('comeOrario')}</button>
        <button type="button" class="primario invia-ore">${t('inviaOre')}</button>
      </div>`}
    </section>`;

  root.querySelector('[name=mese]')?.addEventListener('change', (e) => { meseScelto = e.target.value; mostraOreLavoratrice(root, ctx); });
  root.querySelector('.come-orario')?.addEventListener('click', () => {
    root.querySelectorAll('input[data-g]:not(:disabled)').forEach((i) => { if (i.value === '' && Number(i.dataset.prev) > 0) i.value = i.dataset.prev; });
  });
  root.querySelector('.invia-ore')?.addEventListener('click', async (e) => {
    const righe = [];
    root.querySelectorAll('input[data-g]:not(:disabled)').forEach((i) => {
      if (i.value === '') return;
      const ore = Math.max(0, Math.min(16, Number(i.value.replace(',', '.')) || 0));
      const s = segnate.get(i.dataset.g);
      if (s && Number(s.ore) === ore && (s.stato === 'in attesa' || s.stato === 'in coda')) return; // invariata
      if (!s && ore === 0 && Number(i.dataset.prev) === 0) return;
      righe.push({ data: i.dataset.g, ore });
    });
    if (!righe.length) { toast(t('nienteDaInviare')); return; }
    e.currentTarget.disabled = true;
    try {
      await segnaOre(app.rapporto.id, righe);
      app.ore = await caricaOreSegnate(app.rapporto.id);
      toast(t('oreInviate'));
      mostraOreLavoratrice(root, ctx);
    } catch (err) {
      if (erroreDiRete(err) && mettiInCoda(app.rapporto.id, righe)) {
        toast(t('oreInCoda'));
        mostraOreLavoratrice(root, ctx);
        return;
      }
      toast(`Errore: ${err.message}`, 'ko');
      e.currentTarget.disabled = false;
    }
  });
}

async function prova(root, ctx) {
  try {
    const n = await svuotaCoda(app.rapporto.id);
    if (!n) return;
    app.ore = await caricaOreSegnate(app.rapporto.id);
    toast(t('codaInviata'));
    if (root?.querySelector('.lista-ore')) mostraOreLavoratrice(root, ctx);
  } catch { /* si riprova al prossimo ritorno della rete */ }
}

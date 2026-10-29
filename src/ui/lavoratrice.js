// Vista della lavoratrice, tradotta nella lingua scelta: cedolini con firma per ricevuta,
// richieste di ferie e permessi, documenti condivisi.
import { app, eur, num, esc, dataIt, toast, oggiIso } from '../stato.js';
import { firmaRicevutaConFirma, creaRichiesta, ritiraRichiesta, caricaRichieste } from '../lib/dati.js';
import { stampaCedolino } from './stampe.js';
import { apriFile } from './documenti.js';
import { t, meseT } from '../i18n.js';

// ---------- Cedolini ----------
export function mostraLavoratrice(root, { ricaricaDati }) {
  const visibili = app.cedolini.filter((c) => c.stato !== 'bozza').sort((a, b) => b.anno - a.anno || b.mese - a.mese);
  if (!visibili.length) {
    root.innerHTML = `<p class="vuoto">${t('nessunCedolino')}</p>`;
    return;
  }
  const ultimo = visibili[0].risultato.contatori;
  root.innerHTML = `
    <h1 class="titolo-pagina">${t('tabCedolini')}</h1>
    <section class="card">
      <div class="cifre">
        <div><span class="etichetta">${t('ferieResidue')}</span><span class="valore">${num(ultimo.ferieResidueOre, 1)} ${t('ore')}</span></div>
        <div><span class="etichetta">${t('tfr')}</span><span class="valore">${eur(ultimo.tfrAccantonato)}</span></div>
      </div>
      <p class="nota">${t('aggiornati')}</p>
    </section>
    <ul class="lista-mesi">
      ${visibili.map((c) => `
        <li class="riga-lav">
          <span class="mese">${meseT(c.mese)} ${c.anno}</span>
          <span class="netto">${eur(c.risultato.netto)}</span>
          <span class="azioni-lav">
            <button type="button" class="secondario" data-vedi="${c.id}">${t('vedi')}</button>
            ${c.ricevuta_at
              ? `<span class="nota">✍︎ ${t('ricevutoIl')} ${dataIt(c.ricevuta_at)}</span>`
              : `<button type="button" class="primario piccolo" data-firma="${c.id}">${t('confermoRicevuto')} ${eur(c.risultato.netto)}</button>`}
          </span>
        </li>`).join('')}
    </ul>
    <dialog class="dlg-firma"></dialog>`;

  root.querySelectorAll('[data-vedi]').forEach((b) => b.addEventListener('click', () => {
    const c = visibili.find((x) => x.id === b.dataset.vedi);
    stampaCedolino({ anno: c.anno, mese: c.mese, risultato: c.risultato }, c, { traduci: true });
  }));
  root.querySelectorAll('[data-firma]').forEach((b) => b.addEventListener('click', () => {
    const c = visibili.find((x) => x.id === b.dataset.firma);
    chiediFirma(root.querySelector('.dlg-firma'), t('domandaRicevuta', { importo: eur(c.risultato.netto), mese: `${meseT(c.mese)} ${c.anno}` }), async (png) => {
      await firmaRicevutaConFirma(c.id, png);
      await ricaricaDati();
      toast(t('ricevutaOk'));
      mostraLavoratrice(root, { ricaricaDati });
    });
  }));
}

/** Riquadro di firma con il dito (o il mouse). Restituisce un PNG compatto. */
export function chiediFirma(dlg, domanda, alConferma) {
  dlg.innerHTML = `
    <form method="dialog" class="form-giorno">
      <h3>${esc(domanda)}</h3>
      <p class="nota">${t('firmaQui')}</p>
      <canvas class="tavola-firma" width="600" height="220" aria-label="${t('firmaQui')}"></canvas>
      <p class="errore" hidden></p>
      <div class="riga fine">
        <button type="button" class="link pulisci">${t('cancella')}</button>
        <button value="annulla" class="secondario">${t('annulla')}</button>
        <button type="button" class="primario ok">${t('conferma')}</button>
      </div>
    </form>`;
  const cv = dlg.querySelector('canvas');
  const ctx = cv.getContext('2d');
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a2a6c';
  let disegnando = false, tratti = 0, ultimo = null;
  const punto = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height };
  };
  cv.addEventListener('pointerdown', (e) => { disegnando = true; ultimo = punto(e); cv.setPointerCapture(e.pointerId); e.preventDefault(); });
  cv.addEventListener('pointermove', (e) => {
    if (!disegnando) return;
    const p = punto(e);
    ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo = p; tratti++;
    e.preventDefault();
  });
  const fine = () => { disegnando = false; };
  cv.addEventListener('pointerup', fine);
  cv.addEventListener('pointercancel', fine);
  dlg.querySelector('.pulisci').addEventListener('click', () => { ctx.clearRect(0, 0, cv.width, cv.height); tratti = 0; });
  dlg.querySelector('.ok').addEventListener('click', async () => {
    const err = dlg.querySelector('.errore');
    if (tratti < 5) { err.textContent = t('firmaVuota'); err.hidden = false; return; }
    const btn = dlg.querySelector('.ok');
    btn.disabled = true;
    try {
      await alConferma(cv.toDataURL('image/png'));
      dlg.close();
    } catch (e) {
      err.textContent = e.message; err.hidden = false; btn.disabled = false;
    }
  });
  dlg.showModal();
}

// ---------- Richieste di ferie e permessi ----------
export function mostraRichiesteLavoratrice(root) {
  const stati = { 'in attesa': t('inAttesa'), approvata: t('approvata'), rifiutata: t('rifiutata') };
  const classi = { 'in attesa': 'bozza', approvata: 'pagato', rifiutata: '' };
  root.innerHTML = `
    <h1 class="titolo-pagina">${t('tabRichieste')}</h1>
    <section class="card">
      <h2>${t('nuovaRichiesta')}</h2>
      <form class="form-richiesta">
        <div class="scelte">
          <label class="scelta"><input type="radio" name="tipo" value="F" checked /><span>${t('ferie')}</span></label>
          <label class="scelta"><input type="radio" name="tipo" value="P" /><span>${t('permesso')}</span></label>
        </div>
        <div class="riga">
          <label>${t('dal')}<input type="date" name="dal" required min="${oggiIso()}" /></label>
          <label>${t('al')}<input type="date" name="al" required min="${oggiIso()}" /></label>
        </div>
        <label class="campo-ore-perm" hidden>${t('orePermesso')}<input type="number" name="ore" min="0.5" max="12" step="0.5" inputmode="decimal" /></label>
        <label>${t('nota')}<input name="nota" maxlength="300" /></label>
        <button type="submit" class="primario">${t('invia')}</button>
      </form>
    </section>
    <section class="card">
      <h2>${t('mieRichieste')}</h2>
      ${app.richieste.length ? `<ul class="lista-richieste">${app.richieste.map((r) => `
        <li>
          <span><strong>${r.tipo === 'F' ? t('ferie') : t('permesso')}</strong> ${dataIt(r.dal)}${r.al !== r.dal ? ` – ${dataIt(r.al)}` : ''}${r.ore ? ` · ${num(r.ore, 1)} ${t('ore')}` : ''}
            ${r.risposta ? `<br><small>${t('risposta')}: ${esc(r.risposta)}</small>` : ''}</span>
          <span class="azioni-file"><span class="pillola ${classi[r.stato]}">${stati[r.stato]}</span>
          ${r.stato === 'in attesa' ? `<button type="button" class="link ko" data-ritira="${r.id}">${t('ritira')}</button>` : ''}</span>
        </li>`).join('')}</ul>` : `<p class="nota">${t('nessunaRichiesta')}</p>`}
    </section>`;

  const f = root.querySelector('.form-richiesta');
  const campoOre = root.querySelector('.campo-ore-perm');
  const sync = () => { campoOre.hidden = !(f.tipo.value === 'P' && f.dal.value && f.dal.value === f.al.value); };
  f.addEventListener('change', (e) => {
    if (e.target.name === 'dal' && (!f.al.value || f.al.value < f.dal.value)) f.al.value = f.dal.value;
    sync();
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.dal.value || !f.al.value || f.al.value < f.dal.value) return;
    try {
      await creaRichiesta(app.rapporto.id, {
        tipo: f.tipo.value, dal: f.dal.value, al: f.al.value,
        ore: !campoOre.hidden && f.ore.value ? Number(f.ore.value) : null,
        nota: f.nota.value.trim() || null,
      });
      app.richieste = await caricaRichieste(app.rapporto.id);
      toast(t('inviata'));
      mostraRichiesteLavoratrice(root);
    } catch (err) { toast(err.message, 'ko'); }
  });
  root.querySelectorAll('[data-ritira]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await ritiraRichiesta(b.dataset.ritira);
      app.richieste = await caricaRichieste(app.rapporto.id);
      mostraRichiesteLavoratrice(root);
    } catch (err) { toast(err.message, 'ko'); }
  }));
}

// ---------- Documenti condivisi ----------
export function mostraDocumentiLavoratrice(root) {
  root.innerHTML = `
    <h1 class="titolo-pagina">${t('docCondivisi')}</h1>
    <section class="card">
      ${app.documenti.length ? `<ul class="lista-file">${app.documenti.map((d) => `
        <li><button type="button" class="link apri" data-id="${d.id}">${esc(d.nome)}</button><small>${dataIt(d.created_at)}</small></li>`).join('')}</ul>`
        : `<p class="nota">${t('nessunDocumento')}</p>`}
    </section>`;
  root.querySelectorAll('.apri').forEach((b) => b.addEventListener('click', () => apriFile(app.documenti.find((d) => d.id === b.dataset.id))));
}

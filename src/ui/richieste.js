// Richieste di ferie e permessi: approvazione da parte di titolare/gestore e
// inserimento automatico nelle presenze dei mesi interessati.
import { app, puoModificare, esc, dataIt, toast } from '../stato.js';
import { decidiRichiesta, salvaCedolino, caricaRichieste } from '../lib/dati.js';
import { calcolaCatena } from '../engine/catena.js';
import { calendarioMese } from '../engine/calcolo.js';

const giorniTra = (dal, al) => {
  const out = [];
  for (let d = new Date(dal + 'T00:00:00Z'); d <= new Date(al + 'T00:00:00Z'); d = new Date(d.getTime() + 86400000)) out.push(d.toISOString().slice(0, 10));
  return out;
};

/** Inserisce la richiesta approvata nelle presenze. Restituisce i mesi non modificabili (già confermati). */
export async function applicaRichiesta(r) {
  const d = app.rapporto.dati;
  const perMese = new Map();
  for (const data of giorniTra(r.dal, r.al)) {
    const k = data.slice(0, 7);
    if (!perMese.has(k)) perMese.set(k, []);
    perMese.get(k).push(data);
  }
  const bloccati = [];
  for (const [k, date] of perMese) {
    const [anno, mese] = k.split('-').map(Number);
    const esistente = app.cedolini.find((c) => c.anno === anno && c.mese === mese);
    if (esistente && esistente.stato !== 'bozza') { bloccati.push(k); continue; }
    const giorni = structuredClone(esistente?.presenze?.giorni ?? {});
    const cal = calendarioMese(d, anno, mese);
    for (const data of date) {
      const g = cal.find((x) => x.data === data);
      if (!g || !g.attivo || g.festivita || g.oreProgrammate <= 0) continue;
      giorni[data] = r.tipo === 'F'
        ? { tipo: 'F', nota: 'Ferie approvate' }
        : { tipo: 'P', ore: r.ore && date.length === 1 ? Math.min(Number(r.ore), g.oreProgrammate) : g.oreProgrammate, nota: 'Permesso approvato' };
    }
    const presenze = { giorni, extra: esistente?.presenze?.extra ?? {} };
    const altri = app.cedolini.filter((c) => !(c.anno === anno && c.mese === mese));
    const cat = calcolaCatena(d, [...altri, { anno, mese, stato: 'bozza', presenze }], { anno, mese });
    const riga = await salvaCedolino(app.rapporto.id, { anno, mese, presenze, risultato: cat[cat.length - 1].risultato, stato: 'bozza' });
    app.cedolini = [...altri, riga].sort((a, b) => a.anno - b.anno || a.mese - b.mese);
  }
  return bloccati;
}

const descr = (r) => `${r.tipo === 'F' ? 'Ferie' : 'Permesso'} ${r.dal === r.al ? `il ${dataIt(r.dal)}` : `dal ${dataIt(r.dal)} al ${dataIt(r.al)}`}${r.ore ? ` (${String(r.ore).replace('.', ',')} ore)` : ''}`;

/** Riquadro con le richieste in attesa e le ultime decise. */
export function cardRichieste(box, alCambio) {
  const inAttesa = app.richieste.filter((r) => r.stato === 'in attesa');
  const recenti = app.richieste.filter((r) => r.stato !== 'in attesa').slice(0, 5);
  if (!inAttesa.length && !recenti.length) { box.hidden = true; return; }
  box.hidden = false;
  const mod = puoModificare();
  box.innerHTML = `
    <h2>Richieste di ferie e permessi</h2>
    ${inAttesa.length ? `<ul class="lista-richieste">${inAttesa.map((r) => `
      <li>
        <span><strong>${esc(descr(r))}</strong><br><small>da ${esc(r.richiesta_da)}${r.nota ? ` · “${esc(r.nota)}”` : ''}</small></span>
        ${mod ? `<span class="azioni-file">
          <button type="button" class="primario piccolo" data-ok="${r.id}">Approva</button>
          <button type="button" class="secondario" data-no="${r.id}">Rifiuta</button></span>` : '<span class="pillola bozza">In attesa</span>'}
      </li>`).join('')}</ul>` : '<p class="nota">Nessuna richiesta in attesa.</p>'}
    ${recenti.length ? `<details><summary class="nota">Ultime decise</summary><ul class="lista-richieste">${recenti.map((r) => `
      <li><span>${esc(descr(r))}<br><small>${r.stato === 'approvata' ? '✓ approvata' : '✗ rifiutata'} da ${esc(r.deciso_da || '')}${r.risposta ? ` · ${esc(r.risposta)}` : ''}</small></span></li>`).join('')}</ul></details>` : ''}`;

  box.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', async () => {
    const r = app.richieste.find((x) => x.id === b.dataset.ok);
    b.disabled = true;
    try {
      const bloccati = await applicaRichiesta(r);
      await decidiRichiesta(r.id, 'approvata', bloccati.length ? 'Alcuni giorni ricadono in mesi già confermati: da inserire a mano' : null, app.user.email);
      app.richieste = await caricaRichieste(app.rapporto.id);
      toast(bloccati.length ? `Approvata. Mesi già confermati da aggiornare a mano: ${bloccati.join(', ')}` : 'Approvata e inserita nelle presenze', bloccati.length ? 'ko' : 'ok');
      alCambio();
    } catch (e) { b.disabled = false; toast(`Errore: ${e.message}`, 'ko'); }
  }));
  box.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', async () => {
    const motivo = prompt('Motivo del rifiuto (facoltativo, lo vedrà la lavoratrice):', '');
    if (motivo === null) return;
    try {
      await decidiRichiesta(b.dataset.no, 'rifiutata', motivo.trim(), app.user.email);
      app.richieste = await caricaRichieste(app.rapporto.id);
      toast('Richiesta rifiutata');
      alCambio();
    } catch (e) { toast(`Errore: ${e.message}`, 'ko'); }
  }));
}

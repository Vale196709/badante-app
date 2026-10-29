// Approvazione delle ore segnate dalla lavoratrice: diventano le presenze del mese (in bozza).
import { app, puoModificare, esc, dataIt, num, toast, nomeMeseMaiusc } from '../stato.js';
import { decidiOre, salvaCedolino, caricaOreSegnate } from '../lib/dati.js';
import { calcolaCatena } from '../engine/catena.js';
import { calendarioMese } from '../engine/calcolo.js';
import { condizioniMese } from '../engine/variazioni.js';

/** Scrive le ore approvate nelle presenze. Restituisce le date applicate e i mesi già chiusi. */
export async function applicaOre(righe) {
  const d = app.rapporto.dati;
  const perMese = new Map();
  for (const r of righe) {
    const k = r.data.slice(0, 7);
    if (!perMese.has(k)) perMese.set(k, []);
    perMese.get(k).push(r);
  }
  const applicate = [];
  const bloccati = [];
  for (const [k, lista] of [...perMese].sort()) {
    const [anno, mese] = k.split('-').map(Number);
    const esistente = app.cedolini.find((c) => c.anno === anno && c.mese === mese);
    if (esistente && esistente.stato !== 'bozza') { bloccati.push(k); continue; }
    const giorni = structuredClone(esistente?.presenze?.giorni ?? {});
    const cal = calendarioMese(condizioniMese(d, anno, mese), anno, mese);
    for (const r of lista) {
      const g = cal.find((x) => x.data === r.data);
      if (!g?.attivo) continue;
      const ore = Number(r.ore) || 0;
      const attuale = giorni[r.data];
      // non sovrascrive ferie, malattia o permessi già inseriti
      if (attuale && ['F', 'M', 'P'].includes(attuale.tipo)) continue;
      giorni[r.data] = ore > 0
        ? { tipo: 'L', ore, ...(Number(r.extra) > 0 ? { extra: Number(r.extra), extraTipo: r.extra_tipo } : {}), nota: 'Ore segnate dalla lavoratrice' }
        : { tipo: g.oreProgrammate > 0 && !g.festivita ? 'A' : '', ore: 0, nota: 'Segnato 0 ore dalla lavoratrice' };
      applicate.push(r.data);
    }
    const presenze = { giorni, extra: esistente?.presenze?.extra ?? {} };
    const altri = app.cedolini.filter((c) => !(c.anno === anno && c.mese === mese));
    const cat = calcolaCatena(d, [...altri, { anno, mese, stato: 'bozza', presenze }], { anno, mese });
    const riga = await salvaCedolino(app.rapporto.id, { anno, mese, presenze, risultato: cat[cat.length - 1].risultato, stato: 'bozza' });
    app.cedolini = [...altri, riga].sort((a, b) => a.anno - b.anno || a.mese - b.mese);
  }
  return { applicate, bloccati };
}

/** Riquadro con le ore segnate in attesa di approvazione. */
export function cardOre(box, alCambio) {
  const attesa = app.ore.filter((o) => o.stato === 'in attesa').sort((a, b) => a.data.localeCompare(b.data));
  if (!attesa.length) { box.hidden = true; return; }
  box.hidden = false;
  const d = app.rapporto.dati;
  const previste = (data) => {
    const [a, m] = data.split('-').map(Number);
    const g = calendarioMese(condizioniMese(d, a, m), a, m).find((x) => x.data === data);
    return g && !g.festivita ? g.oreProgrammate : 0;
  };
  const mod = puoModificare();
  const chi = attesa[0].segnato_da;
  box.innerHTML = `
    <h2>Ore segnate da ${esc(d.lavoratrice?.nome || chi)}</h2>
    <p class="nota" style="margin:-4px 0 10px">${attesa.length} ${attesa.length === 1 ? 'giorno' : 'giorni'} da approvare. Approvando, le ore vanno nelle presenze del mese (il cedolino resta in bozza).</p>
    <ul class="lista-richieste">${attesa.map((o) => {
      const p = previste(o.data);
      const diff = Number(o.ore) - p;
      return `<li><span><strong>${dataIt(o.data)}</strong> · ${num(Number(o.ore), 1)} h
        ${Math.abs(diff) >= 0.01 ? `<small class="${diff > 0 ? 'ko' : ''}">(${diff > 0 ? '+' : '−'}${num(Math.abs(diff), 1)} rispetto alle ${num(p, 1)} previste)</small>` : '<small>come previsto</small>'}
        ${o.nota ? `<br><small>“${esc(o.nota)}”</small>` : ''}</span>
        ${mod ? `<button type="button" class="link ko" data-rifiuta="${o.data}">Rifiuta</button>` : ''}</li>`;
    }).join('')}</ul>
    ${mod ? '<div class="azioni-mese"><button type="button" class="primario approva-ore">Approva tutte</button></div>' : ''}`;

  const ricarica = async () => { app.ore = await caricaOreSegnate(app.rapporto.id); alCambio(); };
  box.querySelector('.approva-ore')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      const { applicate, bloccati } = await applicaOre(attesa);
      if (applicate.length) await decidiOre(app.rapporto.id, applicate, 'approvata', app.user.email);
      toast(bloccati.length
        ? `Approvate ${applicate.length}. ${bloccati.map((k) => nomeMeseMaiusc(Number(k.slice(5)))).join(', ')}: cedolino già confermato, riaprilo per inserire le ore`
        : `Approvate: ${applicate.length} ${applicate.length === 1 ? 'giorno' : 'giorni'} inseriti nelle presenze`, bloccati.length ? 'ko' : undefined);
      await ricarica();
    } catch (err) { toast(`Errore: ${err.message}`, 'ko'); e.currentTarget.disabled = false; }
  });
  box.querySelectorAll('[data-rifiuta]').forEach((b) => b.addEventListener('click', async () => {
    try { await decidiOre(app.rapporto.id, [b.dataset.rifiuta], 'rifiutata', app.user.email); toast('Ore rifiutate: la lavoratrice può correggerle'); await ricarica(); }
    catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  }));
}

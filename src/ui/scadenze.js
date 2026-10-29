// Scadenziario con spunta "fatto" ed esportazione nel calendario (.ics).
import { app, catenaCorrente, puoModificare, eur, esc, dataIt, oggiIso, toast } from '../stato.js';
import { apriLetturaRicevuta } from './ricevuta.js';
import { generaScadenze } from '../engine/scadenze.js';
import { segnaScadenza, salvaVersamento, eliminaVersamento, caricaVersamenti } from '../lib/dati.js';

function ics(scadenze) {
  const riga = (s) => {
    const giorno = s.data.replace(/-/g, '');
    const fine = new Date(new Date(s.data + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const testo = (t) => String(t).replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    return [
      'BEGIN:VEVENT',
      `UID:badante-${s.chiave}@vale196709.github.io`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${giorno}`,
      `DTEND;VALUE=DATE:${fine}`,
      `SUMMARY:${testo(s.titolo + (s.importo != null ? ` (${eur(s.importo)})` : ''))}`,
      `DESCRIPTION:${testo(s.descrizione || '')}`,
      'BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', `DESCRIPTION:${testo(s.titolo)}`, 'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Badante//IT', 'CALSCALE:GREGORIAN', ...scadenze.map(riga), 'END:VCALENDAR'].join('\r\n');
}

/** Link "aggiungi evento" di Google Calendar (giornata intera), senza collegare account. */
function linkGoogle(s) {
  const giorno = s.data.replace(/-/g, '');
  const dopo = new Date(new Date(s.data + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const dettagli = [s.descrizione, s.importo != null ? `Importo: ${eur(s.importo)}` : '', 'Da Badante di Maria'].filter(Boolean).join('\n');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: s.titolo, dates: `${giorno}/${dopo}`, details: dettagli });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function mostraScadenze(root, { vai }) {
  const d = app.rapporto?.dati;
  if (!d) { vai('impostazioni'); return; }
  const oggi = oggiIso();
  const catena = catenaCorrente();
  const tutte = generaScadenze(d, catena, oggi, app.fatte);
  const mod = puoModificare();
  let mostraFatte = false;

  const disegna = () => {
    const aperte = tutte.filter((s) => !s.fatta);
    const scadute = aperte.filter((s) => s.data < oggi);
    const prossime = aperte.filter((s) => s.data >= oggi);
    const fatte = tutte.filter((s) => s.fatta).reverse();
    const item = (s) => `
      <li class="${s.fatta ? 'fatta' : s.data < oggi ? 'scaduta' : ''}">
        <label class="spunta-scad">
          <input type="checkbox" data-k="${esc(s.chiave)}" ${s.fatta ? 'checked' : ''} ${mod && !s.completataDa ? '' : 'disabled'} />
          <span class="data">${dataIt(s.data)}</span>
          <span class="corpo"><span class="cat">${esc(s.categoria)}</span><strong>${esc(s.titolo)}</strong>${s.importo != null ? ` · ${eur(s.importo)}` : ''}<br><small>${esc(s.descrizione || '')}</small></span>
        </label>
        ${!s.fatta && s.data >= oggi ? `<a class="link-gcal" href="${linkGoogle(s)}" target="_blank" rel="noopener">+ Google Calendar</a>` : ''}
        ${s.chiave.startsWith('inps-') ? bloccoVersamento(s) : ''}
      </li>`;
    const bloccoVersamento = (s) => {
      const [, a, tq] = s.chiave.match(/^inps-(\d{4})-T(\d)$/) || [];
      const v = app.versamenti.find((x) => x.anno === Number(a) && x.trimestre === Number(tq));
      if (v) {
        const diff = Number(v.importo) - s.importo;
        return `<div class="versamento">✓ Pagati ${eur(v.importo)} il ${dataIt(v.data_pagamento)}${Math.abs(diff) >= 0.01 ? ` <span class="${diff < 0 ? 'ko' : ''}">(${diff > 0 ? '+' : '−'}${eur(Math.abs(diff))} rispetto al calcolo)</span>` : ''}
          ${mod ? `<button type="button" class="link ko" data-elimina-v="${a}-${tq}">Annulla</button>` : ''}</div>`;
      }
      if (!mod) return '';
      return `<form class="versamento form-v" data-v="${a}-${tq}">
        <label>Pagato il<input type="date" name="data" value="${oggi}" /></label>
        <label>Importo €<input name="importo" inputmode="decimal" value="${String(s.importo.toFixed(2)).replace('.', ',')}" /></label>
        <button type="submit" class="secondario">Registra pagamento</button>
      </form>`;
    };
    root.innerHTML = `
      <div class="card-testa"><h1 class="titolo-pagina">Scadenze</h1>
        <div class="azioni-testa">${mod ? '<button type="button" class="secondario leggi-ricevuta">Leggi una ricevuta</button>' : ''}
        <button type="button" class="secondario esporta">Aggiungi al calendario</button></div></div>
      ${scadute.length ? `<section class="card"><h2>Da recuperare</h2><ul class="lista-scad">${scadute.map(item).join('')}</ul></section>` : ''}
      <section class="card"><h2>Prossime</h2><ul class="lista-scad">${prossime.map(item).join('') || '<li>Nessuna.</li>'}</ul></section>
      <section class="card"><button type="button" class="link toggle-fatte">${mostraFatte ? 'Nascondi' : 'Mostra'} completate (${fatte.length})</button>
        ${mostraFatte ? `<ul class="lista-scad">${fatte.map(item).join('')}</ul>` : ''}</section>
      <p class="nota">Lo stipendio risulta completato quando il cedolino del mese è segnato come pagato.</p>`;

    root.querySelector('.leggi-ricevuta')?.addEventListener('click', () => {
      const trimestri = tutte.filter((x) => /^inps-\d{4}-T\d$/.test(x.chiave)).map((x) => {
        const [, a, q] = x.chiave.match(/^inps-(\d{4})-T(\d)$/);
        return { anno: Number(a), trimestre: Number(q), importo: x.importo, data: x.data, fatta: x.fatta };
      }).sort((a, b) => (a.fatta - b.fatta) || a.data.localeCompare(b.data));
      apriLetturaRicevuta(trimestri, () => {
        for (const v of app.versamenti) { const t = tutte.find((x) => x.chiave === `inps-${v.anno}-T${v.trimestre}`); if (t) t.fatta = true; }
        disegna();
      });
    });
    root.querySelector('.toggle-fatte').addEventListener('click', () => { mostraFatte = !mostraFatte; disegna(); });
    root.querySelector('.esporta').addEventListener('click', () => {
      const blob = new Blob([ics(tutte.filter((s) => !s.fatta && s.data >= oggi))], { type: 'text/calendar' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'scadenze-badante.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('File calendario scaricato: aprilo per aggiungere gli eventi');
    });
    const aggiornaVersamenti = async () => { app.versamenti = await caricaVersamenti(app.rapporto.id); };
    root.querySelectorAll('.form-v').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const [a, tq] = f.dataset.v.split('-').map(Number);
      const importo = Number(f.importo.value.replace(/\./g, '').replace(',', '.'));
      if (!(importo >= 0) || !f.data.value) { toast('Inserisci data e importo', 'ko'); return; }
      try {
        await salvaVersamento(app.rapporto.id, { anno: a, trimestre: tq, data_pagamento: f.data.value, importo });
        await segnaScadenza(app.rapporto.id, `inps-${a}-T${tq}`, true);
        app.fatte.add(`inps-${a}-T${tq}`);
        tutte.find((x) => x.chiave === `inps-${a}-T${tq}`).fatta = true;
        await aggiornaVersamenti();
        toast('Pagamento registrato');
        disegna();
      } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
    }));
    root.querySelectorAll('[data-elimina-v]').forEach((b) => b.addEventListener('click', async () => {
      const [a, tq] = b.dataset.eliminaV.split('-').map(Number);
      try {
        await eliminaVersamento(app.rapporto.id, a, tq);
        await aggiornaVersamenti();
        disegna();
      } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
    }));
    root.querySelectorAll('input[data-k]').forEach((c) => c.addEventListener('change', async () => {
      const s = tutte.find((x) => x.chiave === c.dataset.k);
      try {
        await segnaScadenza(app.rapporto.id, s.chiave, c.checked);
        s.fatta = c.checked;
        if (c.checked) app.fatte.add(s.chiave); else app.fatte.delete(s.chiave);
        disegna();
      } catch (e) {
        c.checked = !c.checked;
        toast(`Errore: ${e.message}`, 'ko');
      }
    }));
  };
  disegna();
}

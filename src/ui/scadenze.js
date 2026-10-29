// Scadenziario con spunta "fatto" ed esportazione nel calendario (.ics).
import { app, catenaCorrente, puoModificare, eur, esc, dataIt, oggiIso, toast } from '../stato.js';
import { generaScadenze } from '../engine/scadenze.js';
import { segnaScadenza } from '../lib/dati.js';

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

export function mostraScadenze(root, { vai }) {
  const d = app.rapporto?.dati;
  if (!d) { vai('rapporto'); return; }
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
      </li>`;
    root.innerHTML = `
      <div class="card-testa"><h1 class="titolo-pagina">Scadenze</h1>
        <button type="button" class="secondario esporta">Aggiungi al calendario</button></div>
      ${scadute.length ? `<section class="card"><h2>Da recuperare</h2><ul class="lista-scad">${scadute.map(item).join('')}</ul></section>` : ''}
      <section class="card"><h2>Prossime</h2><ul class="lista-scad">${prossime.map(item).join('') || '<li>Nessuna.</li>'}</ul></section>
      <section class="card"><button type="button" class="link toggle-fatte">${mostraFatte ? 'Nascondi' : 'Mostra'} completate (${fatte.length})</button>
        ${mostraFatte ? `<ul class="lista-scad">${fatte.map(item).join('')}</ul>` : ''}</section>
      <p class="nota">Lo stipendio risulta completato quando il cedolino del mese è segnato come pagato.</p>`;

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

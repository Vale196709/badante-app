// Variazioni di paga, orario e livello con decorrenza dal primo del mese.
import { app, puoModificare, eur, esc, oggiIso, toast, nomeMeseMaiusc } from '../stato.js';
import { salvaRapporto } from '../lib/dati.js';
import { variazioniOrdinate, condizioniAl } from '../engine/variazioni.js';
import { oreSettimanali } from '../engine/calcolo.js';

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const LIVELLI = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
const meseDi = (iso) => `${nomeMeseMaiusc(Number(iso.slice(5, 7)))} ${iso.slice(0, 4)}`;
const descrOrario = (o) => `${oreSettimanali(o)} h/sett. (${Object.entries(o).map(([g, h]) => `${GIORNI[g - 1]} ${String(h).replace('.', ',')}`).join(', ')})`;

export function mostraVariazioni(root, ctx) {
  const d = app.rapporto.dati;
  const mod = puoModificare();
  const lista = variazioniOrdinate(d);
  const attuali = condizioniAl(d, oggiIso());
  const prossimoMese = (() => { const x = new Date(); x.setMonth(x.getMonth() + 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; })();

  root.innerHTML = `
    <section class="card">
      <h2>Condizioni in vigore oggi</h2>
      <div class="cifre">
        <div><span class="etichetta">Paga oraria</span><span class="valore">${eur(attuali.pagaOraria)}</span></div>
        <div><span class="etichetta">Orario</span><span class="valore">${oreSettimanali(attuali.orario)} h</span><span class="sotto">a settimana</span></div>
        <div><span class="etichetta">Livello</span><span class="valore">${esc(attuali.livello)}</span></div>
      </div>
      <p class="nota">All'assunzione: ${eur(d.pagaOraria)}/h, ${descrOrario(d.orario)}, livello ${esc(d.livello)}. Le condizioni iniziali si correggono nella scheda Rapporto.</p>
    </section>
    <section class="card">
      <h2>Variazioni</h2>
      ${lista.length ? `<ul class="lista-richieste">${lista.map((v, i) => `
        <li><span><strong>Da ${meseDi(v.dal)}</strong><br><small>${[
          v.pagaOraria != null ? `paga ${eur(v.pagaOraria)}/h` : '',
          v.orario ? descrOrario(v.orario) : '',
          v.livello ? `livello ${esc(v.livello)}` : '',
        ].filter(Boolean).join(' · ')}${v.nota ? ` · ${esc(v.nota)}` : ''}</small></span>
        ${mod ? `<button type="button" class="link ko" data-elimina="${i}">Elimina</button>` : ''}</li>`).join('')}</ul>`
        : '<p class="nota">Nessuna variazione: valgono le condizioni dell\'assunzione.</p>'}
    </section>
    ${mod ? `<section class="card">
      <h2>Nuova variazione</h2>
      <form class="form-variazione">
        <label>Dal mese<input type="month" name="dal" value="${prossimoMese}" required /></label>
        <div class="riga">
          <label>Nuova paga oraria (€)<input name="paga" inputmode="decimal" placeholder="${String(attuali.pagaOraria).replace('.', ',')}" /></label>
          <label>Livello<select name="livello"><option value="">invariato</option>${LIVELLI.map((l) => `<option>${l}</option>`).join('')}</select></label>
        </div>
        <label class="spunta"><input type="checkbox" name="cambiaOrario" /> Cambia anche l'orario</label>
        <fieldset class="nuovo-orario" hidden>
          <legend>Ore per giorno</legend>
          <div class="giorni">${GIORNI.map((g, i) => `<label class="giorno">${g}<input name="g${i + 1}" type="number" min="0" max="12" step="0.5" inputmode="decimal" value="${attuali.orario[i + 1] ?? 0}" /></label>`).join('')}</div>
        </fieldset>
        <label>Nota<input name="nota" placeholder="es. aumento concordato" /></label>
        <button type="submit" class="primario">Aggiungi variazione</button>
        <p class="nota">Vale dal primo giorno del mese scelto. I cedolini già confermati non cambiano. Ricordati di comunicarla all'INPS: la scadenza compare in Scadenze.</p>
      </form>
    </section>` : ''}`;

  const salva = async (variazioni) => {
    const nuovi = { ...d, variazioni };
    const r = await salvaRapporto(app.rapporto.id, nuovi);
    app.rapporto = { ...app.rapporto, ...r, dati: nuovi };
    const i = app.rapporti.findIndex((x) => x.id === app.rapporto.id);
    if (i >= 0) app.rapporti[i] = app.rapporto;
  };
  root.querySelectorAll('[data-elimina]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Eliminare questa variazione? I mesi in bozza tornano alle condizioni precedenti.')) return;
    const v = [...lista]; v.splice(Number(b.dataset.elimina), 1);
    try { await salva(v); toast('Variazione eliminata'); mostraVariazioni(root, ctx); } catch (e) { toast(`Errore: ${e.message}`, 'ko'); }
  }));
  const f = root.querySelector('.form-variazione');
  if (!f) return;
  f.cambiaOrario.addEventListener('change', () => { root.querySelector('.nuovo-orario').hidden = !f.cambiaOrario.checked; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dal = `${f.dal.value}-01`;
    const paga = f.paga.value.trim() ? Number(f.paga.value.replace(',', '.')) : null;
    const v = { dal };
    if (paga != null && paga > 0) v.pagaOraria = paga;
    if (f.livello.value) v.livello = f.livello.value;
    if (f.cambiaOrario.checked) {
      v.orario = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((g) => [g, Number(f[`g${g}`].value) || 0]).filter(([, h]) => h > 0));
      if (!oreSettimanali(v.orario)) { toast('Inserisci almeno un giorno con ore', 'ko'); return; }
    }
    if (f.nota.value.trim()) v.nota = f.nota.value.trim();
    if (Object.keys(v).length === 1 || (Object.keys(v).length === 2 && v.nota)) { toast('Indica cosa cambia: paga, livello o orario', 'ko'); return; }
    if (dal <= d.dataAssunzione) { toast('La variazione deve essere successiva all\'assunzione', 'ko'); return; }
    try {
      await salva([...lista.filter((x) => x.dal !== dal), v]);
      toast(`Variazione da ${meseDi(dal)} salvata`);
      mostraVariazioni(root, ctx);
    } catch (err) { toast(`Errore: ${err.message}`, 'ko'); }
  });
}


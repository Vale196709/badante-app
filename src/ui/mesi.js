// Presenze giorno per giorno e cedolino del mese.
import { app, catenaCorrente, puoModificare, eur, num, esc, dataIt, oggiIso, nomeMeseMaiusc, toast } from '../stato.js';
import { calcolaCatena, chiaveMese } from '../engine/catena.js';
import { giorniMese, TIPI } from '../engine/presenze.js';
import { nomeFestivita } from '../engine/tabelle.js';
import { condizioniMese } from '../engine/variazioni.js';
import { salvaCedolino } from '../lib/dati.js';
import { stampaCedolino } from './stampe.js';
import { cardRichieste } from './richieste.js';
import { apriBonifico } from './bonifico.js';
import { cardOre } from './oreApprova.js';

const STATI = { 'da fare': 'Da preparare', bozza: 'Bozza', confermato: 'Confermato', pagato: 'Pagato' };
const GSETT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const SIGLE = { L: '', F: 'Ferie', M: 'Malattia', P: 'Permesso', A: 'Assente', '': '' };

export function mostraMesi(root, ctx) {
  const d = app.rapporto?.dati;
  if (!d) { ctx.vai('impostazioni'); return; }
  const catena = catenaCorrente();
  // aggiunge il mese successivo per poter preparare in anticipo
  const ultimo = catena[catena.length - 1];
  if (ultimo && !d.dataCessazione) {
    const a = ultimo.mese === 12 ? ultimo.anno + 1 : ultimo.anno;
    const m = ultimo.mese === 12 ? 1 : ultimo.mese + 1;
    const ext = calcolaCatena(d, app.cedolini, { anno: a, mese: m });
    if (ext.length > catena.length) catena.push(ext[ext.length - 1]);
  }
  if (!catena.length) {
    root.innerHTML = `<div class="avviso info">Il rapporto inizia il ${dataIt(d.dataAssunzione)}.</div>`;
    return;
  }
  const oggiMese = oggiIso().slice(0, 7);

  root.innerHTML = `
    <div class="card-testa"><h1 class="titolo-pagina">Presenze e cedolini</h1>
      <button type="button" class="secondario vai-ferie">Ferie dell'anno</button></div>
    <section class="card ore-box" hidden></section>
    <section class="card richieste-box" hidden></section>
    <ul class="lista-mesi">
      ${[...catena].reverse().map((m) => `
        <li><button type="button" data-k="${chiaveMese(m.anno, m.mese)}" class="${chiaveMese(m.anno, m.mese) === oggiMese ? 'corrente' : ''}">
          <span class="mese">${nomeMeseMaiusc(m.mese)} ${m.anno}</span>
          <span class="pillola ${m.stato.replace(' ', '-')}">${STATI[m.stato]}</span>
          <span class="netto">${eur(m.risultato.netto)}</span>
          <span class="firma">${m.salvato?.ricevuta_at ? '✍︎ firmato' : ''}</span>
        </button></li>`).join('')}
    </ul>`;
  cardRichieste(root.querySelector('.richieste-box'), () => mostraMesi(root, ctx));
  cardOre(root.querySelector('.ore-box'), () => mostraMesi(root, ctx));
  root.querySelector('.vai-ferie').addEventListener('click', () => ctx.vai('ferie'));
  root.querySelectorAll('.lista-mesi button').forEach((b) =>
    b.addEventListener('click', () => {
      const [a, m] = b.dataset.k.split('-').map(Number);
      editorMese(root, ctx, a, m);
    })
  );
}

function editorMese(root, ctx, anno, mese) {
  const d = app.rapporto.dati;
  const dm = condizioniMese(d, anno, mese); // orario e paga in vigore nel mese
  const salvato = app.cedolini.find((c) => c.anno === anno && c.mese === mese) || null;
  const giorniSalvati = structuredClone(salvato?.presenze?.giorni ?? {});
  const extra = structuredClone(salvato?.presenze?.extra ?? {});
  let stato = salvato?.stato ?? 'da fare';
  const modificabile = () => puoModificare() && (stato === 'bozza' || stato === 'da fare');

  const calcola = () => {
    const altri = app.cedolini.filter((c) => !(c.anno === anno && c.mese === mese));
    const questo = { anno, mese, stato: modificabile() ? 'bozza' : stato, presenze: { giorni: giorniSalvati, extra }, risultato: salvato?.risultato };
    const cat = calcolaCatena(d, [...altri, questo], { anno, mese });
    return cat[cat.length - 1];
  };

  root.innerHTML = `
    <div class="testa-editor">
      <button type="button" class="link indietro">‹ Tutti i mesi</button>
      <h1 class="titolo-pagina">${nomeMeseMaiusc(mese)} ${anno}</h1>
    </div>
    <div class="stato-editor"></div>
    <section class="card">
      <div class="card-testa"><h2>Presenze</h2><span class="nota suggerimento-tocco"></span></div>
      <div class="calendario" role="grid"></div>
      <div class="legenda">
        <span><i class="t-L"></i>Lavorato</span><span><i class="t-F"></i>Ferie</span><span><i class="t-M"></i>Malattia</span>
        <span><i class="t-P"></i>Permesso</span><span><i class="t-A"></i>Assente</span><span><i class="t-fest"></i>Festività</span>
      </div>
      <div class="riga strumenti-presenze"></div>
    </section>
    <section class="card anteprima"></section>
    <div class="azioni-mese"></div>
    <dialog class="dlg-giorno"></dialog>`;

  root.querySelector('.indietro').addEventListener('click', () => mostraMesi(root, ctx));
  const cal = root.querySelector('.calendario');
  const ant = root.querySelector('.anteprima');
  const az = root.querySelector('.azioni-mese');
  const dlg = root.querySelector('.dlg-giorno');
  const strumenti = root.querySelector('.strumenti-presenze');
  const st = root.querySelector('.stato-editor');

  function disegna() {
    const giorni = giorniMese(dm, anno, mese, giorniSalvati);
    const vuoti = giorni[0].giornoSettimana - 1;
    const mod = modificabile();
    root.querySelector('.suggerimento-tocco').textContent = mod ? 'Tocca un giorno per modificarlo' : '';
    cal.innerHTML = GSETT.map((g) => `<div class="gs">${g}</div>`).join('') +
      '<div class="vuoto-cella"></div>'.repeat(vuoti) +
      giorni.map((g) => {
        const n = Number(g.data.slice(8));
        const ore = g.tipo === 'L' || g.tipo === 'P' ? Number(g.ore) || 0 : 0;
        const cambiato = !!giorniSalvati[g.data];
        return `<button type="button" class="cella t-${g.tipo || 'R'} ${g.festivita ? 'fest' : ''} ${g.attivo ? '' : 'fuori'} ${cambiato ? 'cambiato' : ''}"
          data-d="${g.data}" ${mod && g.attivo ? '' : 'disabled'} title="${g.festivita ? esc(nomeFestivita(g.data)) : ''}">
          <span class="n">${n}</span>
          <span class="info">${g.tipo === 'L' || (g.tipo === 'P' && ore) ? `${num(ore, ore % 1 ? 1 : 0)}h` : SIGLE[g.tipo]}${Number(g.extra) ? `<b>+${g.extra}</b>` : ''}</span>
        </button>`;
      }).join('');
    cal.querySelectorAll('.cella:not([disabled])').forEach((c) => c.addEventListener('click', () => apriGiorno(c.dataset.d)));

    strumenti.innerHTML = mod
      ? `<label>Anticipo TFR in questo mese (€)<input type="number" min="0" step="0.01" name="anticipoTfr" value="${extra.anticipoTfr || ''}" placeholder="0" /></label>
         <button type="button" class="secondario ripristina">Riporta tutto all'orario programmato</button>`
      : (extra.anticipoTfr ? `<p class="nota">Anticipo TFR: ${eur(extra.anticipoTfr)}</p>` : '');
    if (mod) {
      strumenti.querySelector('[name=anticipoTfr]').addEventListener('change', (e) => { extra.anticipoTfr = Number(e.target.value) || 0; disegna(); });
      strumenti.querySelector('.ripristina').addEventListener('click', () => { for (const k of Object.keys(giorniSalvati)) delete giorniSalvati[k]; disegna(); });
    }
    anteprima();
    pulsanti();
  }

  function anteprima() {
    const m = calcola();
    const r = m.risultato;
    ant.innerHTML = `
      <div class="card-testa"><h2>Cedolino</h2>${r.lordo ? '' : ''}</div>
      ${(r.avvisi || []).map((a) => `<div class="avviso attenzione">${esc(a)}</div>`).join('')}
      <table class="tab-cedolino">
        <thead><tr><th>Voce</th><th class="num">Q.tà</th><th class="num">Tariffa</th><th class="num">Importo</th></tr></thead>
        <tbody>
          ${r.voci.map((v) => `<tr><td>${esc(v.descrizione)}</td><td class="num">${v.quantita != null ? `${num(v.quantita)}${v.unita === 'gg' ? ' gg' : v.unita === 'mese' ? ' mese' : ''}` : ''}</td><td class="num">${v.tariffa != null ? num(v.tariffa) : ''}</td><td class="num">${num(v.importo)}</td></tr>`).join('')}
          <tr class="totale"><td colspan="3">Totale lordo</td><td class="num">${num(r.lordo)}</td></tr>
          ${r.trattenute.map((t) => `<tr class="meno"><td colspan="3">${esc(t.descrizione)}</td><td class="num">−${num(t.importo)}</td></tr>`).join('')}
          ${r.anticipoTfr ? `<tr><td colspan="3">Anticipo TFR</td><td class="num">${num(r.anticipoTfr)}</td></tr>` : ''}
          <tr class="netto"><td colspan="3">Netto da pagare</td><td class="num">${eur(r.netto)}</td></tr>
        </tbody>
      </table>
      <div class="cifre piccole">
        <div><span class="etichetta">Contributi da versare</span><span class="valore">${eur(r.contributi.daVersareAInps)}</span><span class="sotto">${num(r.contributi.oreContributive)} h · ${esc(r.contributi.fascia)}</span></div>
        <div><span class="etichetta">Costo per te</span><span class="valore">${eur(r.costoDatore)}</span></div>
        <div><span class="etichetta">Ferie residue</span><span class="valore">${num(r.contatori.ferieResidueOre, 1)} h</span></div>
        <div><span class="etichetta">TFR accantonato</span><span class="valore">${eur(r.contatori.tfrAccantonato)}</span></div>
      </div>`;
  }

  function pulsanti() {
    st.innerHTML = `<span class="pillola ${stato.replace(' ', '-')}">${STATI[stato]}</span>
      ${salvato?.pagato_at ? `<span class="nota">pagato il ${dataIt(salvato.pagato_at)}</span>` : ''}
      ${salvato?.ricevuta_at ? `<span class="nota">✍︎ ricevuta firmata da ${esc(salvato.ricevuta_da)} il ${dataIt(salvato.ricevuta_at)}</span>` : ''}`;
    const mod = puoModificare();
    const b = [];
    if (mod && (stato === 'bozza' || stato === 'da fare')) {
      b.push('<button type="button" class="secondario" data-a="bozza">Salva bozza</button>');
      b.push('<button type="button" class="primario" data-a="conferma">Conferma cedolino</button>');
    }
    if (mod && stato === 'confermato') {
      b.push(`<label class="inline">Pagato il <input type="date" name="dataPagamento" value="${oggiIso()}" /></label>`);
      b.push('<button type="button" class="primario" data-a="pagato">Segna come pagato</button>');
    }
    if (mod && (stato === 'confermato' || stato === 'pagato')) b.push('<button type="button" class="link" data-a="riapri">Riapri per modifiche</button>');
    if (stato === 'confermato' || stato === 'pagato') b.push('<button type="button" class="secondario" data-a="bonifico">Dati per il bonifico</button>');
    b.push('<button type="button" class="secondario" data-a="stampa">Stampa / PDF</button>');
    az.innerHTML = b.join('');
    az.querySelectorAll('[data-a]').forEach((x) => x.addEventListener('click', () => azione(x.dataset.a)));
  }

  async function salva(nuovoStato, pagato_at = null) {
    const m = calcola();
    const riga = await salvaCedolino(app.rapporto.id, {
      anno, mese, presenze: { giorni: giorniSalvati, extra }, risultato: m.risultato, stato: nuovoStato, pagato_at,
    });
    await ctx.ricaricaDati();
    return riga;
  }

  async function azione(a) {
    try {
      if (a === 'stampa') { stampaCedolino(calcola(), salvato); return; }
      if (a === 'bonifico') { apriBonifico({ anno, mese, importo: calcola().risultato.netto }); return; }
      if (a === 'bozza') { await salva('bozza'); toast('Bozza salvata'); }
      if (a === 'conferma') {
        if (!confirm('Confermando il cedolino i valori vengono fissati e la lavoratrice potrà vederlo. Procedere?')) return;
        await salva('confermato'); toast('Cedolino confermato');
      }
      if (a === 'pagato') { await salva('pagato', az.querySelector('[name=dataPagamento]').value || oggiIso()); toast('Segnato come pagato'); }
      if (a === 'riapri') {
        const successivi = app.cedolini.filter((c) => (c.anno > anno || (c.anno === anno && c.mese > mese)) && c.stato !== 'bozza');
        const msg = successivi.length
          ? `Ci sono ${successivi.length} cedolini successivi già confermati: se cambi questo mese, i loro contatori non si aggiornano finché non li riapri. Riaprire comunque?`
          : 'Il cedolino torna in bozza e i valori verranno ricalcolati. Riaprire?';
        if (!confirm(msg)) return;
        await salva('bozza'); toast('Cedolino riaperto');
      }
      editorMese(root, ctx, anno, mese);
    } catch (e) {
      toast(`Errore: ${e.message}`, 'ko');
    }
  }

  function apriGiorno(data) {
    const g = giorniMese(dm, anno, mese, giorniSalvati).find((x) => x.data === data);
    const [a, m, gg] = data.split('-');
    dlg.innerHTML = `
      <form method="dialog" class="form-giorno">
        <h3>${GSETT[g.giornoSettimana - 1]} ${Number(gg)}/${Number(m)}/${a}${g.festivita ? ` · <span class="fest-nome">${esc(nomeFestivita(data))}</span>` : ''}</h3>
        <p class="nota">Orario programmato: ${g.oreProgrammate} h${g.festivita ? ' · la festività è pagata comunque (1/6 dell\'orario settimanale)' : ''}</p>
        <div class="scelte">${Object.entries(TIPI).map(([k, v]) => `<label class="scelta"><input type="radio" name="tipo" value="${k}" ${g.tipo === k ? 'checked' : ''}/><span>${v}</span></label>`).join('')}</div>
        <div class="riga">
          <label class="campo-ore"><span class="et-ore">Ore lavorate</span><input type="number" name="ore" min="0" max="16" step="0.25" inputmode="decimal" value="${g.ore ?? g.oreProgrammate}" /></label>
          <label>Straordinario<input type="number" name="extra" min="0" max="12" step="0.25" inputmode="decimal" value="${g.extra || ''}" placeholder="0" /></label>
          <label>Tipo<select name="extraTipo"><option value="diurno">Diurno +25%</option><option value="notturno" ${g.extraTipo === 'notturno' ? 'selected' : ''}>Notturno +50%</option></select></label>
        </div>
        <p class="nota">Le ore oltre l'orario programmato sono pagate a tariffa normale; usa "Straordinario" per quelle da maggiorare. Domenica e festività lavorate sono maggiorate del 60% in automatico.</p>
        <label>Nota<input name="nota" value="${esc(g.nota || '')}" placeholder="facoltativa" /></label>
        <div class="riga fine">
          <button value="annulla" class="secondario">Annulla</button>
          <button value="ok" class="primario">Applica</button>
        </div>
      </form>`;
    const f = dlg.querySelector('form');
    const oreCampo = dlg.querySelector('.campo-ore');
    const sync = () => {
      oreCampo.hidden = !['L', 'P'].includes(f.tipo.value);
      dlg.querySelector('.et-ore').textContent = f.tipo.value === 'P' ? 'Ore di permesso' : 'Ore lavorate';
    };
    f.addEventListener('change', sync);
    sync();
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return;
      const rec = { tipo: f.tipo.value };
      if (['L', 'P'].includes(rec.tipo)) rec.ore = Number(f.ore.value) || 0;
      if (Number(f.extra.value)) { rec.extra = Number(f.extra.value); rec.extraTipo = f.extraTipo.value; }
      if (f.nota.value.trim()) rec.nota = f.nota.value.trim();
      const predef = rec.tipo === (g.oreProgrammate > 0 && !g.festivita ? 'L' : '') && (rec.ore ?? 0) === (rec.tipo === 'L' ? g.oreProgrammate : 0) && !rec.extra && !rec.nota;
      if (predef) delete giorniSalvati[data]; else giorniSalvati[data] = rec;
      disegna();
    };
    dlg.showModal();
  }

  disegna();
}

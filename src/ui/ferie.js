// Calendario annuale delle ferie: godute, approvate, richieste in attesa e saldo previsto a fine anno.
// Per ogni periodo di ferie si può preparare il rapporto di una sostituta.
import { app, num, esc, dataIt, oggiIso, nomeMeseMaiusc, isTitolare } from '../stato.js';
import { calcolaCatena } from '../engine/catena.js';
import { giorniMese } from '../engine/presenze.js';
import { oreSettimanali } from '../engine/calcolo.js';
import { condizioniAl } from '../engine/variazioni.js';
import { REGOLE_CCNL } from '../engine/tabelle.js';
import { apriSchedaImpostazioni } from './impostazioni.js';

const GS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
let annoScelto = null;

/** Periodi consecutivi (giorni lavorativi) di un insieme di date. */
function periodi(date) {
  const ord = [...date].sort();
  const out = [];
  for (const d of ord) {
    const ult = out[out.length - 1];
    const giorniDopo = ult ? (new Date(d) - new Date(ult.al)) / 86400000 : 99;
    if (ult && giorniDopo <= 3) ult.al = d; else out.push({ dal: d, al: d });
  }
  return out;
}

export function preparaSostituta(dal, al, ctx) {
  const d = app.rapporto.dati;
  const c = condizioniAl(d, dal);
  const bozza = {
    datore: { ...d.datore },
    livello: c.livello, mansioni: d.mansioni, luogoLavoro: d.luogoLavoro,
    tipologia: c.tipologia || 'ore', pagaOraria: c.pagaOraria, pagaMensile: c.pagaMensile || 0, vittoAlloggio: !!c.vittoAlloggio,
    orario: { ...c.orario }, fasciaOraria: d.fasciaOraria,
    tipoContratto: 'determinato', sostituzione: true, dataAssunzione: dal, dataFineTermine: al, giorniProva: 0,
    cuaf: d.cuaf, cassaColf: d.cassaColf, tredicesimaMensile: true,
    detrazione: { ...(d.detrazione || {}) },
    sostituisce: d.lavoratrice?.nome || '',
  };
  apriSchedaImpostazioni('rapporto');
  ctx.scegliRapporto(null, bozza);
}

export function mostraFerie(root, ctx) {
  const d = app.rapporto.dati;
  const oggi = oggiIso();
  const annoOggi = Number(oggi.slice(0, 4));
  const primo = Number(d.dataAssunzione.slice(0, 4));
  const anni = [];
  for (let a = annoOggi + 1; a >= primo; a--) anni.push(a);
  if (!anni.includes(annoScelto)) annoScelto = annoOggi >= primo ? annoOggi : primo;
  const anno = annoScelto;

  const catena = calcolaCatena(d, app.cedolini, { anno, mese: 12 });
  const mesiAnno = catena.filter((m) => m.anno === anno);
  const prima = mesiAnno[0]?.statoPrima ?? {};
  const fine = mesiAnno[mesiAnno.length - 1]?.risultato.contatori ?? {};
  const cond = condizioniAl(d, `${anno}-12-01`);
  const giorniSett = Object.values(cond.orario).filter((h) => h > 0).length || 1;
  const oreGiorno = oreSettimanali(cond.orario) / giorniSett;
  const gg = (ore) => (oreGiorno ? ore / oreGiorno : 0);

  // stato di ogni giorno: dai cedolini (godute o approvate) e dalle richieste in attesa
  const tipoGiorno = new Map();
  for (const m of mesiAnno) {
    for (const g of giorniMese(condizioniAl(d, `${m.anno}-${String(m.mese).padStart(2, '0')}-01`), m.anno, m.mese, m.salvato?.presenze?.giorni)) {
      if (['F', 'M', 'P'].includes(g.tipo) && !g.festivita) tipoGiorno.set(g.data, g.tipo);
      else if (g.festivita && g.attivo) tipoGiorno.set(g.data, 'fest');
    }
  }
  const attesa = new Set();
  for (const r of app.richieste.filter((x) => x.stato === 'in attesa' && x.tipo === 'F')) {
    for (let t = new Date(r.dal + 'T00:00:00Z'); t <= new Date(r.al + 'T00:00:00Z'); t = new Date(t.getTime() + 86400000)) {
      const iso = t.toISOString().slice(0, 10);
      if (iso.startsWith(String(anno)) && !tipoGiorno.has(iso)) attesa.add(iso);
    }
  }
  const oreFerieAnno = mesiAnno.reduce((s, m) => s + (m.presenze.oreFerie || 0), 0);
  const oreFerieFatte = mesiAnno.filter((m) => `${m.anno}-${String(m.mese).padStart(2, '0')}` < oggi.slice(0, 7)).reduce((s, m) => s + (m.presenze.oreFerie || 0), 0);
  const maturateAnno = mesiAnno.reduce((s, m) => s + (m.risultato.accantonamenti.ferieMaturateOre || 0), 0);
  const oreAttesa = [...attesa].reduce((s, iso) => {
    const dow = new Date(iso + 'T00:00:00Z').getUTCDay() || 7;
    return s + (cond.orario[dow] || 0);
  }, 0);
  const saldoFine = (fine.ferieResidueOre ?? 0) - oreAttesa;
  const periodiFerie = periodi([...tipoGiorno].filter(([, t]) => t === 'F').map(([k]) => k));

  const mese = (m) => {
    const giorniNelMese = new Date(Date.UTC(anno, m, 0)).getUTCDate();
    const primoDow = (new Date(Date.UTC(anno, m - 1, 1)).getUTCDay() || 7) - 1;
    const celle = Array.from({ length: primoDow }, () => '<span></span>');
    for (let g = 1; g <= giorniNelMese; g++) {
      const iso = `${anno}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
      const t = tipoGiorno.get(iso);
      const cls = attesa.has(iso) ? 'attesa' : t ? `t-${t}` : '';
      celle.push(`<span class="${cls}${iso === oggi ? ' oggi' : ''}${iso < d.dataAssunzione ? ' fuori' : ''}">${g}</span>`);
    }
    return `<div class="mini-mese"><h3>${nomeMeseMaiusc(m)}</h3><div class="mini-griglia">${GS.map((x) => `<b>${x}</b>`).join('')}${celle.join('')}</div></div>`;
  };

  root.innerHTML = `
    <div class="card-testa"><h1 class="titolo-pagina" style="margin-bottom:8px">Ferie ${anno}</h1>
      <button type="button" class="link torna">‹ Presenze</button></div>
    <div class="riga stretta" style="margin-bottom:16px">
      <select name="anno" aria-label="Anno">${anni.map((a) => `<option ${a === anno ? 'selected' : ''}>${a}</option>`).join('')}</select>
    </div>
    <section class="card evidenza">
      <div class="cifre">
        <div><span class="etichetta">Residue a inizio anno</span><span class="valore">${num(gg(prima.ferieResidueOre || 0), 1)} gg</span><span class="sotto">${num(prima.ferieResidueOre || 0, 1)} h</span></div>
        <div><span class="etichetta">Maturate nell'anno</span><span class="valore">${num(gg(maturateAnno), 1)} gg</span><span class="sotto">${REGOLE_CCNL.giorniFerieAnnui} giorni l'anno a tempo pieno</span></div>
        <div><span class="etichetta">Godute o approvate</span><span class="valore">${num(gg(oreFerieAnno), 1)} gg</span><span class="sotto">di cui già fatte ${num(gg(oreFerieFatte), 1)} gg</span></div>
        <div><span class="etichetta">In attesa di risposta</span><span class="valore">${num(gg(oreAttesa), 1)} gg</span></div>
        <div><span class="etichetta">Saldo previsto al 31/12</span><span class="valore ${saldoFine < 0 ? 'ko' : ''}">${num(gg(saldoFine), 1)} gg</span><span class="sotto">${saldoFine < 0 ? 'più ferie di quelle maturate' : 'se le richieste in attesa vengono approvate'}</span></div>
      </div>
      <p class="nota">Giorni calcolati su ${num(oreGiorno, 1)} ore per giornata di lavoro. Le ferie non godute entro l'anno si possono usare nei 18 mesi successivi.</p>
    </section>
    <section class="card">
      <div class="legenda">
        <span><i class="t-F"></i>Ferie</span><span><i class="attesa"></i>Richieste in attesa</span>
        <span><i class="t-P"></i>Permessi</span><span><i class="t-M"></i>Malattia</span><span><i class="t-fest"></i>Festività</span>
      </div>
      <div class="anno-griglia">${Array.from({ length: 12 }, (_, i) => mese(i + 1)).join('')}</div>
    </section>
    ${periodiFerie.length ? `<section class="card">
      <h2>Periodi di ferie</h2>
      <ul class="lista-richieste">${periodiFerie.map((p) => `<li><span><strong>${p.dal === p.al ? dataIt(p.dal) : `${dataIt(p.dal)} – ${dataIt(p.al)}`}</strong></span>
        ${isTitolare() && p.al >= oggi ? `<button type="button" class="secondario" data-sost="${p.dal}|${p.al}">Prepara sostituta</button>` : ''}</li>`).join('')}</ul>
      ${isTitolare() ? '<p class="nota">"Prepara sostituta" crea un nuovo rapporto a termine per quelle date, con orario e paga di oggi: completi i dati della sostituta e salvi. Per una sostituzione non si paga il contributo INPS aggiuntivo dei contratti a termine.</p>' : ''}
    </section>` : ''}`;

  root.querySelector('.torna').addEventListener('click', () => ctx.vai('mesi'));
  root.querySelector('[name=anno]').addEventListener('change', (e) => { annoScelto = Number(e.target.value); mostraFerie(root, ctx); });
  root.querySelectorAll('[data-sost]').forEach((b) => b.addEventListener('click', () => {
    const [dal, al] = b.dataset.sost.split('|');
    if (!confirm(`Creare un nuovo rapporto per una sostituta dal ${dataIt(dal)} al ${dataIt(al)}?`)) return;
    preparaSostituta(dal, al, ctx);
  }));
}

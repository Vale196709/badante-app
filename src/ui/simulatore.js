// Simulatore: confronto di scenari di costo e conteggi di fine rapporto.
import { app, catenaCorrente, eur, num, esc, oggiIso } from '../stato.js';
import { simulaCosto, oreSettimanali } from '../engine/calcolo.js';
import { calcolaCatena } from '../engine/catena.js';
import { calcolaCessazione, MOTIVI } from '../engine/cessazione.js';
import { tabelleAnno, TIPOLOGIE, tipologia, minimoContrattuale } from '../engine/tabelle.js';
import { stampaCessazione } from './stampe.js';
import { condizioniAl } from '../engine/variazioni.js';

const LIVELLI = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
const euroTondo = (x) => Math.round(x * 100) / 100;

export function mostraSimulatore(root) {
  const d0 = app.rapporto?.dati;
  const d = d0 ? condizioniAl(d0, oggiIso()) : null; // condizioni in vigore oggi
  const anno = Number(oggiIso().slice(0, 4));
  const tipo0 = d?.tipologia || 'ore';
  const mens0 = tipologia(d).mensile;
  const base = { tipologia: tipo0, paga: mens0 ? Number(d.pagaMensile) || 0 : d?.pagaOraria ?? 9, ore: d ? oreSettimanali(d.orario) : 15, livello: d?.livello ?? 'B', tipoContratto: d?.tipoContratto ?? 'indeterminato', vitto: mens0 ? !!d.vittoAlloggio : false };
  const tAnno = tabelleAnno(anno);
  const scenari = mens0
    ? [
      { nome: 'Attuale', ...base },
      { nome: 'Scenario B', ...base, paga: euroTondo(base.paga * 1.05) },
      { nome: 'Scenario C', ...base, tipologia: 'ore', paga: base.paga ? Number((base.paga * 12 / 52 / Math.max(base.ore, 1)).toFixed(2)) : 9, vitto: false },
    ]
    : [
      { nome: 'Attuale', ...base },
      { nome: 'Scenario B', ...base, paga: base.paga + 1 },
      { nome: 'Convivente', ...base, tipologia: 'convivente', ore: 54, livello: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'].includes(base.livello) ? base.livello : 'B', paga: minimoContrattuale(tAnno, { tipologia: 'convivente', livello: base.livello }) || 983.16, vitto: true },
    ];

  root.innerHTML = `
    <h1 class="titolo-pagina">Simulatore</h1>
    <section class="card">
      <h2>Confronta scenari di costo</h2>
      <p class="nota">Modifica tipo di rapporto, paga, ore e livello: i valori sono medie mensili su base annua (52 settimane), con le tabelle ${anno}. La paga netta è al netto dei soli contributi a carico della lavoratrice: il datore domestico non trattiene IRPEF, che la lavoratrice paga eventualmente con la sua dichiarazione dei redditi.</p>
      <div class="scenari"></div>
      <div class="tab-scorre"><table class="tab-confronto"></table></div>
    </section>
    ${d?.dataAssunzione ? `
    <section class="card">
      <h2>Conteggi di fine rapporto</h2>
      <p class="nota">Simula quanto spetterebbe alla lavoratrice se il rapporto terminasse in una certa data. Non modifica nessun dato.</p>
      <div class="riga">
        <label>Data di cessazione<input type="date" name="dataCess" value="${d.dataCessazione || oggiIso()}" min="${d.dataAssunzione}" /></label>
        <label>Motivo<select name="motivo">${Object.entries(MOTIVI).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      </div>
      <label class="spunta"><input type="checkbox" name="preavvisoLavorato" checked /> Il preavviso viene lavorato</label>
      <div class="esito-cess"></div>
    </section>` : ''}`;

  const box = root.querySelector('.scenari');
  const disegnaScenario = (s, i) => {
    const mens = tipologia(s).mensile;
    return `
      <legend>${esc(s.nome)}</legend>
      <label class="largo">Tipo<select name="tipo">${Object.entries(TIPOLOGIE).map(([k, v]) => `<option value="${k}" ${k === s.tipologia ? 'selected' : ''}>${v.breve}</option>`).join('')}</select></label>
      <label>${mens ? '€/mese' : '€/ora'}<input type="number" step="${mens ? 10 : 0.05}" min="0" name="paga" value="${s.paga}" inputmode="decimal" /></label>
      <label>Ore/sett.<input type="number" step="0.5" min="1" max="60" name="ore" value="${s.ore}" inputmode="decimal" /></label>
      <label>Livello<select name="livello">${LIVELLI.map((l) => `<option ${l === s.livello ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${mens ? `<label class="spunta largo"><input type="checkbox" name="vitto" ${s.vitto ? 'checked' : ''} /> Vitto e alloggio</label>` : ''}`;
  };
  box.innerHTML = scenari.map((s, i) => `<fieldset class="scenario" data-i="${i}">${disegnaScenario(s, i)}</fieldset>`).join('');
  // al cambio di tipo propone minimo, ore tipiche e vitto
  box.addEventListener('change', (e) => {
    if (e.target.name !== 'tipo') return;
    const fs = e.target.closest('.scenario');
    const s = scenari[fs.dataset.i];
    const tipo = e.target.value;
    const tip = TIPOLOGIE[tipo];
    s.tipologia = tipo;
    if (tip.mensile) {
      if (tip.maxSettimanali && s.ore > tip.maxSettimanali) s.ore = tip.maxSettimanali;
      if (tipo === 'convivente') s.ore = 54;
      if (!minimoContrattuale(tAnno, { tipologia: tipo, livello: s.livello })) s.livello = tipo === 'presenza' ? s.livello : (tipo === 'conviventePT' ? 'B' : 'BS');
      s.paga = minimoContrattuale(tAnno, { tipologia: tipo, livello: s.livello }) || s.paga;
      s.vitto = !!tip.vitto;
    } else {
      s.paga = Math.max(tAnno.minimiOrariNonConviventi[s.livello] || 7, 9);
      s.vitto = false;
      if (s.ore > 40) s.ore = 15;
    }
    fs.innerHTML = disegnaScenario(s, fs.dataset.i);
    confronta();
  });

  const tab = root.querySelector('.tab-confronto');
  const confronta = () => {
    box.querySelectorAll('.scenario').forEach((fs) => {
      const s = scenari[fs.dataset.i];
      s.paga = Number(fs.querySelector('[name=paga]').value) || 0;
      s.ore = Number(fs.querySelector('[name=ore]').value) || 0;
      s.livello = fs.querySelector('[name=livello]').value;
      s.vitto = !!fs.querySelector('[name=vitto]')?.checked;
    });
    const ris = scenari.map((s) => {
      const mens = tipologia(s).mensile;
      const r = simulaCosto({ pagaOraria: mens ? 0 : s.paga, pagaMensile: mens ? s.paga : 0, tipologia: s.tipologia, vittoAlloggio: s.vitto, livello: s.livello, oreSettimanaliTot: s.ore, anno, tipoContratto: s.tipoContratto, cuaf: d?.cuaf !== false, cassaColf: d?.cassaColf !== false });
      return { s, r, mens, min: r.minimo };
    });
    const riga = (et, f, forte = false) => `<tr${forte ? ' class="forte"' : ''}><th>${et}</th>${ris.map((x) => `<td class="num">${f(x)}</td>`).join('')}</tr>`;
    const diff = (x) => { const v = x.r.costoMensile - ris[0].r.costoMensile; return v === 0 ? '—' : `${v > 0 ? '+' : '−'}${eur(Math.abs(v))}`; };
    tab.innerHTML = `
      <thead><tr><th></th>${ris.map((x) => `<th class="num">${esc(x.s.nome)}</th>`).join('')}</tr></thead>
      <tbody>
        ${riga('Tipo di rapporto', (x) => esc(TIPOLOGIE[x.s.tipologia].breve))}
        ${riga('Paga lorda', (x) => (x.mens ? `${eur(x.s.paga)}/mese` : `${eur(x.s.paga)}/h`))}
        ${riga('Paga oraria lorda', (x) => eur(x.r.pagaOraria))}
        ${riga('Paga oraria netta', (x) => eur(x.r.pagaNettaOraria), true)}
        ${riga('Netta oraria con 13ª', (x) => eur(x.r.nettaOrariaCon13))}
        ${riga('Costo orario per te', (x) => eur(x.r.costoOrario))}
        ${riga('Ore al mese', (x) => num(x.r.oreMese, 1))}
        ${riga('Minimo CCNL', (x) => (x.min ? (x.s.paga >= x.min ? `✓ ${num(x.min)}` : `<span class="ko">sotto ${num(x.min)}</span>`) : (x.mens ? '<span class="ko">livello non previsto</span>' : 'n.d.')))}
        ${riga('Fascia INPS', (x) => esc(x.r.fascia.replace(/ \(.*\)/, '')))}
        ${riga('Retribuzione lorda', (x) => eur(x.r.retribuzione))}
        ${riga('Rateo 13ª', (x) => eur(x.r.rateo13))}
        ${ris.some((x) => x.r.vittoAlloggioMese) ? riga('Vitto e alloggio (valore)', (x) => (x.r.vittoAlloggioMese ? eur(x.r.vittoAlloggioMese) : '—')) : ''}
        ${riga('Contributi a tuo carico', (x) => eur(x.r.inpsDatore + x.r.cassaColfDatore))}
        ${riga('TFR accantonato', (x) => eur(x.r.tfr))}
        ${riga('Costo mensile per te', (x) => eur(x.r.costoMensile), true)}
        ${riga('Differenza dall\'attuale', diff)}
        ${riga('Costo annuo', (x) => eur(x.r.costoAnnuo), true)}
        ${riga('Netto medio alla lavoratrice', (x) => eur(x.r.nettoMedioLavoratrice))}
        ${riga('Versamento INPS trimestrale', (x) => eur(x.r.versamentoTrimestraleInps))}
      </tbody>`;
  };
  box.addEventListener('input', confronta);
  confronta();

  // ---------- Fine rapporto ----------
  const esitoCess = root.querySelector('.esito-cess');
  if (!esitoCess) return;
  const calcolaFine = () => {
    const data = root.querySelector('[name=dataCess]').value;
    if (!data || data < d.dataAssunzione) { esitoCess.innerHTML = ''; return; }
    const motivo = root.querySelector('[name=motivo]').value;
    const preavvisoLavorato = root.querySelector('[name=preavvisoLavorato]').checked;
    const [a, m] = data.split('-').map(Number);
    const rapp = { ...d0, dataCessazione: data };
    // contatori a fine del mese di cessazione (presenze salvate o da orario fino alla data)
    const cat = calcolaCatena(rapp, app.cedolini, { anno: a, mese: m });
    const ultimo = cat[cat.length - 1];
    if (!ultimo) { esitoCess.innerHTML = ''; return; }
    const c = calcolaCessazione(condizioniAl(rapp, data), ultimo.risultato.contatori, { dataCessazione: data, motivo, preavvisoLavorato });
    esitoCess.innerHTML = `
      <table class="tab-cedolino">
        <tbody>
          ${c.voci.map((v) => `<tr><td>${esc(v.descrizione)}</td><td class="num">${num(v.importo)}</td></tr>`).join('')}
          <tr class="totale"><td>Totale lordo spettanze finali</td><td class="num">${num(c.lordo)}</td></tr>
          <tr class="meno"><td>Contributi a carico lavoratrice</td><td class="num">−${num(c.trattenute)}</td></tr>
          <tr class="netto"><td>Netto da pagare (oltre all'ultimo stipendio)</td><td class="num">${eur(c.netto)}</td></tr>
        </tbody>
      </table>
      <p class="nota">Preavviso: ${c.giorniPreavviso} giorni di calendario. Ultimo stipendio di ${data.slice(5, 7)}/${a}: ${eur(ultimo.risultato.netto)} netti. Costo complessivo delle spettanze per te: ${eur(c.costoTotale)} più contributi.</p>
      <ul class="nota">${c.note.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <button type="button" class="secondario stampa-cess">Stampa conteggi</button>`;
    esitoCess.querySelector('.stampa-cess').addEventListener('click', () => stampaCessazione(c));
  };
  root.querySelectorAll('[name=dataCess],[name=motivo],[name=preavvisoLavorato]').forEach((el) => el.addEventListener('change', calcolaFine));
  calcolaFine();
}

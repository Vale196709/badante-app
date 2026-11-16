// Simulatore: confronto di scenari di costo e conteggi di fine rapporto.
import { app, catenaCorrente, eur, num, esc, oggiIso } from '../stato.js';
import { simulaCosto, oreSettimanali } from '../engine/calcolo.js';
import { calcolaCatena } from '../engine/catena.js';
import { calcolaCessazione, MOTIVI } from '../engine/cessazione.js';
import { tabelleAnno, TIPOLOGIE, tipologia, minimoContrattuale, REGOLE_CCNL } from '../engine/tabelle.js';
import { stampaCessazione, stampaConfronto } from './stampe.js';
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
  // Quattro colonne. "Attuale" è il rapporto NON registrato: la paga data tutta in mano, senza contributi,
  // Cassa Colf, 13ª e TFR. Le altre tre sono rapporti regolari da confrontare.
  const scenari = mens0
    ? [
      { nome: 'Attuale', nero: true, ...base },
      { nome: 'Ipotesi A', ...base },
      { nome: 'Ipotesi B', ...base, paga: euroTondo(base.paga * 1.05) },
      { nome: 'Convivente', ...base, tipologia: 'convivente', ore: 54, livello: LIVELLI.includes(base.livello) ? base.livello : 'B', paga: minimoContrattuale(tAnno, { tipologia: 'convivente', livello: base.livello }) || 983.16, vitto: true },
    ]
    : [
      { nome: 'Attuale', nero: true, ...base },
      { nome: 'Ipotesi A', ...base },
      { nome: 'Ipotesi B', ...base, paga: base.paga + 1 },
      { nome: 'Convivente', ...base, tipologia: 'convivente', ore: 54, livello: LIVELLI.includes(base.livello) ? base.livello : 'B', paga: minimoContrattuale(tAnno, { tipologia: 'convivente', livello: base.livello }) || 983.16, vitto: true },
    ];

  root.innerHTML = `
    <h1 class="titolo-pagina">Simulatore</h1>
    <section class="card">
      <h2>Confronta scenari di costo</h2>
      <p class="nota">Modifica tipo di rapporto, paga, ore e livello: i valori sono medie mensili su base annua (52 settimane), con le tabelle ${anno}. La paga netta è al netto dei soli contributi a carico della lavoratrice: il datore domestico non trattiene IRPEF, che la lavoratrice paga eventualmente con la sua dichiarazione dei redditi.</p>
      <label class="aliquota">Aliquota marginale complessiva di chi dichiara (%), per stimare il risparmio fiscale
        <input type="number" name="aliquota" value="47.23" min="0" max="60" step="0.01" inputmode="decimal" />
        <small>Predefinita: 43% IRPEF + 3,33% addizionale regionale Lazio + 0,9% addizionale comunale di Roma. Per altri scaglioni: IRPEF 23% fino a 28.000 €, 33% fino a 50.000 €, 43% oltre.</small>
      </label>
      <div class="tab-scorre"><table class="tab-confronto"></table></div>
      <button type="button" class="secondario stampa-confronto">Stampa o salva in PDF il confronto</button>
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

  const tab = root.querySelector('.tab-confronto');
  tab.innerHTML = `
    <thead><tr><th></th>${scenari.map((s, i) => `<th class="num${i === 0 ? ' col-att col-nero' : ''}">${esc(s.nome)}${s.nero ? '<small class="sotto">non registrata</small>' : ''}</th>`).join('')}</tr></thead>
    <tbody class="ingressi"></tbody>
    <tbody class="esiti"></tbody>`;
  const corpoIn = tab.querySelector('.ingressi');
  const corpoEs = tab.querySelector('.esiti');

  // Righe modificabili: dentro la tabella, una cella per colonna
  const disegnaIngressi = () => {
    const rigaIn = (et, f) => `<tr><th>${et}</th>${scenari.map((s, i) => `<td data-i="${i}">${f(s)}</td>`).join('')}</tr>`;
    corpoIn.innerHTML = `
      ${rigaIn('Tipo di rapporto', (s) => `<select name="tipo" aria-label="Tipo di rapporto, ${esc(s.nome)}">${Object.entries(TIPOLOGIE).map(([k, v]) => `<option value="${k}" ${k === s.tipologia ? 'selected' : ''}>${v.breve}</option>`).join('')}</select>`)}
      ${rigaIn('Paga lorda', (s) => { const m = tipologia(s).mensile; return `<input type="number" step="${m ? 10 : 0.05}" min="0" name="paga" value="${s.paga}" inputmode="decimal" aria-label="Paga lorda, ${esc(s.nome)}" /><small class="unita">${m ? '€/mese' : '€/ora'}</small>`; })}
      ${rigaIn('Ore a settimana', (s) => `<input type="number" step="0.5" min="1" max="60" name="ore" value="${s.ore}" inputmode="decimal" aria-label="Ore a settimana, ${esc(s.nome)}" />`)}
      ${rigaIn('Livello', (s) => `<select name="livello" aria-label="Livello, ${esc(s.nome)}">${LIVELLI.map((l) => `<option ${l === s.livello ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${rigaIn('Vitto e alloggio', (s) => (tipologia(s).mensile ? `<label class="spunta"><input type="checkbox" name="vitto" ${s.vitto ? 'checked' : ''} aria-label="Vitto e alloggio, ${esc(s.nome)}" /> sì</label>` : '<span class="nd">—</span>'))}`;
  };
  disegnaIngressi();

  // al cambio di tipo propone minimo, ore tipiche e vitto
  corpoIn.addEventListener('change', (e) => {
    if (e.target.name !== 'tipo') return;
    const s = scenari[e.target.closest('td').dataset.i];
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
    disegnaIngressi();
    confronta();
  });

  const confronta = () => {
    scenari.forEach((s, i) => {
      const col = (n) => corpoIn.querySelector(`td[data-i="${i}"] [name=${n}]`);
      s.paga = Number(col('paga').value) || 0;
      s.ore = Number(col('ore').value) || 0;
      s.livello = col('livello').value;
      s.vitto = !!col('vitto')?.checked;
    });
    const ris = scenari.map((s) => {
      const mens = tipologia(s).mensile;
      const r = simulaCosto({ pagaOraria: mens ? 0 : s.paga, pagaMensile: mens ? s.paga : 0, tipologia: s.tipologia, vittoAlloggio: s.vitto, livello: s.livello, oreSettimanaliTot: s.ore, anno, tipoContratto: s.tipoContratto, cuaf: d?.cuaf !== false, cassaColf: d?.cassaColf !== false });
      return { s, r, mens, min: r.minimo, nero: !!s.nero };
    });
    // Attuale (non registrata): stessa paga lorda in mano, niente contributi, Cassa Colf, 13ª e TFR
    const z = ris[0];
    const lordoMese = z.r.retribuzione;
    ris[0] = {
      ...z,
      min: null,
      r: {
        ...z.r,
        pagaNettaOraria: z.r.pagaOraria,
        nettaOrariaCon13: z.r.pagaOraria,
        costoOrario: z.r.oreMese ? euroTondo(lordoMese / z.r.oreMese) : 0,
        rateo13: 0,
        inpsDatore: 0,
        cassaColfDatore: 0,
        tfr: 0,
        costoMensile: lordoMese,
        costoAnnuo: euroTondo(lordoMese * 12),
        nettoMedioLavoratrice: lordoMese,
        versamentoTrimestraleInps: 0,
      },
    };
    const nulla = (x, v) => (x.nero ? '—' : v);
    // Agevolazioni fiscali (stima annua): detrazione 19% sulla spesa fino a 2.100 € se i requisiti sono spuntati
    // in Impostazioni → Rapporto, e deduzione dei contributi a carico del datore fino a 1.549,37 €.
    const aliquota = (Number(root.querySelector('[name=aliquota]').value) || 0) / 100;
    const Rd = REGOLE_CCNL.detrazioneAssistenza;
    const reqDetr = !!d?.detrazione?.nonAutosufficiente && !!d?.detrazione?.redditoEntroLimite && (d?.pagamento?.modalita || 'bonifico') !== 'contanti';
    ris.forEach((x) => {
      if (x.nero) { x.agev = { costoNetto: x.r.costoAnnuo }; return; }
      const spesaAnno = (x.r.retribuzione + x.r.rateo13) * 12;
      const detrazione = reqDetr ? euroTondo(Math.min(spesaAnno, Rd.spesaMassima) * Rd.aliquota) : 0;
      const deducibili = euroTondo(Math.min((x.r.inpsDatore + x.r.cassaColfDatore) * 12, REGOLE_CCNL.deduzioneContributiMax));
      const risparmio = euroTondo(detrazione + deducibili * aliquota);
      x.agev = { detrazione, deducibili, risparmio, costoNetto: euroTondo(x.r.costoAnnuo - risparmio) };
    });
    const riga = (et, f, forte = false) => `<tr${forte ? ' class="forte"' : ''}><th>${et}</th>${ris.map((x, i) => `<td class="num${i === 0 ? ' col-att col-nero' : ''}">${f(x)}</td>`).join('')}</tr>`;
    const diff = (x) => { const v = euroTondo(x.r.costoMensile - ris[0].r.costoMensile); return v === 0 ? '—' : `${v > 0 ? '+' : '−'}${eur(Math.abs(v))}`; };
    corpoEs.innerHTML = `
      ${riga('Paga oraria lorda', (x) => eur(x.r.pagaOraria))}
      ${riga('Paga oraria netta', (x) => eur(x.r.pagaNettaOraria), true)}
      ${riga('Netta oraria con 13ª', (x) => eur(x.r.nettaOrariaCon13))}
      ${riga('Costo orario per te', (x) => eur(x.r.costoOrario))}
      ${riga('Ore al mese', (x) => num(x.r.oreMese, 1))}
      ${riga('Minimo CCNL', (x) => nulla(x, x.min ? (x.s.paga >= x.min ? `✓ ${num(x.min)}` : `<span class="ko">sotto ${num(x.min)}</span>`) : (x.mens ? '<span class="ko">livello non previsto</span>' : 'n.d.')))}
      ${riga('Fascia INPS', (x) => nulla(x, esc(x.r.fascia.replace(/ \(.*\)/, ''))))}
      ${riga('Retribuzione lorda', (x) => eur(x.r.retribuzione))}
      ${riga('Rateo 13ª', (x) => nulla(x, eur(x.r.rateo13)))}
      ${ris.some((x) => x.r.vittoAlloggioMese) ? riga('Vitto e alloggio (valore)', (x) => (x.r.vittoAlloggioMese ? eur(x.r.vittoAlloggioMese) : '—')) : ''}
      ${riga('Contributi a tuo carico', (x) => nulla(x, eur(x.r.inpsDatore + x.r.cassaColfDatore)))}
      ${riga('TFR accantonato', (x) => nulla(x, eur(x.r.tfr)))}
      ${riga('Costo mensile per te', (x) => eur(x.r.costoMensile), true)}
      ${riga('Differenza dall\'attuale', diff)}
      ${riga('Costo annuo', (x) => eur(x.r.costoAnnuo), true)}
      ${riga('Detrazione 19% (annua)', (x) => nulla(x, x.agev.detrazione ? `−${eur(x.agev.detrazione)}` : '<span class="nd">non spettante</span>'))}
      ${riga('Contributi deducibili (annui)', (x) => nulla(x, eur(x.agev.deducibili)))}
      ${riga('Risparmio fiscale stimato', (x) => nulla(x, `−${eur(x.agev.risparmio)}`))}
      ${riga('Costo annuo dopo agevolazioni', (x) => eur(x.agev.costoNetto), true)}
      ${riga('Netto medio alla lavoratrice', (x) => eur(x.r.nettoMedioLavoratrice))}
      ${riga('Versamento INPS trimestrale', (x) => nulla(x, eur(x.r.versamentoTrimestraleInps)))}`;

    // Nota sotto la tabella: cosa non si vede nel risparmio della colonna Attuale
    const reg = ris[1];
    const risparmioAnno = euroTondo(reg.r.costoAnnuo - ris[0].r.costoAnnuo);
    notaNero.innerHTML = `
      <p><strong>Risparmio fiscale (stima annua)</strong>: detrazione del 19% sulla spesa fino a ${eur(Rd.spesaMassima)} (${reqDetr ? 'requisiti spuntati in Impostazioni → Rapporto' : 'non spettante finché in Impostazioni → Rapporto non risultano assistito non autosufficiente, reddito entro il limite e pagamento non in contanti'}), più la deduzione dei contributi a tuo carico fino a ${eur(REGOLE_CCNL.deduzioneContributiMax)} moltiplicata per l'aliquota marginale indicata (${num(aliquota * 100, 2)}%). Per cassa e con i dati inseriti qui: il calcolo definitivo è nel Pacchetto per commercialista o CAF.</p>
      <p><strong>Colonna "Attuale" = rapporto non registrato</strong>: la paga lorda data tutta in mano e nient'altro (niente contributi, Cassa Colf, 13ª e TFR). Il risparmio apparente rispetto a "${esc(reg.s.nome)}" è di ${eur(risparmioAnno)} l'anno, ma non tiene conto di:</p>
      <ul>
        <li>deduzione dei contributi e detrazione del 19% che con un contratto regolare puoi usare nella dichiarazione dei redditi;</li>
        <li>Prestazione universale, che richiede un contratto regolare;</li>
        <li>la lavoratrice può chiedere 13ª, ferie, TFR e contributi arretrati fino a 5 anni dalla fine del rapporto, e l'INPS aggiunge le sanzioni per evasione contributiva;</li>
        <li>senza assicurazione INAIL, un infortunio in casa resta a tuo carico.</li>
      </ul>`;
  };
  const notaNero = document.createElement('div');
  notaNero.className = 'nota nota-nero';
  tab.closest('.tab-scorre').after(notaNero);
  corpoIn.addEventListener('input', confronta);
  // Stampa / PDF: legge la tabella com'è in questo momento
  root.querySelector('.stampa-confronto').addEventListener('click', () => {
    const testo = (el) => el.textContent.replace(/\s+/g, ' ').trim();
    const cella = (td) => {
      const sel = td.querySelector('select');
      const inp = td.querySelector('input');
      if (sel) return sel.selectedOptions[0].textContent.trim();
      if (inp?.type === 'checkbox') return inp.checked ? 'sì' : 'no';
      if (inp) return `${num(Number(inp.value), inp.name === 'ore' ? 1 : 2)}${td.querySelector('.unita') ? ` ${testo(td.querySelector('.unita'))}` : ''}`;
      return testo(td);
    };
    stampaConfronto({
      anno,
      aliquota: Number(root.querySelector('[name=aliquota]').value) || 0,
      intestazioni: [...tab.querySelectorAll('thead th')].slice(1).map((th) => ({ nome: th.firstChild.textContent.trim(), sotto: th.querySelector('small')?.textContent.trim() || '' })),
      righe: [...tab.querySelectorAll('tbody tr')].map((tr) => ({ et: testo(tr.querySelector('th')), celle: [...tr.querySelectorAll('td')].map(cella), forte: tr.classList.contains('forte'), ingresso: !!tr.closest('.ingressi') })),
      nota: notaNero.innerHTML,
    });
  });
  root.querySelector('[name=aliquota]').addEventListener('input', confronta);
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

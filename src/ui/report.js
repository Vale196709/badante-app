// Report di sintesi per il datore: quanto costa, quanto costerà, cosa è maturato, cosa c'è da pagare.
import { app, eur, num, esc, dataIt, oggiIso, nomeMeseMaiusc, nomeRapporto } from '../stato.js';
import { reportAnno, sommaReport } from '../engine/report.js';
import { caricaCedolini } from '../lib/dati.js';
import { apriStampa } from './stampe.js';

const MESI_BREVI = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
let annoScelto = null;
let ambito = 'questo';
const cacheCedolini = new Map();

function grafico(mesi) {
  const max = Math.max(...mesi.map((m) => m.costo), 1);
  return `
    <figure class="grafico" aria-label="Costo mensile: consuntivo e previsione">
      <div class="legenda-grafico"><span><i class="cons"></i>Consuntivo</span><span><i class="prev"></i>Previsione</span></div>
      <div class="barre">
        ${Array.from({ length: 12 }, (_, i) => {
          const m = mesi.find((x) => x.mese === i + 1);
          const h = m ? Math.max(2, (m.costo / max) * 100) : 0;
          return `<div class="colonna" style="width:${100 / 12}%">${m ? `<button type="button" class="barra-dato ${m.consuntivo ? '' : 'prevista'}" style="height:${h}%" aria-label="${nomeMeseMaiusc(i + 1)}: ${eur(m.costo)}${m.consuntivo ? '' : ', previsione'}">
            <span class="suggerimento">${nomeMeseMaiusc(i + 1)}${m.consuntivo ? '' : ' (previsione)'}<br><strong>${eur(m.costo)}</strong><br>netto ${eur(m.netto)}</span></button>` : ''}</div>`;
        }).join('')}
      </div>
      <div class="asse">${MESI_BREVI.map((l) => `<span>${l}</span>`).join('')}</div>
    </figure>`;
}

function composizione(t) {
  const voci = [['Retribuzione', t.retribuzione], ['Tredicesima', t.tredicesima], ['Contributi INPS e Cassa Colf', t.contributi], ['TFR', t.tfr]];
  const totale = voci.reduce((a, [, v]) => a + v, 0) || 1;
  return `<ul class="composizione">${voci.map(([n, v]) => `
    <li><span class="comp-testa"><span>${n}</span><strong>${eur(v)}</strong></span>
      <span class="comp-barra"><span style="width:${(v / totale) * 100}%"></span></span>
      <small>${num((v / totale) * 100, 0)}%</small></li>`).join('')}</ul>`;
}

async function dati(anno) {
  const oggi = oggiIso();
  if (ambito === 'questo' || app.rapporti.length < 2) {
    return { rep: reportAnno(app.rapporto.dati, app.cedolini, anno, oggi, app.fatte), nomi: [nomeRapporto(app.rapporto)] };
  }
  const lista = [];
  const nomi = [];
  for (const r of app.rapporti.filter((x) => x.ruolo !== 'lavoratrice' && x.dati)) {
    if (!cacheCedolini.has(r.id)) cacheCedolini.set(r.id, r.id === app.rapporto.id ? app.cedolini : await caricaCedolini(r.id));
    const rep = reportAnno(r.dati, cacheCedolini.get(r.id), anno, oggi, r.id === app.rapporto.id ? app.fatte : new Set());
    if (rep && !rep.vuoto) {
      rep.uscite = rep.uscite.map((u) => ({ ...u, titolo: `${u.titolo} · ${nomeRapporto(r)}` }));
      lista.push(rep); nomi.push(nomeRapporto(r));
    }
  }
  return { rep: sommaReport(lista), nomi };
}

export async function mostraReport(root, { vai }) {
  const d = app.rapporto?.dati;
  if (!d) { vai('impostazioni'); return; }
  const annoOggi = Number(oggiIso().slice(0, 4));
  const primo = Number(d.dataAssunzione.slice(0, 4));
  const anni = [];
  for (let a = Math.max(primo, annoOggi + 1); a >= primo; a--) anni.push(a);
  if (!anni.includes(annoScelto)) annoScelto = anni.includes(annoOggi) ? annoOggi : anni[anni.length - 1];

  root.innerHTML = '<p class="caricamento">Calcolo del report…</p>';
  const { rep, nomi } = await dati(annoScelto);
  const ult = rep?.ultimoConsuntivo;
  const var_ = rep?.variazioneAnnoPrecedente;

  root.innerHTML = `
    <div class="card-testa"><h1 class="titolo-pagina" style="margin-bottom:8px">Report</h1>
      <button type="button" class="secondario stampa-report" ${rep && !rep.vuoto ? '' : 'disabled'}>Stampa / PDF</button></div>
    <div class="riga stretta" style="margin-bottom:16px">
      <select name="anno" aria-label="Anno">${anni.map((a) => `<option ${a === annoScelto ? 'selected' : ''}>${a}</option>`).join('')}</select>
      ${app.rapporti.length > 1 ? `<select name="ambito" aria-label="Rapporti">
        <option value="questo" ${ambito === 'questo' ? 'selected' : ''}>${esc(nomeRapporto(app.rapporto))}</option>
        <option value="tutti" ${ambito === 'tutti' ? 'selected' : ''}>Tutti i rapporti</option></select>` : ''}
    </div>
    ${!rep || rep.vuoto ? `<div class="avviso info">Nel ${annoScelto} il rapporto non è ancora attivo.</div>` : `
    <section class="card evidenza">
      <span class="etichetta">Costo previsto per il ${annoScelto}${ambito === 'tutti' && nomi.length > 1 ? ` · ${nomi.length} rapporti` : ''}</span>
      <span class="valore grande">${eur(rep.previsione.costo)}</span>
      <p class="nota" style="margin-top:6px">${ult ? `Di cui ${eur(rep.consuntivo.costo)} già maturati fino a ${nomeMeseMaiusc(ult.mese).toLowerCase()}` : 'Nessun mese ancora maturato'}${rep.mesiPrevisti ? `; ${rep.mesiPrevisti} ${rep.mesiPrevisti === 1 ? 'mese stimato' : 'mesi stimati'} sull'orario programmato.` : '.'}
        ${var_ != null ? ` Rispetto al ${annoScelto - 1}: ${var_ >= 0 ? '+' : '−'}${num(Math.abs(var_) * 100, 1)}%.` : ''}</p>
    </section>

    <section class="card">
      <div class="cifre">
        <div><span class="etichetta">Costo medio mensile</span><span class="valore">${eur(rep.costoMedioMensile)}</span></div>
        <div><span class="etichetta">Costo per ora lavorata</span><span class="valore">${rep.costoOrario != null ? eur(rep.costoOrario) : '—'}</span><span class="sotto">comprese ferie, festività e assenze pagate</span></div>
        <div><span class="etichetta">Netto pagato</span><span class="valore">${eur(rep.consuntivo.netto)}</span></div>
        <div><span class="etichetta">Contributi da versare</span><span class="valore">${eur(rep.previsione.contributiDovuti)}</span><span class="sotto">nell'anno, quota tua e della lavoratrice</span></div>
        <div><span class="etichetta">Ore lavorate</span><span class="valore">${num(rep.consuntivo.ore, 0)}</span></div>
        <div><span class="etichetta">Malattia</span><span class="valore">${rep.malattiaGiorni} gg</span></div>
      </div>
    </section>

    <section class="card">
      <h2>Costo mese per mese</h2>
      ${grafico(rep.mesi)}
    </section>

    <section class="card">
      <h2>Dove vanno i soldi</h2>
      <p class="nota" style="margin:-4px 0 12px">Previsione per l'intero ${annoScelto}.</p>
      ${composizione(rep.previsione)}
    </section>

    <section class="card">
      <h2>Maturato verso la lavoratrice</h2>
      <p class="nota" style="margin:-4px 0 12px">Somme già maturate che pagherai più avanti: utile per accantonarle.</p>
      <dl class="tabella-dl">
        <div><dt>TFR accantonato</dt><dd>${eur(rep.impegni.tfr)}</dd></div>
        <div><dt>Ferie non ancora godute (${num(rep.impegni.ferieOre, 1)} h)</dt><dd>${eur(rep.impegni.ferie)}</dd></div>
        <div><dt>Tredicesima maturata</dt><dd>${eur(rep.impegni.tredicesima)}</dd></div>
        <div class="tot"><dt>Totale</dt><dd>${eur(rep.impegni.totale)}</dd></div>
      </dl>
    </section>

    <section class="card">
      <h2>Uscite dei prossimi 90 giorni</h2>
      ${rep.uscite.length ? `<ul class="lista-scadenze">${rep.uscite.map((u) => `<li><span class="data">${dataIt(u.data)}</span><span style="flex:1">${esc(u.titolo)}</span><strong class="num">${eur(u.importo)}</strong></li>`).join('')}</ul>
        <p class="totale-uscite"><span>Totale</span><strong>${eur(rep.usciteTotale)}</strong></p>` : '<p class="nota">Nessuna uscita in arrivo.</p>'}
    </section>
    <p class="nota" style="margin:0 16px 16px">I mesi futuri sono stimati con l'orario programmato e le tabelle in vigore; ferie, malattie e straordinari futuri non sono prevedibili.</p>`}`;

  root.querySelector('[name=anno]').addEventListener('change', (e) => { annoScelto = Number(e.target.value); mostraReport(root, { vai }); });
  root.querySelector('[name=ambito]')?.addEventListener('change', (e) => { ambito = e.target.value; mostraReport(root, { vai }); });
  root.querySelector('.stampa-report')?.addEventListener('click', () => stampaReport(rep, annoScelto, nomi));
}

function stampaReport(rep, anno, nomi) {
  const d = app.rapporto.dati;
  apriStampa(`Report ${anno}`, `
    <h1>Report ${anno} · lavoro domestico</h1>
    <p class="meta">${esc(d.datore.nome)} · ${nomi.map(esc).join(', ')} · aggiornato al ${dataIt(oggiIso())}</p>
    <table class="dati">
      <tr><td>Costo previsto per l'anno</td><td class="num"><strong>${eur(rep.previsione.costo)}</strong></td></tr>
      <tr><td>di cui già maturato${rep.ultimoConsuntivo ? ` (fino a ${nomeMeseMaiusc(rep.ultimoConsuntivo.mese).toLowerCase()})` : ''}</td><td class="num">${eur(rep.consuntivo.costo)}</td></tr>
      ${rep.costoAnnoPrecedente != null ? `<tr><td>Costo dell'anno precedente</td><td class="num">${eur(rep.costoAnnoPrecedente)}</td></tr>` : ''}
      <tr><td>Costo medio mensile</td><td class="num">${eur(rep.costoMedioMensile)}</td></tr>
      <tr><td>Costo per ora lavorata</td><td class="num">${rep.costoOrario != null ? eur(rep.costoOrario) : '—'}</td></tr>
      <tr><td>Netto pagato</td><td class="num">${eur(rep.consuntivo.netto)}</td></tr>
      <tr><td>Contributi da versare nell'anno</td><td class="num">${eur(rep.previsione.contributiDovuti)}</td></tr>
    </table>
    <h2>Composizione del costo previsto</h2>
    <table class="dati compatta">
      <tr><td>Retribuzione</td><td class="num">${eur(rep.previsione.retribuzione)}</td></tr>
      <tr><td>Tredicesima</td><td class="num">${eur(rep.previsione.tredicesima)}</td></tr>
      <tr><td>Contributi a carico del datore</td><td class="num">${eur(rep.previsione.contributi)}</td></tr>
      <tr><td>TFR</td><td class="num">${eur(rep.previsione.tfr)}</td></tr>
    </table>
    <h2>Mese per mese</h2>
    <table class="dati compatta">
      <thead><tr><th>Mese</th><th></th><th class="num">Ore</th><th class="num">Netto €</th><th class="num">Costo €</th></tr></thead>
      <tbody>${rep.mesi.map((m) => `<tr><td>${nomeMeseMaiusc(m.mese)}</td><td>${m.consuntivo ? '' : 'stima'}</td><td class="num">${num(m.ore)}</td><td class="num">${num(m.netto)}</td><td class="num">${num(m.costo)}</td></tr>`).join('')}</tbody>
    </table>
    <h2>Maturato verso la lavoratrice</h2>
    <table class="dati compatta">
      <tr><td>TFR accantonato</td><td class="num">${eur(rep.impegni.tfr)}</td></tr>
      <tr><td>Ferie non godute (${num(rep.impegni.ferieOre, 1)} h)</td><td class="num">${eur(rep.impegni.ferie)}</td></tr>
      <tr><td>Tredicesima maturata</td><td class="num">${eur(rep.impegni.tredicesima)}</td></tr>
      <tr class="tot"><td>Totale</td><td class="num">${eur(rep.impegni.totale)}</td></tr>
    </table>
    <h2>Uscite dei prossimi 90 giorni</h2>
    <table class="dati compatta">${rep.uscite.map((u) => `<tr><td>${dataIt(u.data)}</td><td>${esc(u.titolo)}</td><td class="num">${eur(u.importo)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="2">Totale</td><td class="num">${eur(rep.usciteTotale)}</td></tr></table>
    <p class="piccolo">I mesi indicati come stima sono calcolati sull'orario programmato e sulle tabelle in vigore.</p>`);
}

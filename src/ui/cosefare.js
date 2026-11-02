// Cose da fare: percorso a tappe del mese, prossime scadenze e percorsi guidati
// (ferie, malattia, fine rapporto). Gli stati si calcolano dai dati; i passi che
// l'app non può verificare si segnano a mano.
import { app, catenaCorrente, puoModificare, esc, dataIt, oggiIso, eur, toast } from '../stato.js';
import { percorsoMese, scadenzeDaFare, prossimaCosa, passoAttuale, percorsoFerie, percorsoMalattia, percorsoFine, percorsoInizio } from '../engine/workflow.js';
const stampaLetteraAssunzione = async (...a) => (await import('./stampe.js')).stampaLetteraAssunzione(...a);
const stampaPrivacy = async (...a) => (await import('./stampe.js')).stampaPrivacy(...a);
import { generaScadenze } from '../engine/scadenze.js';
import { segnaScadenza } from '../lib/dati.js';
import { apriBonifico } from './bonifico.js';
const stampaCedolino = async (...a) => (await import('./stampe.js')).stampaCedolino(...a);
const apriLettera = async (...a) => (await import('./lettere.js')).apriLettera(...a);
const apriPratica = async (...a) => (await import('./pratiche.js')).apriPratica(...a);
import { apriSchedaImpostazioni } from './schede.js';
import { apriMese } from './mesi.js';
import { ICONE } from './icone.js';

let aperto = null; // percorso guidato aperto: 'ferie' | 'malattia' | 'fine'

const ETICHETTE = { fatto: 'Fatto', ritardo: 'In ritardo', ora: 'Da fare', corso: 'In corso', attesa: 'Più avanti' };

/** Dati comuni a pagina e Riepilogo. */
export function datiCoseDaFare() {
  const d = app.rapporto?.dati;
  const oggi = oggiIso();
  const catena = catenaCorrente();
  if (!d || !catena.length) return { catena, percorso: null, scadenze: [], prossima: null };
  const percorso = percorsoMese(d, catena, { ore: app.ore, fatte: app.fatte, oggi });
  const scadenze = scadenzeDaFare(d, catena, { fatte: app.fatte, oggi });
  return { catena, percorso, scadenze, prossima: prossimaCosa(percorso, scadenze) };
}

/** Scheda "Prossima cosa da fare" per il Riepilogo. */
export function cardProssima() {
  const { prossima, percorso } = datiCoseDaFare();
  if (!prossima) return '';
  return `
    <button type="button" class="card prossima stato-${prossima.stato}" data-vai="cosefare">
      <span class="prossima-testa"><span class="etichetta">Prossima cosa da fare</span>
        ${percorso ? `<span class="nota-breve">${percorso.fatti} di ${percorso.passi.length} · ${esc(percorso.titolo)}</span>` : ''}</span>
      <strong>${esc(prossima.titolo)}</strong>
      <span class="sotto">${esc(prossima.dettaglio)}</span>
      <span class="prossima-link">Tutte le cose da fare ${ICONE.chevron}</span>
    </button>`;
}

function htmlPercorso(passi, { conIndice = true } = {}) {
  const attuale = passoAttuale(passi);
  const mod = puoModificare();
  return `<ol class="percorso">
    ${passi.map((p, i) => {
      const segno = p.stato === 'fatto' ? ICONE.spunta1 : p.stato === 'ritardo' ? '!' : conIndice ? i + 1 : '';
      const evid = p === attuale;
      const bottoni = [
        p.azione && p.stato !== 'fatto' ? `<button type="button" class="${evid ? 'primario' : 'secondario'} piccolo" data-az="${i}:1">${esc(p.azione.etichetta)}</button>` : '',
        p.azione2 && p.stato !== 'fatto' ? `<button type="button" class="secondario piccolo" data-az="${i}:2">${esc(p.azione2.etichetta)}</button>` : '',
        p.manuale && mod && p.stato !== 'attesa' ? `<button type="button" class="link piccolo" data-man="${esc(p.manuale)}">${app.fatte.has(p.manuale) ? 'Segna da fare' : 'Segna fatto'}</button>` : '',
      ].join('');
      return `<li class="tappa ${p.stato}${evid ? ' attuale' : ''}">
        <span class="tappa-punto" aria-hidden="true">${segno}</span>
        <div class="tappa-corpo">
          <div class="tappa-titolo"><strong>${esc(p.titolo)}</strong><span class="sr-only"> · ${ETICHETTE[p.stato]}</span>${p.stato === 'ritardo' ? '<span class="pillola rifiutata">In ritardo</span>' : ''}</div>
          <p class="tappa-dettaglio">${esc(p.dettaglio)}</p>
          ${bottoni.trim() ? `<div class="tappa-azioni">${bottoni}</div>` : ''}
        </div>
      </li>`;
    }).join('')}
  </ol>`;
}

export function mostraCoseDaFare(root, ctx) {
  const d = app.rapporto?.dati;
  if (!d) { ctx.vai('impostazioni'); return; }
  const oggi = oggiIso();
  const { catena, percorso, scadenze } = datiCoseDaFare();
  if (!catena.length || oggi < d.dataAssunzione) {
    mostraPreparazione(root, ctx);
    return;
  }
  const guidati = {
    ferie: () => percorsoFerie(d, catena, { richieste: app.richieste, fatte: app.fatte, oggi }),
    malattia: () => percorsoMalattia(d, catena, { documenti: app.documenti, fatte: app.fatte, oggi }),
    fine: () => percorsoFine(d, catena, { fatte: app.fatte, oggi }),
    inizio: () => percorsoInizio(d, { fatte: app.fatte, oggi, accessoLavoratrice: haAccessoLavoratrice() }),
  };
  // un pallino sulle tessere dei percorsi già in corso
  const attivi = {
    ferie: app.richieste.some((r) => r.tipo === 'F' && (r.stato === 'in attesa' || (r.stato === 'approvata' && r.al >= oggi))),
    malattia: guidati.malattia().titolo !== 'Malattia',
    fine: !!d.dataCessazione,
    inizio: percorsoInizio(d, { fatte: app.fatte, oggi, accessoLavoratrice: haAccessoLavoratrice() }).passi.some((p) => p.stato === 'ora' || p.stato === 'ritardo'),
  };
  if (!aperto && attivi.fine) aperto = 'fine';
  const guidato = aperto ? guidati[aperto]() : null;
  const pct = percorso ? Math.round((percorso.fatti / percorso.passi.length) * 100) : 0;

  root.innerHTML = `
    <h1 class="titolo-pagina">Cose da fare</h1>
    <div class="griglia-cose">
      <section class="card">
        ${percorso ? `
          <div class="card-testa"><h2>${esc(percorso.titolo)}</h2><span class="nota-breve">${percorso.fatti} di ${percorso.passi.length}</span></div>
          <div class="avanzamento" role="progressbar" aria-valuemin="0" aria-valuemax="${percorso.passi.length}" aria-valuenow="${percorso.fatti}" aria-label="Avanzamento del mese"><span style="width:${pct}%"></span></div>
          ${htmlPercorso(percorso.passi)}
          ${percorso.senzaFirma.length ? `<div class="senza-firma"><p class="nota">Ricevute non ancora firmate: ${percorso.senzaFirma.map((x) => esc(x.titolo)).join(', ')}.</p>
            ${puoModificare() ? percorso.senzaFirma.map((x) => `<button type="button" class="link piccolo" data-man="${esc(x.chiave)}">${esc(x.titolo)}: firmata su carta</button>`).join('') : ''}</div>` : ''}`
        : '<p class="vuoto">Nessun mese da seguire.</p>'}
      </section>

      <div class="colonna-cose">
        <section class="card">
          <div class="card-testa"><h2>Prossime scadenze</h2><button type="button" class="link" data-vai="scadenze">Tutte</button></div>
          <ul class="lista-cose">
            ${scadenze.map((s) => `<li class="${s.stato}"><span class="pallino" aria-hidden="true"></span>
              <span class="cosa">${esc(s.titolo)}${s.importo != null ? ` · <strong>${eur(s.importo)}</strong>` : ''}</span>
              <span class="data">${s.stato === 'ritardo' ? 'scaduta ' : ''}${dataIt(s.data)}</span></li>`).join('') || '<li class="attesa"><span class="cosa">Nessuna scadenza in arrivo.</span></li>'}
          </ul>
        </section>

        <section class="card">
          <h2>Avvia un percorso</h2>
          <div class="tessere-percorsi">
            ${[['inizio', 'spunta', 'Inizio rapporto'], ['ferie', 'valigia', 'Ferie'], ['malattia', 'croce', 'Malattia'], ['fine', 'esci', 'Fine rapporto']].map(([k, ic, n]) => `
              <button type="button" class="tessera-percorso" data-percorso="${k}" ${aperto === k ? 'aria-pressed="true"' : 'aria-pressed="false"'}>
                ${ICONE[ic]}<span>${n}</span>${attivi[k] ? '<span class="punto-attivo" aria-label="in corso"></span>' : ''}</button>`).join('')}
          </div>
        </section>
      </div>
    </div>

    ${guidato ? `<section class="card percorso-guidato">
      <div class="card-testa"><h2>${esc(guidato.titolo)}</h2><button type="button" class="link chiudi-percorso">Chiudi</button></div>
      ${htmlPercorso(guidato.passi)}
    </section>` : ''}
    <dialog class="dlg-lettera"></dialog>`;

  const ridisegna = () => mostraCoseDaFare(root, ctx);
  const passiDi = (box) => (box.closest('.percorso-guidato') ? guidato.passi : percorso.passi);
  collegaAzioni(root, ctx, catena, passiDi, ridisegna);

  root.querySelectorAll('[data-vai]').forEach((b) => b.addEventListener('click', () => ctx.vai(b.dataset.vai)));
  root.querySelectorAll('[data-percorso]').forEach((b) => b.addEventListener('click', () => {
    aperto = aperto === b.dataset.percorso ? null : b.dataset.percorso;
    ridisegna();
    if (aperto) root.querySelector('.percorso-guidato')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  root.querySelector('.chiudi-percorso')?.addEventListener('click', () => { aperto = null; ridisegna(); });

}

function collegaAzioni(root, ctx, catena, passiDi, ridisegna) {
  root.querySelectorAll('[data-az]').forEach((b) => b.addEventListener('click', () => {
    const [i, n] = b.dataset.az.split(':').map(Number);
    const p = passiDi(b)[i];
    esegui(n === 2 ? p.azione2 : p.azione, ctx, root, catena);
  }));
  root.querySelectorAll('[data-man]').forEach((b) => b.addEventListener('click', async () => {
    const k = b.dataset.man;
    const fatta = !app.fatte.has(k);
    b.disabled = true;
    try {
      await segnaScadenza(app.rapporto.id, k, fatta);
      if (fatta) app.fatte.add(k); else app.fatte.delete(k);
      toast(fatta ? 'Segnato come fatto' : 'Riaperto');
    } catch (e) {
      toast(`Errore: ${e.message}`, 'ko');
    }
    ridisegna();
  }));
}

/** Prima dell'assunzione: conto alla rovescia e percorso "Inizio rapporto". */
export function haAccessoLavoratrice() {
  return !!app.rapporto?.accessoLavoratrice || app.fatte.has('wf-inizio-accesso');
}

export function cardPreparazione() {
  const d = app.rapporto?.dati;
  if (!d?.dataAssunzione) return '';
  const p = percorsoInizio(d, { fatte: app.fatte, oggi: oggiIso(), accessoLavoratrice: haAccessoLavoratrice() });
  if (p.giorni <= 0) return '';
  const fatti = p.passi.filter((x) => x.stato === 'fatto').length;
  const prossimo = passoAttuale(p.passi);
  return `<button type="button" class="card prossima conto-rovescia stato-${prossimo?.stato || 'fatto'}" data-vai="cosefare">
    <span class="prossima-testa"><span class="etichetta">Si comincia il ${dataIt(d.dataAssunzione)}</span><span class="nota-breve">${fatti} di ${p.passi.length} pronti</span></span>
    <span class="giorni-mancanti"><strong>${p.giorni}</strong> ${p.giorni === 1 ? 'giorno' : 'giorni'}</span>
    ${prossimo ? `<span class="sotto">Prossimo passo: ${esc(prossimo.titolo)}</span>` : ''}
    <span class="prossima-link">Prepara l'inizio ${ICONE.chevron}</span>
  </button>`;
}

function mostraPreparazione(root, ctx) {
  const d = app.rapporto.dati;
  const oggi = oggiIso();
  const p = percorsoInizio(d, { fatte: app.fatte, oggi, accessoLavoratrice: haAccessoLavoratrice() });
  const fatti = p.passi.filter((x) => x.stato === 'fatto').length;
  const prossime = generaScadenze(d, [], oggi, app.fatte).filter((s) => !s.fatta && s.data >= oggi).slice(0, 4);
  root.innerHTML = `
    <h1 class="titolo-pagina">Cose da fare</h1>
    <div class="griglia-cose">
      <section class="card">
        <div class="card-testa"><h2>${esc(p.titolo)}</h2><span class="nota-breve">${fatti} di ${p.passi.length}</span></div>
        <div class="avanzamento" role="progressbar" aria-valuemin="0" aria-valuemax="${p.passi.length}" aria-valuenow="${fatti}" aria-label="Preparazione"><span style="width:${Math.round((fatti / p.passi.length) * 100)}%"></span></div>
        ${htmlPercorso(p.passi)}
        <p class="nota">Se l'inizio slitta, cambia la data in Impostazioni → Rapporto: tappe, scadenze e promemoria si spostano da soli.</p>
      </section>
      <div class="colonna-cose">
        <section class="card conto">
          <span class="etichetta">Mancano</span>
          <span class="giorni-mancanti"><strong>${Math.max(0, p.giorni)}</strong> ${p.giorni === 1 ? 'giorno' : 'giorni'}</span>
          <small>al ${dataIt(d.dataAssunzione)}</small>
        </section>
        <section class="card">
          <div class="card-testa"><h2>Prime scadenze</h2><button type="button" class="link" data-vai="scadenze">Tutte</button></div>
          <ul class="lista-cose">${prossime.map((s) => `<li class="attesa"><span class="pallino" aria-hidden="true"></span><span class="cosa">${esc(s.titolo)}</span><span class="data">${dataIt(s.data)}</span></li>`).join('') || '<li class="attesa"><span class="cosa">Nessuna.</span></li>'}</ul>
        </section>
      </div>
    </div>
    <dialog class="dlg-lettera"></dialog>`;
  root.querySelectorAll('[data-vai]').forEach((b) => b.addEventListener('click', () => ctx.vai(b.dataset.vai)));
  collegaAzioni(root, ctx, [], () => p.passi, () => mostraPreparazione(root, ctx));
}

function esegui(a, ctx, root, catena) {
  if (!a) return;
  switch (a.tipo) {
    case 'mese': apriMese(a.anno, a.mese); ctx.vai('mesi'); break;
    case 'presenze': ctx.vai('mesi'); break;
    case 'bonifico': apriBonifico({ anno: a.anno, mese: a.mese, importo: a.importo }); break;
    case 'stampa': {
      const m = catena.find((x) => x.anno === a.anno && x.mese === a.mese);
      if (m) stampaCedolino(m, m.salvato);
      break;
    }
    case 'lettera': apriLettera(root.querySelector('.dlg-lettera'), a.chiave); break;
    case 'pratica': apriPratica(a.chiave); break;
    case 'impostazioni': apriSchedaImpostazioni(a.scheda); ctx.vai('impostazioni'); break;
    case 'vai': ctx.vai(a.dest); break;
    case 'stampa-assunzione': stampaLetteraAssunzione(); break;
    case 'stampa-privacy': stampaPrivacy(); break;
    default: break;
  }
}

// Registro delle modifiche: chi ha cambiato cosa e quando (tabella "registro", script 06).
import { app, esc } from '../stato.js';
import { caricaRegistro } from '../lib/dati.js';
import { nomeMese } from '../engine/scadenze.js';

const TABELLE = {
  rapporti: 'Dati del rapporto', cedolini: 'Presenze e cedolino', scadenze_fatte: 'Scadenza', tabelle_annuali: 'Tabelle annuali',
  versamenti: 'Versamento INPS', documenti: 'Documento', richieste: 'Richiesta di ferie o permesso', ore_segnate: 'Ore segnate', accessi: 'Accesso',
};
const AZIONI = { INSERT: 'aggiunto', UPDATE: 'modificato', DELETE: 'eliminato' };
const CAMPI = {
  pagaOraria: 'paga oraria', pagaMensile: 'paga mensile', livello: 'livello', orario: 'orario', tipologia: 'tipo di rapporto', tipoContratto: 'tipo di contratto',
  dataAssunzione: 'data di assunzione', dataCessazione: 'data di cessazione', datore: 'dati del datore', lavoratrice: 'dati della lavoratrice', pagamento: 'pagamento',
  variazioni: 'variazioni', agevolazioni: 'agevolazioni', detrazione: 'detrazione', budgetAnnuo: 'budget', documentiAssistito: 'documenti dell\'assistito',
  scattiAnzianita: 'scatti di anzianità', cassaColf: 'Cassa Colf', presenze: 'presenze', risultato: 'importi', stato: 'stato', pagato_at: 'data di pagamento',
  ricevuta_at: 'firma della ricevuta', ore: 'ore', importo: 'importo', data_pagamento: 'data di pagamento', visibile: 'visibilità', risposta: 'risposta',
};
const STATI = { bozza: 'bozza', confermato: 'confermato', pagato: 'pagato', 'in attesa': 'in attesa', approvata: 'approvata', rifiutata: 'rifiutata', approvato: 'approvata', rifiutato: 'rifiutata' };

function oggetto(r) {
  if (!r.oggetto) return '';
  if (r.tabella === 'cedolini') { const [a, m] = r.oggetto.split('-').map(Number); return `${nomeMese(m)} ${a}`; }
  if (r.tabella === 'ore_segnate') return r.oggetto.split('-').reverse().join('/');
  return r.oggetto;
}

function descrizione(r) {
  const d = r.dettaglio || {};
  const parti = [];
  if (r.azione === 'UPDATE' && d.stato_prima) parti.push(`da ${STATI[d.stato_prima] || d.stato_prima} a ${STATI[d.stato] || d.stato}`);
  else if (r.azione === 'UPDATE' && r.campi?.length) parti.push(r.campi.map((c) => CAMPI[c] || c).join(', '));
  else if (d.stato && r.azione === 'INSERT') parti.push(STATI[d.stato] || d.stato);
  if (d.ore != null) parti.push(`${String(d.ore).replace('.', ',')} h`);
  if (d.importo != null) parti.push(`${Number(d.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €`);
  if (d.ruolo) parti.push(`ruolo ${d.ruolo}`);
  return parti.join(' · ');
}

const fmtGiorno = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtOra = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

export async function mostraRegistro(root) {
  root.innerHTML = '<p class="caricamento">Caricamento…</p>';
  let righe;
  try {
    righe = await caricaRegistro(app.rapporto.id);
  } catch (e) {
    root.innerHTML = `<div class="avviso attenzione">Il registro delle modifiche non è ancora attivo nel database: esegui lo script <code>supabase/06_registro.sql</code> nel SQL Editor di Supabase. Da quel momento ogni modifica viene annotata.</div>`;
    return;
  }
  const disegna = () => {
    const perGiorno = new Map();
    for (const r of righe) {
      const g = fmtGiorno.format(new Date(r.quando));
      if (!perGiorno.has(g)) perGiorno.set(g, []);
      perGiorno.get(g).push(r);
    }
    root.innerHTML = `
      <p class="nota">Ogni modifica fatta da chi ha accesso al rapporto, con l'ora e l'autore. Le righe non si possono cancellare dall'app.</p>
      ${righe.length ? [...perGiorno].map(([g, lista]) => `
        <h2 class="testa-gruppo">${esc(g)}</h2>
        <ul class="gruppo registro">
          ${lista.map((r) => `<li class="riga-info registro-riga">
            <span class="ora">${fmtOra.format(new Date(r.quando))}</span>
            <span class="corpo"><strong>${esc(TABELLE[r.tabella] || r.tabella)}${oggetto(r) ? ` · ${esc(oggetto(r))}` : ''}</strong> ${AZIONI[r.azione]}
              ${descrizione(r) ? `<br><small>${esc(descrizione(r))}</small>` : ''}<br><small class="chi">${esc(r.chi || '')}</small></span>
          </li>`).join('')}
        </ul>`).join('') : '<p class="vuoto">Nessuna modifica registrata finora.</p>'}
      ${righe.length && righe.length % 100 === 0 ? '<button type="button" class="secondario altre">Mostra modifiche precedenti</button>' : ''}`;
    root.querySelector('.altre')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      righe = righe.concat(await caricaRegistro(app.rapporto.id, { prima: righe[righe.length - 1].quando }));
      disegna();
    });
  };
  disegna();
}

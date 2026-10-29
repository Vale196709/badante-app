// Backup: copia completa dei dati (con o senza i file dell'archivio), cedolini per Excel,
// ripristino con anteprima nel rapporto attuale o come nuovo rapporto.
import { app, isTitolare, catenaCorrente, oggiIso, toast, esc, dataIt, nomeRapporto } from '../stato.js';
import { esportaTutto, importaTutto, descriviBackup } from '../lib/dati.js';
import { fmtNum } from '../engine/formato.js';
import { VERSIONE } from '../novita.js';

function scarica(nome, contenuto, tipo) {
  const blob = new Blob([contenuto], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function csvCedolini() {
  const righe = [['Anno', 'Mese', 'Stato', 'Ore lavorate', 'Ore INPS', 'Lordo', 'Trattenute', 'Netto', 'Contributi da versare', 'Costo datore', 'TFR del mese', 'Ferie residue (ore)', 'Pagato il']];
  for (const m of catenaCorrente()) {
    const r = m.risultato;
    righe.push([m.anno, m.mese, m.stato, fmtNum(r.oreLavorate), fmtNum(r.contributi.oreContributive), fmtNum(r.lordo), fmtNum(r.totaleTrattenute),
      fmtNum(r.netto), fmtNum(r.contributi.daVersareAInps), fmtNum(r.costoDatore), fmtNum(r.accantonamenti.tfrMese), fmtNum(r.contatori.ferieResidueOre),
      m.salvato?.pagato_at ? m.salvato.pagato_at.split('-').reverse().join('/') : '']);
  }
  return '﻿' + righe.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

const nomeFile = () => `badante-di-maria-${(nomeRapporto(app.rapporto) || 'rapporto').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${oggiIso()}`;

export function mostraBackup(root) {
  const haRapporto = !!app.rapporto?.id;
  const puoRipristinare = isTitolare() || !haRapporto;
  root.innerHTML = `
    ${haRapporto ? `<section class="card">
      <h2>Scarica una copia</h2>
      <p class="nota" style="margin:-4px 0 12px">Conserva la copia sul computer o su un disco esterno, per esempio una volta al mese.</p>
      <label class="spunta"><input type="checkbox" name="conFile" ${app.documenti.length ? 'checked' : 'disabled'} /> Includi i file dell'archivio (${app.documenti.length})</label>
      <div class="azioni-mese">
        <button type="button" class="primario" data-a="json">Backup completo</button>
        <button type="button" class="secondario" data-a="csv">Cedolini per Excel</button>
      </div>
      <p class="esito esito-export" role="status"></p>
    </section>` : ''}
    ${puoRipristinare ? `<section class="card">
      <h2>Ripristina da un backup</h2>
      <p class="nota" style="margin:-4px 0 12px">Scegli un file di backup scaricato da questa app: prima di ripristinare ti mostro cosa contiene.</p>
      <label>File di backup (.json)<input type="file" name="file" accept=".json,application/json" /></label>
      <div class="anteprima-backup"></div>
    </section>` : ''}`;

  root.querySelector('[data-a=json]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const esito = root.querySelector('.esito-export');
    btn.disabled = true;
    try {
      const conFile = root.querySelector('[name=conFile]')?.checked;
      const dati = await esportaTutto(app.rapporto, { includiFile: conFile, versioneApp: VERSIONE, avanzamento: (t) => { esito.textContent = t; } });
      scarica(`${nomeFile()}.json`, JSON.stringify(dati), 'application/json');
      esito.textContent = `Backup scaricato${conFile ? ' con i file' : ''}.`;
    } catch (err) { esito.innerHTML = `<span class="ko">Errore: ${esc(err.message)}</span>`; }
    finally { btn.disabled = false; }
  });
  root.querySelector('[data-a=csv]')?.addEventListener('click', () => scarica(`${nomeFile()}-cedolini.csv`, csvCedolini(), 'text/csv;charset=utf-8'));

  const box = root.querySelector('.anteprima-backup');
  root.querySelector('[name=file]')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let b, info;
    try {
      b = JSON.parse(await file.text());
      info = descriviBackup(b);
    } catch (err) {
      box.innerHTML = `<div class="avviso grave">${esc(err.message.includes('JSON') ? 'Il file non è leggibile come backup.' : err.message)}</div>`;
      return;
    }
    box.innerHTML = `
      <dl class="tabella-dl">
        <div><dt>Copia del</dt><dd>${dataIt(info.data)} ${new Date(info.data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</dd></div>
        ${info.versioneApp ? `<div><dt>Versione dell'app</dt><dd>${esc(info.versioneApp)}</dd></div>` : ''}
        <div><dt>Lavoratrice</dt><dd>${esc(info.lavoratrice)}</dd></div>
        <div><dt>Assunzione</dt><dd>${dataIt(info.assunzione)}</dd></div>
        <div><dt>Cedolini</dt><dd>${info.cedolini}</dd></div>
        <div><dt>Versamenti registrati</dt><dd>${info.versamenti}</dd></div>
        <div><dt>File dell'archivio</dt><dd>${info.documenti ? `${info.conFile} di ${info.documenti} con il contenuto` : 'nessuno'}</dd></div>
      </dl>
      <div class="azioni-mese" style="margin-top:14px">
        ${haRapporto && isTitolare() ? `<button type="button" class="secondario" data-r="attuale">Sostituisci ${esc(nomeRapporto(app.rapporto))}</button>` : ''}
        <button type="button" class="primario" data-r="nuovo">Ripristina come nuovo rapporto</button>
      </div>
      <p class="nota">"Sostituisci" sovrascrive dati, cedolini, tabelle e versamenti del rapporto aperto con quelli del backup. "Come nuovo rapporto" lascia intatto quello attuale e ne crea un altro. Le firme di ricevuta non vengono ripristinate.</p>
      <p class="esito esito-import" role="status"></p>`;
    box.querySelectorAll('[data-r]').forEach((btn) => btn.addEventListener('click', async () => {
      const nuovo = btn.dataset.r === 'nuovo';
      const domanda = nuovo
        ? `Creare un nuovo rapporto per ${info.lavoratrice} con i dati del backup?`
        : `Sostituire i dati di ${nomeRapporto(app.rapporto)} con quelli del backup del ${dataIt(info.data)}? L'operazione non si può annullare: se vuoi, scarica prima un backup di sicurezza.`;
      if (!confirm(domanda)) return;
      const esito = box.querySelector('.esito-import');
      box.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      try {
        const { rapporto, fileRipristinati } = await importaTutto(nuovo ? null : app.rapporto.id, b, { avanzamento: (t) => { esito.textContent = t; } });
        try { localStorage.setItem('badante-rapporto', rapporto.id); } catch { /* */ }
        esito.textContent = `Ripristino completato${fileRipristinati ? `, ${fileRipristinati} file caricati` : ''}. Riapro l'app…`;
        toast('Ripristino completato');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        esito.innerHTML = `<span class="ko">Errore: ${esc(err.message)}</span>`;
        box.querySelectorAll('button').forEach((x) => { x.disabled = false; });
      }
    }));
  });
}

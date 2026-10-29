// Backup: scarica tutti i dati (JSON), i cedolini per Excel (CSV) e ripristina da backup.
import { app, isTitolare, catenaCorrente, oggiIso, toast, esc } from '../stato.js';
import { esportaTutto, importaTutto } from '../lib/dati.js';
import { fmtNum } from '../engine/formato.js';

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
  // separatore ";" e virgola decimale: si apre correttamente con Excel in italiano
  return '﻿' + righe.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

export function mostraBackup(root) {
  root.innerHTML = `
    <section class="card">
      <h2>Scarica una copia</h2>
      <p class="nota">Conserva una copia dei dati sul computer o su un disco esterno, per esempio una volta al mese. I file caricati nell'archivio documenti non sono inclusi: restano su Supabase e si scaricano dalla sezione Documenti.</p>
      <div class="azioni-mese">
        <button type="button" class="primario" data-a="json">Backup completo (.json)</button>
        <button type="button" class="secondario" data-a="csv">Cedolini per Excel (.csv)</button>
      </div>
    </section>
    ${isTitolare() ? `
    <section class="card">
      <h2>Ripristina da un backup</h2>
      <p class="nota">Ricarica un backup scaricato da questa app: i dati del rapporto, i cedolini, le tabelle, le scadenze completate e i versamenti del file sostituiscono quelli attuali con lo stesso mese o anno. Le firme di ricevuta non vengono ripristinate.</p>
      <label>File di backup<input type="file" name="file" accept=".json,application/json" /></label>
      <p class="esito" role="status"></p>
    </section>` : ''}`;

  root.querySelector('[data-a=json]').addEventListener('click', async () => {
    try {
      const dati = await esportaTutto(app.rapporto);
      scarica(`badante-backup-${oggiIso()}.json`, JSON.stringify(dati, null, 2), 'application/json');
      toast('Backup scaricato');
    } catch (e) { toast(`Errore: ${e.message}`, 'ko'); }
  });
  root.querySelector('[data-a=csv]').addEventListener('click', () => {
    scarica(`badante-cedolini-${oggiIso()}.csv`, csvCedolini(), 'text/csv;charset=utf-8');
  });
  root.querySelector('[name=file]')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const esito = root.querySelector('.esito');
    if (!file) return;
    try {
      const b = JSON.parse(await file.text());
      if (b?.formato !== 'badante-backup') throw new Error('Il file non è un backup di questa app.');
      const quando = new Date(b.esportato_il).toLocaleDateString('it-IT');
      if (!confirm(`Ripristinare il backup del ${quando} con ${b.cedolini?.length ?? 0} cedolini? I dati attuali corrispondenti verranno sostituiti.`)) { e.target.value = ''; return; }
      esito.textContent = 'Ripristino in corso…';
      await importaTutto(app.rapporto?.id, b);
      esito.textContent = 'Ripristino completato: ricarico l\'app…';
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      esito.innerHTML = `<span class="ko">Errore: ${esc(err.message)}</span>`;
    }
  });
}

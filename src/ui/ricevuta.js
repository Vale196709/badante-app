// Legge una ricevuta di pagamento dei contributi (PDF o foto) e registra il versamento.
import { app, eur, esc, oggiIso, toast, dataIt } from '../stato.js';
import { leggiRicevuta } from '../engine/ricevuta.js';
import { salvaVersamento, segnaScadenza, caricaVersamenti, caricaFile, caricaDocumenti } from '../lib/dati.js';

const BASE = import.meta.env.BASE_URL;

export async function testoDaPdf(file, avanzamento) {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let testo = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const c = await (await pdf.getPage(p)).getTextContent();
    testo += c.items.map((i) => i.str + (i.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  if (testo.replace(/\s/g, '').length > 20) return testo;
  // PDF scansionato: si legge la prima pagina come immagine
  avanzamento('PDF senza testo: leggo l\'immagine…');
  const pagina = await pdf.getPage(1);
  const vista = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = vista.width; canvas.height = vista.height;
  await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
  return testoDaImmagine(canvas, avanzamento);
}

async function testoDaImmagine(immagine, avanzamento) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ita', 1, {
    workerPath: `${BASE}ocr/worker.min.js`,
    corePath: `${BASE}ocr/`,
    langPath: `${BASE}ocr/lang`,
    gzip: true,
    logger: (m) => { if (m.status === 'recognizing text') avanzamento(`Leggo la ricevuta… ${Math.round(m.progress * 100)}%`); },
  });
  try {
    const { data } = await worker.recognize(immagine);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export async function testoRicevuta(file, avanzamento = () => {}) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return testoDaPdf(file, avanzamento);
  avanzamento('Preparo la lettura della foto (la prima volta può richiedere qualche secondo)…');
  return testoDaImmagine(file, avanzamento);
}

/**
 * Apre la finestra "Leggi una ricevuta".
 * @param trimestri [{ anno, trimestre, importo, data }] dalle scadenze INPS
 */
export function apriLetturaRicevuta(trimestri, alSalvataggio) {
  let dlg = document.querySelector('dialog.dlg-ricevuta');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'dlg-bonifico dlg-ricevuta'; document.body.appendChild(dlg); }
  dlg.innerHTML = `
    <form method="dialog" class="bonifico">
      <h2>Leggi una ricevuta</h2>
      <p class="nota">Scegli il PDF della ricevuta pagoPA o fai una foto: leggo importo, data e trimestre, poi controlli e confermi. La lettura avviene sul tuo dispositivo.</p>
      <label class="carica-ricevuta">PDF o foto della ricevuta<input type="file" name="file" accept="application/pdf,image/*" /></label>
      <p class="esito" role="status"></p>
      <div class="dati-ricevuta" hidden>
        <label>Trimestre<select name="trim">${trimestri.map((t) => `<option value="${t.anno}-${t.trimestre}">${t.trimestre}° trimestre ${t.anno} · calcolati ${eur(t.importo)}</option>`).join('')}</select></label>
        <div class="riga">
          <label>Pagato il<input type="date" name="data" max="${oggiIso()}" /></label>
          <label>Importo €<input name="importo" inputmode="decimal" /></label>
        </div>
        <p class="nota confronto"></p>
        <label class="spunta"><input type="checkbox" name="archivia" checked /> Salva la ricevuta in Documenti → Ricevute pagoPA INPS</label>
      </div>
      <div class="azioni-mese">
        <button value="annulla" class="secondario">Annulla</button>
        <button type="button" class="primario registra" disabled>Registra pagamento</button>
      </div>
    </form>`;
  const f = dlg.querySelector('form');
  const esito = dlg.querySelector('.esito');
  const box = dlg.querySelector('.dati-ricevuta');
  const confronto = () => {
    const [a, q] = f.trim.value.split('-').map(Number);
    const t = trimestri.find((x) => x.anno === a && x.trimestre === q);
    const imp = Number(String(f.importo.value).replace(/\./g, '').replace(',', '.'));
    const diff = t && imp > 0 ? imp - t.importo : 0;
    dlg.querySelector('.confronto').innerHTML = t && imp > 0
      ? (Math.abs(diff) < 0.01 ? '✓ Uguale all\'importo calcolato dall\'app.' : `Differenza di <strong>${eur(Math.abs(diff))}</strong> ${diff > 0 ? 'in più' : 'in meno'} rispetto al calcolo (${eur(t.importo)}): controlla ore e fascia del trimestre.`)
      : '';
  };
  f.trim.addEventListener('change', confronto);
  f.importo.addEventListener('input', confronto);

  f.file.addEventListener('change', async () => {
    const file = f.file.files[0];
    if (!file) return;
    esito.textContent = 'Leggo la ricevuta…';
    esito.className = 'esito';
    dlg.querySelector('.registra').disabled = true;
    try {
      const testo = await testoRicevuta(file, (m) => { esito.textContent = m; });
      const r = leggiRicevuta(testo, oggiIso());
      box.hidden = false;
      if (r.data) f.data.value = r.data;
      if (r.importo != null) f.importo.value = r.importo.toFixed(2).replace('.', ',');
      const chiave = `${r.anno}-${r.trimestre}`;
      const trimOk = [...f.trim.options].some((o) => o.value === chiave);
      if (trimOk) f.trim.value = chiave;
      const mancanti = [!r.trovati.importo && 'importo', !r.trovati.data && 'data'].filter(Boolean);
      esito.innerHTML = (mancanti.length
        ? `<span class="ko">Non ho trovato: ${mancanti.join(' e ')}. Inseriscili a mano.</span>`
        : `Letto: ${eur(r.importo)} pagati il ${dataIt(r.data)}${r.trovati.trimestre ? '' : ' (trimestre dedotto dalla data)'}. Controlla e registra.`)
        + (r.trimestre && !trimOk ? `<br><span class="ko">La ricevuta sembra del ${r.trimestre}° trimestre ${r.anno}, che non è tra le scadenze di questo rapporto: scegli il trimestre giusto.</span>` : '');
      dlg.querySelector('.registra').disabled = false;
      confronto();
    } catch (e) {
      box.hidden = false;
      dlg.querySelector('.registra').disabled = false;
      esito.innerHTML = `<span class="ko">Lettura non riuscita (${esc(e.message)}): inserisci i dati a mano.</span>`;
    }
  });

  dlg.querySelector('.registra').addEventListener('click', async (e) => {
    const [anno, trimestre] = f.trim.value.split('-').map(Number);
    const importo = Number(String(f.importo.value).replace(/\./g, '').replace(',', '.'));
    if (!f.data.value || !(importo >= 0)) { toast('Inserisci data e importo', 'ko'); return; }
    e.currentTarget.disabled = true;
    try {
      await salvaVersamento(app.rapporto.id, { anno, trimestre, data_pagamento: f.data.value, importo });
      await segnaScadenza(app.rapporto.id, `inps-${anno}-T${trimestre}`, true);
      app.fatte.add(`inps-${anno}-T${trimestre}`);
      app.versamenti = await caricaVersamenti(app.rapporto.id);
      const file = f.file.files[0];
      if (file && f.archivia.checked) {
        await caricaFile(app.rapporto.id, file, { categoria: 'Ricevute pagoPA INPS', visibile: false, nome: `Ricevuta contributi ${trimestre}° trimestre ${anno}` });
        app.documenti = await caricaDocumenti(app.rapporto.id);
      }
      dlg.close();
      toast(`Pagamento del ${trimestre}° trimestre ${anno} registrato`);
      alSalvataggio();
    } catch (err) {
      toast(`Errore: ${err.message}`, 'ko');
      e.currentTarget.disabled = false;
    }
  });
  dlg.showModal();
}

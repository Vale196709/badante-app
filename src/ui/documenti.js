// Elenco dei documenti stampabili.
import { app, catenaCorrente, oggiIso, dataIt, esc, puoModificare, toast } from '../stato.js';
import { caricaFile, linkFile, aggiornaDocumento, eliminaDocumento, caricaDocumenti } from '../lib/dati.js';

export const CATEGORIE_DOC = ['Contratto e assunzione', 'Ricevute pagoPA INPS', 'Cedolini firmati', 'Certificati di malattia', 'Documenti della lavoratrice', 'Altro'];
const dimensione = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
import { stampaLetteraAssunzione, stampaPrivacy, stampaDichiarazione, stampaProspettoAnnuale, stampaTfr, stampaPacchettoFiscale } from './stampe.js';
import { ICONE, tessera } from './icone.js';
import { LETTERE, apriLettera } from './lettere.js';
import { apriPratica } from './pratiche.js';

export function mostraDocumenti(root, { vai }) {
  const d = app.rapporto?.dati;
  if (!d) { vai('impostazioni'); return; }
  const catena = catenaCorrente();
  const anni = [...new Set(catena.map((m) => m.anno))].sort((a, b) => b - a);
  const annoOggi = Number(oggiIso().slice(0, 4));
  const mancanti = [];
  if (!d.datore.cf) mancanti.push('codice fiscale del datore');
  if (!d.lavoratrice.cf) mancanti.push('codice fiscale della lavoratrice');
  if (!d.lavoratrice.indirizzo) mancanti.push('indirizzo della lavoratrice');

  const voce = (attr, icona, colore, titolo, descr, disabilitato = false) => `
    <li><button type="button" class="riga-lista" ${attr} ${disabilitato ? 'disabled' : ''}>${tessera(icona, colore)}
      <span class="riga-testo">${titolo}<small>${descr}</small></span>${ICONE.chevron}</button></li>`;

  root.innerHTML = `
    <h1 class="titolo-pagina">Documenti</h1>
    ${mancanti.length ? `<div class="avviso attenzione">Per documenti completi mancano: ${mancanti.join(', ')}. Si inseriscono in Impostazioni → Rapporto.</div>` : ''}

    <h2 class="testa-gruppo">Pratiche INPS guidate</h2>
    <ul class="gruppo">
      ${voce('data-pratica="assunzione"', 'inps', '#1e4e8c', 'Assunzione', 'Entro il giorno prima dell\'inizio')}
      ${voce('data-pratica="variazione"', 'inps', '#1e4e8c', 'Variazione di orario o paga', 'Dopo ogni variazione')}
      ${voce('data-pratica="contributi"', 'euro', '#1e4e8c', 'Pagamento dei contributi', 'Ogni trimestre, con i dati da inserire')}
      ${voce('data-pratica="cessazione"', 'inps', '#1e4e8c', 'Cessazione', 'Entro 5 giorni dalla fine del rapporto')}
    </ul>

    <h2 class="testa-gruppo">Contratto</h2>
    <ul class="gruppo">
      ${voce('data-doc="assunzione"', 'documento', '#007aff', 'Lettera di assunzione', `Da firmare in due copie · inizio ${dataIt(d.dataAssunzione)}`)}
      ${voce('data-doc="privacy"', 'scudo', '#007aff', 'Informativa privacy', 'Da consegnare con la lettera di assunzione')}
    </ul>

    <h2 class="testa-gruppo">Lettere pronte</h2>
    <ul class="gruppo">
      ${Object.entries(LETTERE).map(([k, l]) => voce(`data-lettera="${k}"`, 'busta', '#e0a100', esc(l.titolo), esc(l.descr))).join('')}
    </ul>

    <h2 class="testa-gruppo">Ogni anno</h2>
    <section class="card" style="padding-bottom:4px">
      <label>Anno<select name="anno">${anni.map((a) => `<option ${a === (anni.includes(annoOggi - 1) ? annoOggi - 1 : anni[0]) ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    </section>
    <ul class="gruppo">
      ${voce('data-doc="dichiarazione"', 'documento', '#2e9f5a', 'Dichiarazione dei compensi', 'Per la lavoratrice: dichiarazione dei redditi, ISEE, permesso di soggiorno', !anni.length)}
      ${voce('data-doc="annuale"', 'grafico', '#2e9f5a', 'Prospetto costi', 'Per te: costi mese per mese e contributi da dedurre nel 730', !anni.length)}
      ${voce('data-doc="fiscale"', 'euro', '#2e9f5a', 'Pacchetto per commercialista o CAF', 'Deduzione dei contributi, detrazione del 19% e documenti da allegare al 730', !anni.length)}
      ${voce('data-doc="tfr"', 'tabella', '#2e9f5a', 'Prospetto TFR', 'Quote, rivalutazioni e anticipi dall\'assunzione', !catena.length)}
    </ul>
    <p class="nota" style="margin:-6px 16px 18px">Ogni documento si apre in anteprima. "Stampa / PDF" lo stampa o lo salva in PDF; su iPhone: Condividi → Salva su File. I cedolini si stampano dal singolo mese, i conteggi di fine rapporto dal Simulatore.</p>

    <section class="card archivio"></section>
    <dialog class="dlg-lettera"></dialog>`;
  disegnaArchivio(root.querySelector('.archivio'));

  const anno = () => Number(root.querySelector('[name=anno]')?.value);
  root.querySelectorAll('[data-pratica]').forEach((b) => b.addEventListener('click', () => apriPratica(b.dataset.pratica)));
  root.querySelectorAll('[data-lettera]').forEach((b) => b.addEventListener('click', () => apriLettera(root.querySelector('.dlg-lettera'), b.dataset.lettera)));
  root.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => {
    switch (b.dataset.doc) {
      case 'assunzione': return stampaLetteraAssunzione();
      case 'privacy': return stampaPrivacy();
      case 'dichiarazione': return stampaDichiarazione(catena, anno());
      case 'annuale': return stampaProspettoAnnuale(catena, anno());
      case 'fiscale': return stampaPacchettoFiscale(catena, anno());
      case 'tfr': return stampaTfr(catena);
    }
  }));
}

export async function apriFile(doc) {
  // la finestra si apre subito (iPhone blocca le aperture dopo un'attesa), poi riceve il link
  const finestra = window.open('', '_blank');
  try {
    const url = await linkFile(doc.percorso);
    if (finestra) finestra.location = url; else location.href = url;
  } catch (e) {
    finestra?.close();
    toast(`Errore: ${e.message}`, 'ko');
  }
}

function disegnaArchivio(box) {
  const mod = puoModificare();
  const docs = app.documenti;
  const gruppi = CATEGORIE_DOC.map((c) => [c, docs.filter((d) => (CATEGORIE_DOC.includes(d.categoria) ? d.categoria : 'Altro') === c)]).filter(([, l]) => l.length);
  box.innerHTML = `
    <h2>Archivio file</h2>
    <p class="nota">Conserva qui i file del rapporto: ricevute dei versamenti, ricevuta INPS di assunzione, lettera firmata, certificati di malattia, copia dei documenti. Massimo 10 MB per file.</p>
    ${mod ? `<form class="form-carica">
      <label>File (PDF o foto)<input type="file" name="file" accept=".pdf,image/*" required /></label>
      <div class="riga">
        <label>Categoria<select name="categoria">${CATEGORIE_DOC.map((c) => `<option>${c}</option>`).join('')}</select></label>
        <label>Nome (facoltativo)<input name="nome" placeholder="es. Ricevuta 4° trimestre 2026" /></label>
      </div>
      <label class="spunta"><input type="checkbox" name="visibile" /> Visibile anche alla lavoratrice</label>
      <button type="submit" class="primario">Carica</button>
    </form>` : ''}
    ${gruppi.length ? gruppi.map(([c, l]) => `
      <h3 class="sottotitolo">${esc(c)}</h3>
      <ul class="lista-file">${l.map((d) => `
        <li>
          <button type="button" class="link apri" data-id="${d.id}">${esc(d.nome)}</button>
          <small>${dataIt(d.created_at)} · ${d.dimensione ? dimensione(d.dimensione) : ''}${d.visibile_lavoratrice ? ' · visibile alla lavoratrice' : ''}</small>
          ${mod ? `<span class="azioni-file">
            <button type="button" class="link" data-vis="${d.id}">${d.visibile_lavoratrice ? 'Nascondi alla lavoratrice' : 'Condividi con la lavoratrice'}</button>
            <button type="button" class="link ko" data-del="${d.id}">Elimina</button></span>` : ''}
        </li>`).join('')}</ul>`).join('') : '<p class="vuoto">Nessun file caricato.</p>'}`;

  const trova = (id) => docs.find((d) => d.id === id);
  const ricarica = async () => { app.documenti = await caricaDocumenti(app.rapporto.id); disegnaArchivio(box); };
  box.querySelectorAll('.apri').forEach((b) => b.addEventListener('click', () => apriFile(trova(b.dataset.id))));
  box.querySelectorAll('[data-vis]').forEach((b) => b.addEventListener('click', async () => {
    const d = trova(b.dataset.vis);
    try { await aggiornaDocumento(d.id, { visibile_lavoratrice: !d.visibile_lavoratrice }); await ricarica(); } catch (e) { toast(`Errore: ${e.message}`, 'ko'); }
  }));
  box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const d = trova(b.dataset.del);
    if (!confirm(`Eliminare definitivamente "${d.nome}"?`)) return;
    try { await eliminaDocumento(d); await ricarica(); toast('File eliminato'); } catch (e) { toast(`Errore: ${e.message}`, 'ko'); }
  }));
  box.querySelector('.form-carica')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const file = f.file.files[0];
    if (!file) return;
    if (file.size > 10 * 1048576) { toast('Il file supera 10 MB', 'ko'); return; }
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Caricamento…';
    try {
      await caricaFile(app.rapporto.id, file, { categoria: f.categoria.value, visibile: f.visibile.checked, nome: f.nome.value.trim() });
      toast('File caricato');
      await ricarica();
    } catch (err) {
      toast(/bucket|not found/i.test(err.message) ? 'Archivio non ancora attivo: esegui lo script 03 in Supabase' : `Errore: ${err.message}`, 'ko');
      btn.disabled = false; btn.textContent = 'Carica';
    }
  });
}

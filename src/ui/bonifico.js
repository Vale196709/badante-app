// Dati pronti per il bonifico dello stipendio: beneficiario, IBAN, importo, causale e QR code
// (standard europeo EPC "SEPA Credit Transfer", letto da molte app bancarie).
import { app, eur, esc, toast, nomeMeseMaiusc } from '../stato.js';
import { verificaIban, formattaIban, pulisciIban } from '../lib/iban.js';
import { fmtNum } from '../engine/formato.js';

export function causaleStipendio(anno, mese, nome) {
  return `Retribuzione ${nomeMeseMaiusc(mese).toLowerCase()} ${anno} lavoro domestico${nome ? ` - ${nome}` : ''}`;
}

/** Testo del QR EPC (versione 002). */
export function testoQrEpc({ beneficiario, iban, importo, causale }) {
  return ['BCD', '002', '1', 'SCT', '', beneficiario.slice(0, 70), pulisciIban(iban), `EUR${importo.toFixed(2)}`, '', '', causale.slice(0, 140)].join('\n');
}

async function copia(testo) {
  try { await navigator.clipboard.writeText(testo); toast('Copiato'); }
  catch { toast('Copia non riuscita: tieni premuto sul testo per copiarlo', 'ko'); }
}

export async function apriBonifico({ anno, mese, importo }) {
  const d = app.rapporto?.dati || {};
  const p = d.pagamento || {};
  const beneficiario = p.intestatario || d.lavoratrice?.nome || '';
  const ib = p.iban ? verificaIban(p.iban) : { ok: false };
  const causale = causaleStipendio(anno, mese, d.lavoratrice?.nome);
  let dlg = document.querySelector('dialog.dlg-bonifico');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'dlg-bonifico'; document.body.appendChild(dlg); }
  const riga = (et, val, copiabile) => `<div class="riga-copia"><span class="etichetta">${et}</span><span class="valore">${esc(val)}</span>${copiabile ? `<button type="button" class="link" data-copia="${esc(copiabile)}">Copia</button>` : ''}</div>`;
  dlg.innerHTML = `
    <form method="dialog" class="bonifico">
      <h2>Bonifico di ${nomeMeseMaiusc(mese).toLowerCase()} ${anno}</h2>
      ${!ib.ok ? `<div class="avviso attenzione">${p.iban ? 'L\'IBAN salvato non è valido.' : 'Manca l\'IBAN della lavoratrice.'} Inseriscilo in Impostazioni → Rapporto → Pagamento dello stipendio.</div>` : ''}
      ${riga('Beneficiario', beneficiario || '—', beneficiario)}
      ${ib.ok ? riga('IBAN', formattaIban(p.iban), pulisciIban(p.iban)) : ''}
      ${riga('Importo', eur(importo), fmtNum(importo))}
      ${riga('Causale', causale, causale)}
      <div class="qr" aria-label="QR code del bonifico"></div>
      ${ib.ok ? '<p class="nota centro">Inquadra il codice con l\'app della tua banca (funzione "paga con QR" o "bonifico da QR"): se la banca non lo supporta, copia i dati qui sopra.</p>' : ''}
      <p class="nota">Paga con bonifico, assegno o carta: con i contanti si perde la detrazione del 19% per l'assistenza.</p>
      <div class="azioni-mese"><button class="primario" value="chiudi">Chiudi</button></div>
    </form>`;
  dlg.querySelectorAll('[data-copia]').forEach((b) => b.addEventListener('click', () => copia(b.dataset.copia)));
  dlg.showModal();
  if (ib.ok && importo > 0) {
    try {
      const QR = (await import('qrcode')).default;
      const svg = await QR.toString(testoQrEpc({ beneficiario, iban: p.iban, importo, causale }), { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0f1b2d', light: '#ffffff' } });
      dlg.querySelector('.qr').innerHTML = svg;
    } catch (e) {
      dlg.querySelector('.qr').textContent = 'QR code non disponibile.';
    }
  }
}

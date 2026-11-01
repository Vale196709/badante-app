// Riconciliazione dei bonifici: legge un estratto conto (CSV o testo di un PDF) e abbina
// le uscite agli stipendi confermati e ai contributi INPS da versare.
// Tutto avviene sul dispositivo: l'estratto conto non viene caricato da nessuna parte.

const MESI_BREVI = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };

/** Data italiana (gg/mm/aaaa, gg-mm-aa, gg.mm.aaaa, aaaa-mm-gg o 12 nov 2026) → ISO, oppure null. */
export function dataDaTesto(s) {
  s = String(s || '').trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (Number(m[2]) < 1 || Number(m[2]) > 12) return null;
    return `${a}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MESI_BREVI[m[2]]) return `${m[3]}-${String(MESI_BREVI[m[2]]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  return null;
}

/** Importo in formato italiano o inglese ("-1.234,56", "1234.56", "582,25 €") → numero, oppure null. */
export function importoDaTesto(s) {
  let t = String(s ?? '').replace(/[€\s]|EUR/gi, '');
  if (!t || !/\d/.test(t)) return null;
  let segno = 1;
  if (/^-|-$|^\(.*\)$/.test(t)) segno = -1;
  t = t.replace(/[-+()]/g, '');
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{1,2}$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(/[.,]/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 * segno : null;
}

function separaRiga(riga, sep) {
  const out = [];
  let cur = '', virg = false;
  for (const c of riga) {
    if (c === '"') virg = !virg;
    else if (c === sep && !virg) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Legge un estratto conto CSV. Riconosce da solo il separatore e le colonne di data,
 * importo (oppure Dare/Avere, Uscite/Entrate, Addebiti/Accrediti) e descrizione.
 * @returns array di { data, importo, descrizione } (importo negativo = uscita)
 */
export function leggiCsv(testo) {
  const righe = testo.replace(/^﻿/, '').split(/\r?\n/).filter((r) => r.trim());
  if (!righe.length) return [];
  const sep = [';', '\t', ','].map((s) => [s, righe.slice(0, 10).reduce((n, r) => n + separaRiga(r, s).length, 0)]).sort((a, b) => b[1] - a[1])[0][0];
  const celle = righe.map((r) => separaRiga(r, sep));
  // riga di intestazione: la prima che contiene "data" e una colonna di importi
  const iTesta = celle.findIndex((c) => c.some((x) => /data/i.test(x)) && c.some((x) => /importo|dare|avere|uscit|entrat|addebit|accredit|amount/i.test(x)));
  const testa = iTesta >= 0 ? celle[iTesta].map((x) => x.toLowerCase()) : [];
  const col = (re) => testa.findIndex((x) => re.test(x));
  let cData = col(/data (contabile|operazione)|^data$|data/);
  const cValuta = col(/valuta/);
  if (cData === cValuta && cValuta >= 0) cData = testa.findIndex((x, i) => i !== cValuta && /data/.test(x));
  const cImporto = col(/^importo|importo|amount/);
  const cDare = col(/dare|uscit|addebit/);
  const cAvere = col(/avere|entrat|accredit/);
  const cDescr = col(/descrizion|causale|dettagli|beneficiar|operazione/);
  const out = [];
  for (const c of celle.slice(iTesta + 1)) {
    if (iTesta < 0) {
      // senza intestazione: prima cella con una data, ultima cella con un importo
      const d = c.map(dataDaTesto).find(Boolean);
      const imp = [...c].reverse().map(importoDaTesto).find((x) => x != null);
      if (d && imp != null) out.push({ data: d, importo: imp, descrizione: c.filter((x) => !dataDaTesto(x) && importoDaTesto(x) == null).join(' ') });
      continue;
    }
    const data = dataDaTesto(c[cData]);
    if (!data) continue;
    let importo = null;
    if (cImporto >= 0 && cImporto !== cDare && cImporto !== cAvere) importo = importoDaTesto(c[cImporto]);
    if (importo == null && (cDare >= 0 || cAvere >= 0)) {
      const dare = importoDaTesto(c[cDare]);
      const avere = importoDaTesto(c[cAvere]);
      if (dare) importo = -Math.abs(dare);
      else if (avere) importo = Math.abs(avere);
    }
    if (importo == null) continue;
    const descrizione = cDescr >= 0 ? c[cDescr] : c.filter((_, i) => i !== cData && i !== cImporto).join(' ');
    out.push({ data, importo, descrizione: descrizione || '' });
  }
  return out;
}

/** Testo libero (per esempio estratto da un PDF): una riga per movimento con data e importo. */
export function leggiTesto(testo) {
  const out = [];
  for (const riga of testo.split(/\n/)) {
    const m = riga.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/);
    if (!m) continue;
    const data = dataDaTesto(m[1]);
    const importi = [...riga.matchAll(/-?\s?\d{1,3}(?:\.\d{3})*,\d{2}\s?-?/g)].map((x) => importoDaTesto(x[0]));
    if (!data || !importi.length) continue;
    const descrizione = riga.replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g, '').replace(/-?\s?\d{1,3}(?:\.\d{3})*,\d{2}\s?-?/g, '').replace(/\s+/g, ' ').trim();
    // negli estratti in PDF le uscite spesso non hanno il segno: si considera il primo importo
    out.push({ data, importo: importi[0], descrizione, segnoIncerto: importi[0] > 0 });
  }
  return out;
}

const giorni = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

/**
 * Abbina i movimenti agli stipendi da pagare.
 * @param mesi        mesi della catena { anno, mese, risultato, stato, salvato }
 * @param movimenti   risultato di leggiCsv / leggiTesto
 * @param nome        nome della lavoratrice (rafforza l'abbinamento se compare nella descrizione)
 * @returns array di { anno, mese, importo, movimento, sicuro } per i mesi confermati non pagati
 */
export function abbinaStipendi(mesi, movimenti, nome = '') {
  const parole = String(nome).toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  const usati = new Set();
  const out = [];
  for (const m of mesi.filter((x) => x.stato === 'confermato')) {
    const netto = m.risultato.netto;
    const fine = `${m.anno}-${String(m.mese).padStart(2, '0')}-01`;
    const candidati = movimenti
      .map((mov, i) => ({ mov, i }))
      .filter(({ mov, i }) => !usati.has(i) && Math.abs(Math.abs(mov.importo) - netto) < 0.01 && (mov.importo < 0 || mov.segnoIncerto))
      .map(({ mov, i }) => {
        const dopo = giorni(fine, mov.data); // giorni dall'inizio del mese
        const nomeOk = parole.some((p) => mov.descrizione.toLowerCase().includes(p));
        const stipendio = /stipend|salari|retribuz|cedolin|badante|colf/i.test(mov.descrizione);
        return { mov, i, dopo, punti: (nomeOk ? 2 : 0) + (stipendio ? 1 : 0) };
      })
      // pagato tra il 20 del mese e la fine del mese dopo
      .filter((c) => c.dopo >= 19 && c.dopo <= 62)
      .sort((a, b) => b.punti - a.punti || a.dopo - b.dopo);
    if (!candidati.length) continue;
    const scelto = candidati[0];
    usati.add(scelto.i);
    out.push({ anno: m.anno, mese: m.mese, importo: netto, movimento: scelto.mov, sicuro: scelto.punti > 0 });
  }
  return out;
}

/** Abbina i versamenti INPS (uscite con "INPS" o "pagoPA" e importo uguale al trimestre). */
export function abbinaContributi(scadenzeInps, movimenti) {
  const out = [];
  for (const s of scadenzeInps.filter((x) => !x.fatta && x.importo)) {
    const mov = movimenti.find((mv) => Math.abs(Math.abs(mv.importo) - s.importo) < 0.01 && (mv.importo < 0 || mv.segnoIncerto)
      && Math.abs(giorni(s.data, mv.data)) <= 45 && /inps|pago\s?pa|contribut|lavoro domestico/i.test(mv.descrizione));
    if (mov) out.push({ chiave: s.chiave, titolo: s.titolo, importo: s.importo, movimento: mov });
  }
  return out;
}

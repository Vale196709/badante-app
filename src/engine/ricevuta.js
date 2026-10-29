// Lettura dei dati da una ricevuta di pagamento dei contributi (pagoPA, banca, posta):
// importo, data del pagamento, trimestre e anno di riferimento, codice avviso.
// Funziona sul testo estratto da un PDF o letto da una foto (OCR), quindi tollera errori.

const IMPORTO = /(?:€|EUR|EURO)\s*([0-9]{1,3}(?:[.' ]?[0-9]{3})*[,.][0-9]{2})(?![0-9])|([0-9]{1,3}(?:[.' ]?[0-9]{3})*,[0-9]{2})\s*(?:€|EUR|EURO)?/g;
const DATA = /\b([0-3]?\d)[/.\-]([01]?\d)[/.\-]((?:20)?\d{2})\b/g;

const numero = (s) => {
  let x = s.replace(/[' ]/g, '');
  // l'ultimo separatore è quello dei decimali
  const i = Math.max(x.lastIndexOf(','), x.lastIndexOf('.'));
  x = x.slice(0, i).replace(/[.,]/g, '') + '.' + x.slice(i + 1);
  return Number(x);
};

export function trimestreDaPagamento(iso) {
  const [a, m] = iso.split('-').map(Number);
  const q = Math.floor((m - 1) / 3); // pagato in gen-mar → 4° trimestre dell'anno prima
  return q === 0 ? { anno: a - 1, trimestre: 4 } : { anno: a, trimestre: q };
}

/**
 * @param testo testo della ricevuta
 * @param oggi  'YYYY-MM-DD' (le date future sono scartate)
 * @returns { importo, data, anno, trimestre, codiceAvviso, trovati: { importo, data, trimestre } }
 */
export function leggiRicevuta(testo, oggi) {
  const T = String(testo || '').toUpperCase().replace(/ /g, ' ').replace(/[“”]/g, '"');
  const righe = T.split(/\r?\n/);

  // importo: preferenza alle righe con "importo", "totale", "pagato"
  const candidati = [];
  righe.forEach((r, i) => {
    for (const m of r.matchAll(IMPORTO)) {
      const v = numero(m[1] || m[2]);
      if (!(v > 0 && v < 100000)) continue;
      const contesto = `${righe[i - 1] || ''} ${r}`;
      let peso = 0;
      if (/IMPORTO|TOTALE|PAGAT|ADDEBIT|VERSAT/.test(contesto)) peso += 3;
      if (/COMMISSION|SPESE|COSTO DEL SERVIZIO/.test(contesto)) peso -= 4;
      if (m[1] || /€|EUR/.test(m[0])) peso += 1;
      candidati.push({ v, peso });
    }
  });
  candidati.sort((a, b) => b.peso - a.peso || b.v - a.v);
  const importo = candidati[0]?.v ?? null;

  // data del pagamento: preferenza alle righe con "pagamento", "pagato", "eseguit", "data operazione"
  const date = [];
  righe.forEach((r, i) => {
    for (const m of r.matchAll(DATA)) {
      let [, g, me, a] = m;
      if (a.length === 2) a = `20${a}`;
      const gi = Number(g), mi = Number(me);
      if (mi < 1 || mi > 12 || gi < 1 || gi > 31) continue;
      const iso = `${a}-${String(mi).padStart(2, '0')}-${String(gi).padStart(2, '0')}`;
      if (oggi && iso > oggi) continue;
      const contesto = `${righe[i - 1] || ''} ${r}`;
      let peso = 0;
      if (/PAGAMENTO|PAGATO|ESEGUIT|OPERAZIONE|ADDEBITO|TRANSAZIONE/.test(contesto)) peso += 3;
      if (/SCADENZA|NASCITA|VALIDIT/.test(contesto)) peso -= 4;
      date.push({ iso, peso });
    }
  });
  date.sort((a, b) => b.peso - a.peso || b.iso.localeCompare(a.iso));
  const data = date[0]?.iso ?? null;

  // trimestre e anno di riferimento, se indicati nella causale
  let trimestre = null, anno = null, trovatoTrim = false;
  const mt = T.match(/\b([1-4])\s*(?:°|º|O|\^)?\s*TRIM(?:ESTRE)?\.?\s*(?:DEL\s*|ANNO\s*)?(20\d{2})?/) || T.match(/TRIM(?:ESTRE)?\.?\s*(?:N\.?\s*)?([1-4])\b\s*(?:DEL\s*|ANNO\s*|\/\s*)?(20\d{2})?/);
  if (mt) {
    trimestre = Number(mt[1]);
    if (mt[2]) anno = Number(mt[2]);
    trovatoTrim = true;
  }
  if (data && (!trimestre || !anno)) {
    const t = trimestreDaPagamento(data);
    if (!trimestre) trimestre = t.trimestre;
    if (!anno) anno = trimestre === 4 && t.trimestre === 4 ? t.anno : (trimestre === t.trimestre ? t.anno : Number(data.slice(0, 4)) - (trimestre > t.trimestre ? 1 : 0));
  }

  const avviso = T.replace(/[ .]/g, '').match(/(?<!\d)(3\d{17})(?!\d)/);
  return {
    importo,
    data,
    anno,
    trimestre,
    codiceAvviso: avviso ? avviso[1] : null,
    trovati: { importo: importo != null, data: data != null, trimestre: trovatoTrim },
  };
}

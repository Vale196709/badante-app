// Report di sintesi: consuntivo e previsione dell'anno, composizione dei costi,
// impegni maturati verso la lavoratrice, uscite dei prossimi 90 giorni.
import { euro } from './calcolo.js';
import { calcolaCatena } from './catena.js';
import { generaScadenze } from './scadenze.js';
import { condizioniAl } from './variazioni.js';

const somma = (arr, f) => euro(arr.reduce((s, x) => s + (Number(f(x)) || 0), 0));
const addGiorni = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

/** Componenti del costo per il datore in un mese. */
export function componentiCosto(r) {
  const contributi = euro(r.contributi.inpsDatore + r.contributi.cassaColfDatore);
  const tfr = r.accantonamenti.tfrMese;
  const tredicesima = r.accantonamenti.rateoTredicesima;
  const retribuzione = euro(r.costoDatore - contributi - tfr - tredicesima);
  return { retribuzione, tredicesima, contributi, tfr };
}

/**
 * @param rapporto dati del rapporto
 * @param cedolini righe salvate
 * @param anno     anno del report
 * @param oggi     'YYYY-MM-DD'
 * @param fatte    scadenze già fatte (per le uscite in arrivo)
 */
export function reportAnno(rapporto, cedolini, anno, oggi, fatte = new Set()) {
  if (!rapporto?.dataAssunzione) return null;
  const meseOggi = oggi.slice(0, 7);
  const catenaAnno = calcolaCatena(rapporto, cedolini, { anno, mese: 12 });
  const mesi = catenaAnno.filter((m) => m.anno === anno).map((m) => {
    const k = `${m.anno}-${String(m.mese).padStart(2, '0')}`;
    const consuntivo = k < meseOggi || (k === meseOggi) || m.stato === 'confermato' || m.stato === 'pagato';
    return { ...m, consuntivo, componenti: componentiCosto(m.risultato) };
  });
  if (!mesi.length) return { anno, vuoto: true };

  const cons = mesi.filter((m) => m.consuntivo);
  const prev = mesi.filter((m) => !m.consuntivo);
  const tot = (lista) => ({
    costo: somma(lista, (m) => m.risultato.costoDatore),
    netto: somma(lista, (m) => m.risultato.netto),
    lordo: somma(lista, (m) => m.risultato.lordo),
    ore: somma(lista, (m) => m.risultato.oreLavorate),
    contributiDovuti: somma(lista, (m) => m.risultato.contributi.daVersareAInps),
    retribuzione: somma(lista, (m) => m.componenti.retribuzione),
    tredicesima: somma(lista, (m) => m.componenti.tredicesima),
    contributi: somma(lista, (m) => m.componenti.contributi),
    tfr: somma(lista, (m) => m.componenti.tfr),
    oreFerie: somma(lista, (m) => m.presenze.oreFerie),
    orePermessi: somma(lista, (m) => m.presenze.orePermessi),
  });
  const consuntivo = tot(cons);
  const anno_ = tot(mesi);

  // situazione all'ultimo mese di consuntivo (o al mese prima dell'anno, se nulla è ancora maturato)
  const ultimo = cons[cons.length - 1] ?? null;
  const contatori = ultimo?.risultato.contatori ?? mesi[0].statoPrima ?? {};
  const cond = condizioniAl(rapporto, ultimo ? `${ultimo.anno}-${String(ultimo.mese).padStart(2, '0')}-01` : oggi);
  const ferieResidue = Number(contatori.ferieResidueOre) || 0;
  const impegni = {
    tfr: euro(contatori.tfrAccantonato || 0),
    ferie: euro(Math.max(0, ferieResidue) * cond.pagaOraria),
    ferieOre: ferieResidue,
    tredicesima: euro(contatori.anno === anno ? contatori.tredicesimaMaturata || 0 : 0),
  };
  impegni.totale = euro(impegni.tfr + impegni.ferie + impegni.tredicesima);

  // anno precedente, per il confronto
  const prec = calcolaCatena(rapporto, cedolini, { anno: anno - 1, mese: 12 }).filter((m) => m.anno === anno - 1);
  const costoAnnoPrecedente = prec.length === 12 ? somma(prec, (m) => m.risultato.costoDatore) : null;

  // uscite dei prossimi 90 giorni (stipendi netti e contributi), dalla data di oggi
  const fino = addGiorni(oggi, 90);
  const [fa, fm] = fino.split('-').map(Number);
  const catenaLunga = calcolaCatena(rapporto, cedolini, { anno: fa, mese: fm });
  const uscite = generaScadenze(rapporto, catenaLunga, oggi, fatte)
    .filter((s) => !s.fatta && s.importo != null && s.data >= oggi && s.data <= fino && /^(stipendio|inps)-/.test(s.chiave))
    .map((s) => ({ data: s.data, titolo: s.titolo, importo: s.importo, tipo: s.chiave.startsWith('inps') ? 'Contributi' : 'Stipendio' }));
  const usciteTotale = somma(uscite, (u) => u.importo);

  return {
    anno,
    vuoto: false,
    ultimoConsuntivo: ultimo ? { anno: ultimo.anno, mese: ultimo.mese } : null,
    mesi: mesi.map((m) => ({ mese: m.mese, consuntivo: m.consuntivo, stato: m.stato, costo: m.risultato.costoDatore, netto: m.risultato.netto, ore: m.risultato.oreLavorate, ...m.componenti })),
    consuntivo,
    previsione: anno_,
    mesiPrevisti: prev.length,
    costoMedioMensile: cons.length ? euro(consuntivo.costo / cons.length) : euro(anno_.costo / mesi.length),
    costoOrario: consuntivo.ore > 0 ? euro(consuntivo.costo / consuntivo.ore) : null,
    costoAnnoPrecedente,
    variazioneAnnoPrecedente: costoAnnoPrecedente ? (anno_.costo - costoAnnoPrecedente) / costoAnnoPrecedente : null,
    impegni,
    malattiaGiorni: contatori.anno === anno ? contatori.giorniMalattiaAnno || 0 : 0,
    uscite,
    usciteTotale,
  };
}

/** Somma i report di più rapporti (stesso anno). */
export function sommaReport(lista) {
  const validi = lista.filter((r) => r && !r.vuoto);
  if (!validi.length) return null;
  const s = (f) => euro(validi.reduce((a, r) => a + (Number(f(r)) || 0), 0));
  const campi = ['costo', 'netto', 'lordo', 'ore', 'contributiDovuti', 'retribuzione', 'tredicesima', 'contributi', 'tfr', 'oreFerie', 'orePermessi'];
  const unisci = (chiave) => Object.fromEntries(campi.map((c) => [c, s((r) => r[chiave][c])]));
  const mesi = Array.from({ length: 12 }, (_, i) => {
    const ms = validi.map((r) => r.mesi.find((m) => m.mese === i + 1)).filter(Boolean);
    if (!ms.length) return null;
    const t = (c) => euro(ms.reduce((a, m) => a + m[c], 0));
    return { mese: i + 1, consuntivo: ms.every((m) => m.consuntivo), costo: t('costo'), netto: t('netto'), ore: t('ore'), retribuzione: t('retribuzione'), tredicesima: t('tredicesima'), contributi: t('contributi'), tfr: t('tfr') };
  }).filter(Boolean);
  const consuntivo = unisci('consuntivo');
  const prec = validi.every((r) => r.costoAnnoPrecedente != null) ? s((r) => r.costoAnnoPrecedente) : null;
  const previsione = unisci('previsione');
  return {
    ...validi[0],
    mesi,
    consuntivo,
    previsione,
    costoMedioMensile: s((r) => r.costoMedioMensile),
    costoOrario: consuntivo.ore > 0 ? euro(consuntivo.costo / consuntivo.ore) : null,
    costoAnnoPrecedente: prec,
    variazioneAnnoPrecedente: prec ? (previsione.costo - prec) / prec : null,
    impegni: { tfr: s((r) => r.impegni.tfr), ferie: s((r) => r.impegni.ferie), ferieOre: s((r) => r.impegni.ferieOre), tredicesima: s((r) => r.impegni.tredicesima), totale: s((r) => r.impegni.totale) },
    malattiaGiorni: validi.reduce((a, r) => a + r.malattiaGiorni, 0),
    uscite: validi.flatMap((r) => r.uscite).sort((a, b) => a.data.localeCompare(b.data)),
    usciteTotale: s((r) => r.usciteTotale),
    rapporti: validi.length,
  };
}

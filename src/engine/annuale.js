// Riepiloghi annuali: dichiarazione dei compensi per la lavoratrice e quadro dei costi per il datore.
import { euro } from './calcolo.js';
import { REGOLE_CCNL } from './tabelle.js';

const somma = (arr, f) => euro(arr.reduce((s, x) => s + (f(x) || 0), 0));

/** @param catena risultato di calcolaCatena */
export function riepilogoAnno(catena, anno) {
  const mesi = catena.filter((m) => m.anno === anno);
  const r = mesi.map((m) => m.risultato);
  const voce = (cod) => somma(r, (x) => x.voci.filter((v) => v.codice === cod).reduce((s, v) => s + v.importo, 0));
  const tredicesima = euro(voce('13A') + voce('13M'));
  const lordo = somma(r, (x) => x.lordo);
  const inpsLav = somma(r, (x) => x.contributi.inpsLavoratore);
  const cassaLav = somma(r, (x) => x.contributi.cassaColfLavoratore);
  const anticipiTfr = somma(r, (x) => x.anticipoTfr);
  return {
    anno,
    mesi: mesi.length,
    oreLavorate: somma(r, (x) => x.oreLavorate),
    oreContributive: somma(r, (x) => x.contributi.oreContributive),
    lordo,
    tredicesima,
    contributiLavoratrice: euro(inpsLav + cassaLav),
    // reddito di lavoro dipendente da dichiarare: retribuzioni meno contributi a suo carico
    imponibileFiscale: euro(lordo - inpsLav - cassaLav),
    netto: euro(somma(r, (x) => x.netto) - anticipiTfr),
    anticipiTfr,
    contributiDatore: euro(somma(r, (x) => x.contributi.inpsDatore) + somma(r, (x) => x.contributi.cassaColfDatore)),
    versamentiInps: somma(r, (x) => x.contributi.daVersareAInps),
    tfrMaturato: somma(r, (x) => x.accantonamenti.tfrMese),
    costoDatore: somma(r, (x) => x.costoDatore),
    mensile: mesi.map((m) => ({ mese: m.mese, lordo: m.risultato.lordo, netto: m.risultato.netto, costo: m.risultato.costoDatore, ore: m.risultato.oreLavorate, stato: m.stato })),
  };
}

/**
 * Contributi a carico del datore effettivamente PAGATI nell'anno (deducibili fino a 1.549,37 €):
 * 4° trimestre dell'anno prima (pagato a gennaio) + 1°, 2°, 3° trimestre dell'anno.
 */
export function contributiDeducibili(catena, anno) {
  const dentro = catena.filter((m) => (m.anno === anno - 1 && m.mese >= 10) || (m.anno === anno && m.mese <= 9));
  const pagati = somma(dentro, (m) => m.risultato.contributi.inpsDatore + m.risultato.contributi.cassaColfDatore);
  return { pagati, deducibili: Math.min(pagati, REGOLE_CCNL.deduzioneContributiMax), massimo: REGOLE_CCNL.deduzioneContributiMax };
}

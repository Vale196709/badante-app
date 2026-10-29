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
export function contributiDeducibili(catena, anno, versamenti = []) {
  // trimestri il cui pagamento cade nell'anno: 4° dell'anno prima e 1°–3° dell'anno
  const trimestri = [{ anno: anno - 1, q: 4 }, { anno, q: 1 }, { anno, q: 2 }, { anno, q: 3 }];
  let pagati = 0, daRegistrati = 0;
  for (const t of trimestri) {
    const mesi = catena.filter((m) => m.anno === t.anno && Math.ceil(m.mese / 3) === t.q);
    if (!mesi.length) continue;
    const datore = somma(mesi, (m) => m.risultato.contributi.inpsDatore + m.risultato.contributi.cassaColfDatore);
    const totale = somma(mesi, (m) => m.risultato.contributi.daVersareAInps);
    const v = versamenti.find((x) => x.anno === t.anno && x.trimestre === t.q);
    if (v && v.data_pagamento?.startsWith(String(anno))) {
      // quota datore del versamento effettivo, in proporzione al dovuto
      pagati += totale > 0 ? Number(v.importo) * (datore / totale) : 0;
      daRegistrati++;
    } else if (!v) {
      pagati += datore;
    }
  }
  pagati = euro(pagati);
  return { pagati, deducibili: Math.min(pagati, REGOLE_CCNL.deduzioneContributiMax), massimo: REGOLE_CCNL.deduzioneContributiMax, trimestriRegistrati: daRegistrati };
}

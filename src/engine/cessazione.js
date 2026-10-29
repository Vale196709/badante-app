// Conteggi di fine rapporto: preavviso, ferie non godute, ratei di 13ª, TFR.
import { euro, oreSettimanali, mesiAnzianita, fasciaContributiva } from './calcolo.js';
import { REGOLE_CCNL as R, tabelleAnno } from './tabelle.js';

export const MOTIVI = {
  licenziamento: 'Licenziamento',
  giustaCausa: 'Licenziamento per giusta causa',
  dimissioni: 'Dimissioni della lavoratrice',
  consensuale: 'Risoluzione consensuale',
  termine: 'Scadenza del contratto a termine',
  decesso: 'Decesso dell\'assistito o del datore',
};

export function giorniPreavviso(rapporto, dataCessazione, motivo) {
  if (['giustaCausa', 'consensuale', 'termine'].includes(motivo)) return 0;
  const sett = oreSettimanali(rapporto.orario);
  const anni = mesiAnzianita(rapporto.dataAssunzione, dataCessazione) / 12;
  const regola = R.preavviso.find((p) => sett >= p.oreDa && anni < p.finoAnni);
  const giorni = regola.giorni;
  return motivo === 'dimissioni' ? Math.ceil(giorni / 2) : giorni;
}

/**
 * @param stato           contatori dopo l'ultimo cedolino elaborato (catena)
 * @param opzioni         { dataCessazione, motivo, preavvisoLavorato: bool }
 */
export function calcolaCessazione(rapporto, stato, { dataCessazione, motivo, preavvisoLavorato = true }) {
  const paga = rapporto.pagaOraria;
  const sett = oreSettimanali(rapporto.orario);
  const anno = Number(dataCessazione.slice(0, 4));
  const voci = [];
  const note = [];

  // Ferie maturate e non godute
  const oreFerie = Math.max(0, stato.ferieResidueOre ?? 0);
  const ferie = euro(oreFerie * paga);
  if (ferie > 0) voci.push({ codice: 'IFE', descrizione: `Indennità ferie non godute (${oreFerie.toFixed(2)} h)`, importo: ferie, soggettaInps: true, ore: oreFerie });

  // Ratei di 13ª maturati e non pagati
  const tredicesima = rapporto.tredicesimaMensile ? 0 : euro(stato.anno === anno ? stato.tredicesimaMaturata ?? 0 : 0);
  if (tredicesima > 0) voci.push({ codice: '13R', descrizione: 'Ratei tredicesima maturati', importo: tredicesima, soggettaInps: false });

  // Preavviso
  const giorni = giorniPreavviso(rapporto, dataCessazione, motivo);
  const orePreavviso = euro((giorni / 7) * sett);
  let preavviso = 0;
  if (giorni > 0 && !preavvisoLavorato) {
    preavviso = euro(orePreavviso * paga);
    if (motivo === 'dimissioni') {
      voci.push({ codice: 'TPR', descrizione: `Trattenuta mancato preavviso (${giorni} giorni)`, importo: -preavviso, soggettaInps: false });
      note.push('Se la lavoratrice si dimette senza dare il preavviso, il datore può trattenere l\'importo corrispondente.');
    } else {
      voci.push({ codice: 'IPR', descrizione: `Indennità sostitutiva del preavviso (${giorni} giorni)`, importo: preavviso, soggettaInps: true, ore: orePreavviso });
    }
  }
  if (motivo === 'decesso') note.push('In caso di decesso del datore il rapporto può proseguire con gli eredi o cessare con il preavviso: verificare il caso concreto.');

  // TFR: fondo accantonato + rivalutazione dell'anno in corso (solo quota fissa, pro rata)
  const mesiAnno = Number(dataCessazione.slice(5, 7));
  const rivalutazione = euro((stato.tfrFondoInizioAnno ?? 0) * R.rivalutazioneTfrFissa * (mesiAnno / 12));
  const quotaTfrSuIndennita = euro((ferie + (motivo !== 'dimissioni' ? preavviso : 0)) / R.divisoreTfr);
  const tfr = euro((stato.tfrAccantonato ?? 0) + rivalutazione + quotaTfrSuIndennita);
  voci.push({ codice: 'TFR', descrizione: 'Trattamento di fine rapporto', importo: tfr, soggettaInps: false });
  if (rivalutazione > 0) note.push('La rivalutazione TFR dell\'anno di cessazione è stimata sulla sola quota fissa dell\'1,5%: la quota ISTAT si aggiunge quando è pubblicata.');

  // Contributi sulle voci soggette (ore di ferie e preavviso)
  const oreContributive = euro(voci.filter((v) => v.soggettaInps && v.ore).reduce((s, v) => s + v.ore, 0));
  const fascia = fasciaContributiva(rapporto, anno);
  const cc = rapporto.cassaColf === false ? { datore: 0, lavoratore: 0 } : tabelleAnno(anno).cassaColf;
  const trattenute = euro(oreContributive * (fascia.lavoratoreOrario + cc.lavoratore));
  const contributiDatore = euro(oreContributive * (fascia.datoreOrario + cc.datore));

  const lordo = euro(voci.reduce((s, v) => s + v.importo, 0));
  note.push('Comunicare la cessazione all\'INPS entro 5 giorni (servizio "Lavoro domestico").');
  note.push('Il TFR è soggetto a tassazione separata: il datore domestico non trattiene IRPEF, la lavoratrice lo dichiara.');
  note.push('Consegnare la dichiarazione dei compensi dell\'anno insieme alle ultime spettanze.');

  return {
    dataCessazione,
    motivo,
    giorniPreavviso: giorni,
    voci,
    lordo,
    trattenute,
    netto: euro(lordo - trattenute),
    contributiDatore,
    costoTotale: euro(lordo + contributiDatore),
    note,
  };
}

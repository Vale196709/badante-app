// Riepiloghi annuali: dichiarazione dei compensi per la lavoratrice e quadro dei costi per il datore.
import { euro, oreSettimanali } from './calcolo.js';
import { condizioniAl } from './variazioni.js';
import { tipologia } from './tabelle.js';
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

/**
 * Detrazione IRPEF del 19% per gli addetti all'assistenza personale di persone non autosufficienti
 * (art. 15, c. 1, lett. i-septies TUIR): spesa massima 2.100 € per assistito, reddito di chi paga
 * fino a 40.000 €, pagamento tracciabile, certificazione medica della non autosufficienza.
 * La spesa è per cassa: retribuzioni lorde dei cedolini pagati nell'anno (se nessun cedolino
 * risulta pagato si usa la competenza, come stima).
 */
export function detrazioneAssistenza(catena, anno, dati = {}) {
  const R = REGOLE_CCNL.detrazioneAssistenza;
  const pagati = catena.filter((m) => m.salvato?.pagato_at?.startsWith(String(anno)));
  const perCassa = pagati.length > 0;
  const mesi = perCassa ? pagati : catena.filter((m) => m.anno === anno);
  const spesa = somma(mesi, (m) => m.risultato.lordo);
  const det = dati.detrazione || {};
  const requisiti = {
    nonAutosufficiente: !!det.nonAutosufficiente,
    redditoEntroLimite: !!det.redditoEntroLimite,
    pagamentoTracciabile: (dati.pagamento?.modalita || 'bonifico') !== 'contanti',
  };
  const ammessa = Object.values(requisiti).every(Boolean);
  const base = Math.min(spesa, R.spesaMassima);
  return {
    spesa,
    base: euro(base),
    detrazione: ammessa ? euro(base * R.aliquota) : 0,
    detrazionePotenziale: euro(base * R.aliquota),
    massimo: euro(R.spesaMassima * R.aliquota),
    spesaMassima: R.spesaMassima,
    limiteReddito: R.limiteReddito,
    requisiti,
    ammessa,
    perCassa,
    mesi: mesi.length,
  };
}

/**
 * Verifica orientativa delle agevolazioni per la persona assistita.
 * @returns [{ chiave, nome, esito: 'si'|'no'|'forse', testo }]
 */
export function verificaAgevolazioni(dati = {}, oggi = new Date().toISOString().slice(0, 10)) {
  const a = dati.agevolazioni || {};
  const det = dati.detrazione || {};
  const R = REGOLE_CCNL;
  const out = [];
  const ore = Object.values(dati.orario || {}).reduce((s, h) => s + h, 0);

  // Prestazione universale
  const pu = R.prestazioneUniversale;
  let esitoPu;
  if (a.prestazioneUniversale) esitoPu = 'si';
  else if (!a.over80 || !a.accompagnamento || !a.iseeEntroLimite || oggi > pu.fine) esitoPu = 'no';
  else esitoPu = 'forse'; // requisiti principali presenti: serve la domanda e l'accertamento INPS
  out.push({
    chiave: 'pu', nome: 'Prestazione universale (850 € al mese)', esito: esitoPu,
    testo: a.prestazioneUniversale
      ? `Ricevuta: va spesa per il lavoro domestico regolare${ore < pu.oreMinime ? ` (attenzione: servono almeno ${pu.oreMinime} ore settimanali, il rapporto ne ha ${ore})` : ''} e rendicontata ogni trimestre con i cedolini pagati.`
      : `Per chi ha almeno ${pu.etaMinima} anni, l'indennità di accompagnamento, ISEE sociosanitario fino a ${pu.iseeMassimo.toLocaleString('it-IT')} € e bisogno assistenziale gravissimo accertato dall'INPS. In vigore fino al ${pu.fine.split('-').reverse().join('/')}, salvo proroga.`,
  });

  // Esonero contributivo over 80
  const es = R.esoneroOver80;
  const nellaFinestra = dati.dataAssunzione >= es.dal && dati.dataAssunzione <= es.al && dati.tipoContratto !== 'determinato';
  out.push({
    chiave: 'esonero', nome: 'Esonero contributi per datori over 80', esito: 'no',
    testo: nellaFinestra
      ? 'Assunzione nella finestra prevista (1/4/2024–31/12/2025), ma l\'INPS non ha mai pubblicato le istruzioni: oggi non si può applicare.'
      : 'Previsto per le assunzioni a tempo indeterminato dal 1/4/2024 al 31/12/2025 e mai reso operativo dall\'INPS: non vale per questo rapporto.',
  });

  // Detrazione 19% e deduzione contributi
  const detOk = det.nonAutosufficiente && det.redditoEntroLimite && (dati.pagamento?.modalita || 'bonifico') !== 'contanti';
  out.push({
    chiave: 'detrazione', nome: 'Detrazione 19% per l\'assistenza', esito: detOk ? 'si' : (det.nonAutosufficiente === false ? 'no' : 'forse'),
    testo: detOk ? 'Fino a 399 € l\'anno, nel 730 (righi E8–E10, codice 15).' : 'Serve: persona non autosufficiente con certificato medico, reddito di chi paga fino a 40.000 €, pagamenti non in contanti.',
  });
  out.push({ chiave: 'deduzione', nome: 'Deduzione dei contributi INPS', esito: 'si', testo: 'Sempre, fino a 1.549,37 € l\'anno di contributi a tuo carico pagati (rigo E23).' });
  return out;
}

/**
 * Permessi individuali retribuiti (CCNL art. 19: visite mediche documentate e pratiche personali
 * che cadono nell'orario di lavoro). Ore annue: conviventi 16 (part-time 12); non conviventi 12
 * con almeno 30 h settimanali, riproporzionate sotto le 30. Nell'anno di assunzione o di
 * cessazione spettano in proporzione ai mesi di servizio.
 */
export function orePermessiAnnue(rapporto) {
  const t = rapporto?.tipologia || 'ore';
  if (t === 'convivente') return REGOLE_CCNL.permessi.conviventi;
  if (t === 'conviventePT') return REGOLE_CCNL.permessi.conviventiPT;
  const sett = oreSettimanali(rapporto?.orario || {});
  const base = REGOLE_CCNL.permessi.nonConviventi;
  return sett >= REGOLE_CCNL.permessi.oreSogliaPiena ? base : euro((base * sett) / REGOLE_CCNL.permessi.oreSogliaPiena);
}

export function saldoPermessi(rapporto, catena, anno) {
  if (!rapporto?.dataAssunzione) return null;
  const [aa, ma] = rapporto.dataAssunzione.split('-').map(Number);
  if (aa > anno) return null;
  const da = aa === anno ? ma : 1;
  let a = 12;
  if (rapporto.dataCessazione) {
    const [ac, mc] = rapporto.dataCessazione.split('-').map(Number);
    if (ac < anno) return null;
    if (ac === anno) a = mc;
  }
  const cond = condizioniAl(rapporto, `${anno}-12-31` < (rapporto.dataCessazione || '9999') ? `${anno}-12-31` : rapporto.dataCessazione);
  const annue = orePermessiAnnue(cond);
  const spettanti = euro((annue * (a - da + 1)) / 12);
  const usate = euro(catena.filter((m) => m.anno === anno).reduce((s, m) => s + (m.presenze?.orePermessi || 0), 0));
  return { annue, spettanti, usate, residue: euro(spettanti - usate), mensile: !!tipologia(cond).mensile };
}

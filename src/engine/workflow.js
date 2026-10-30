// "Cose da fare": percorsi a tappe calcolati dai dati dell'app.
// Ogni tappa ha uno stato: 'fatto', 'ritardo' (scaduta), 'ora' (da fare adesso),
// 'corso' (in corso, non urgente), 'attesa' (non ancora il momento).
// I passi che l'app non può verificare da sola si segnano a mano: la chiave finisce
// tra le scadenze fatte (tabella scadenze_fatte), così vale su tutti i dispositivi.

import { generaScadenze, nomeMese } from './scadenze.js';
import { giorniPreavviso } from './cessazione.js';
import { mesiAnzianita } from './calcolo.js';
import { REGOLE_CCNL as R } from './tabelle.js';
import { condizioniAl } from './variazioni.js';
import { fmtEur, fmtNum } from './formato.js';

const pad = (n) => String(n).padStart(2, '0');
const chiave = (a, m) => `${a}-${pad(m)}`;
const ultimoGiorno = (a, m) => `${a}-${pad(m)}-${pad(new Date(Date.UTC(a, m, 0)).getUTCDate())}`;
const addGiorni = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const dataIt = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const titoloMese = (a, m) => `${nomeMese(m).charAt(0).toUpperCase()}${nomeMese(m).slice(1)} ${a}`;

/** Ricevuta firmata dalla lavoratrice nell'app, oppure segnata a mano (firma su carta). */
export const firmaFatta = (m, fatte) => !!m.salvato?.ricevuta_at || fatte.has(`wf-firma-${chiave(m.anno, m.mese)}`);

/** Primo passo non completato del percorso (quello da evidenziare). */
export const passoAttuale = (passi) => passi.find((p) => p.stato !== 'fatto') ?? null;

/**
 * Percorso del mese: presenze → cedolino → pagamento → ricevuta firmata.
 * Il mese seguito è il primo non ancora pagato fino al mese corrente; se sono
 * tutti pagati, il mese corrente.
 */
export function percorsoMese(rapporto, catena, { ore = [], fatte = new Set(), oggi }) {
  const meseOggi = oggi.slice(0, 7);
  const fino = catena.filter((m) => chiave(m.anno, m.mese) <= meseOggi);
  if (!fino.length) return null;
  const m = fino.find((x) => x.stato !== 'pagato') ?? fino[fino.length - 1];
  const k = chiave(m.anno, m.mese);
  const fine = ultimoGiorno(m.anno, m.mese);
  const inChiusura = oggi >= addGiorni(fine, -4);
  const scaduto = oggi > fine;
  const nome = rapporto.lavoratrice?.nome || 'la lavoratrice';
  const oreMese = ore.filter((o) => o.data.startsWith(k));
  const daApprovare = oreMese.filter((o) => o.stato === 'in attesa').length;
  const chiuso = m.stato === 'confermato' || m.stato === 'pagato';
  const netto = m.risultato.netto;
  const apriMese = { tipo: 'mese', anno: m.anno, mese: m.mese };
  const passi = [];

  // 1. Presenze
  let p1;
  if (chiuso) p1 = { stato: 'fatto', dettaglio: 'Presenze chiuse con la conferma del cedolino' };
  else if (daApprovare) p1 = { stato: scaduto ? 'ritardo' : 'ora', dettaglio: `${daApprovare} ${daApprovare === 1 ? 'giorno segnato' : 'giorni segnati'} da ${nome} da approvare`, azione: { ...apriMese, tipo: 'presenze', etichetta: 'Approva le ore' } };
  else if (!inChiusura) p1 = { stato: 'corso', dettaglio: oreMese.length ? `${oreMese.length} giorni segnati da ${nome} e approvati. Il mese è in corso.` : 'Il mese è in corso: segna ferie, malattia e assenze quando capitano.', azione: { ...apriMese, etichetta: 'Apri le presenze' } };
  else if (oreMese.length || m.salvato) p1 = { stato: 'fatto', dettaglio: oreMese.length ? `${oreMese.length} giorni segnati da ${nome} e approvati` : 'Presenze inserite' };
  else p1 = { stato: scaduto ? 'ritardo' : 'ora', dettaglio: 'Controlla che ore, ferie e assenze del mese siano giuste', azione: { ...apriMese, etichetta: 'Controlla' } };
  passi.push({ id: 'presenze', titolo: daApprovare && !chiuso ? `Approva le ore di ${nome}` : 'Presenze del mese', ...p1 });

  // 2. Conferma del cedolino
  let p2;
  if (chiuso) p2 = { stato: 'fatto', dettaglio: `Netto ${fmtEur(netto)}` };
  else if (p1.stato !== 'fatto') p2 = { stato: 'attesa', dettaglio: `Dopo le presenze, entro il ${dataIt(fine)}` };
  else p2 = { stato: scaduto ? 'ritardo' : 'ora', dettaglio: scaduto ? `Era da confermare entro il ${dataIt(fine)}` : `Entro il ${dataIt(fine)} · netto ${fmtEur(netto)}`, azione: { ...apriMese, etichetta: 'Apri il cedolino' } };
  passi.push({ id: 'cedolino', titolo: 'Conferma il cedolino', ...p2 });

  // 3. Pagamento
  let p3;
  if (m.stato === 'pagato') p3 = { stato: 'fatto', dettaglio: m.salvato?.pagato_at ? `Pagato il ${dataIt(m.salvato.pagato_at)}` : 'Pagato' };
  else if (m.stato === 'confermato') p3 = { stato: scaduto ? 'ritardo' : 'ora', dettaglio: `${fmtEur(netto)} con bonifico, poi segna il pagamento nel cedolino`, azione: { tipo: 'bonifico', anno: m.anno, mese: m.mese, importo: netto, etichetta: 'Dati per il bonifico' }, azione2: { ...apriMese, etichetta: 'Segna pagato' } };
  else p3 = { stato: 'attesa', dettaglio: 'Dopo la conferma del cedolino' };
  passi.push({ id: 'paga', titolo: 'Paga lo stipendio', ...p3 });

  // 4. Ricevuta firmata
  let p4;
  if (firmaFatta(m, fatte)) p4 = { stato: 'fatto', dettaglio: m.salvato?.ricevuta_at ? `Firmata il ${dataIt(m.salvato.ricevuta_at)}` : 'Firmata su carta' };
  else if (chiuso) p4 = { stato: 'ora', dettaglio: `${nome} la firma col dito nell'app. Se la firma su carta, segnala qui.`, manuale: `wf-firma-${k}`, azione: { tipo: 'stampa', anno: m.anno, mese: m.mese, etichetta: 'Stampa il cedolino' } };
  else p4 = { stato: 'attesa', dettaglio: `La firma ${nome} dopo la conferma` };
  passi.push({ id: 'firma', titolo: 'Ricevuta firmata', ...p4 });

  // mesi precedenti pagati ma senza firma (ultimi 3)
  const senzaFirma = catena
    .filter((x) => chiave(x.anno, x.mese) < k && x.stato === 'pagato' && !firmaFatta(x, fatte))
    .slice(-3)
    .map((x) => ({ anno: x.anno, mese: x.mese, titolo: titoloMese(x.anno, x.mese), chiave: `wf-firma-${chiave(x.anno, x.mese)}` }));

  return { anno: m.anno, mese: m.mese, titolo: titoloMese(m.anno, m.mese), passi, fatti: passi.filter((p) => p.stato === 'fatto').length, senzaFirma };
}

/** Scadenze diverse dallo stipendio: scadute e prossime. */
export function scadenzeDaFare(rapporto, catena, { fatte = new Set(), oggi, quante = 5 }) {
  const tra10 = addGiorni(oggi, 10);
  const aperte = generaScadenze(rapporto, catena, oggi, fatte)
    .filter((s) => !s.fatta && !s.chiave.startsWith('stipendio-'))
    .map((s) => ({ ...s, stato: s.data < oggi ? 'ritardo' : s.data <= tra10 ? 'ora' : 'attesa' }));
  return [...aperte.filter((s) => s.stato === 'ritardo'), ...aperte.filter((s) => s.stato !== 'ritardo').slice(0, quante)];
}

/** La cosa più urgente, per la scheda del Riepilogo. */
export function prossimaCosa(percorso, scadenze) {
  const passo = percorso && passoAttuale(percorso.passi);
  const conMese = passo && { titolo: passo.titolo, dettaglio: passo.dettaglio, stato: passo.stato };
  const scad = (s) => s && { titolo: s.titolo, dettaglio: `Entro il ${dataIt(s.data)}${s.importo != null ? ` · ${fmtEur(s.importo)}` : ''}`, stato: s.stato };
  if (passo?.stato === 'ritardo') return conMese;
  const scaduta = scadenze.find((s) => s.stato === 'ritardo');
  if (scaduta) return scad(scaduta);
  if (passo?.stato === 'ora') return conMese;
  const vicina = scadenze.find((s) => s.stato === 'ora');
  if (vicina) return scad(vicina);
  if (passo) return conMese;
  return scad(scadenze[0]) ?? null;
}

// ---------- Percorsi guidati per gli eventi ----------

/** Ferie: richiesta → approvazione → saldo → sostituta → cedolino. */
export function percorsoFerie(rapporto, catena, { richieste = [], fatte = new Set(), oggi }) {
  const ferie = richieste.filter((r) => r.tipo === 'F').sort((a, b) => a.dal.localeCompare(b.dal));
  const r = ferie.find((x) => x.stato === 'in attesa') ?? ferie.find((x) => x.stato === 'approvata' && x.al >= oggi) ?? null;
  const nome = rapporto.lavoratrice?.nome || 'la lavoratrice';
  const residue = catena[catena.length - 1]?.risultato.contatori.ferieResidueOre ?? 0;
  const periodo = r ? `dal ${dataIt(r.dal)} al ${dataIt(r.al)}` : '';
  const approvata = r?.stato === 'approvata';
  const rif = r?.id ?? 'nuova';
  const passi = [
    r
      ? { id: 'richiesta', titolo: 'Richiesta ricevuta', stato: 'fatto', dettaglio: `Ferie ${periodo}` }
      : { id: 'richiesta', titolo: 'Richiesta delle ferie', stato: 'ora', dettaglio: `${nome} la invia dall'app; altrimenti segna i giorni nel calendario delle ferie.`, azione: { tipo: 'vai', dest: 'ferie', etichetta: 'Calendario ferie' } },
    approvata
      ? { id: 'approva', titolo: 'Ferie approvate', stato: 'fatto', dettaglio: 'Giorni inseriti nelle presenze' }
      : { id: 'approva', titolo: 'Approva o rifiuta', stato: r ? 'ora' : 'attesa', dettaglio: r ? 'La risposta arriva a ' + nome + ' nell\'app' : 'Dopo la richiesta', ...(r ? { azione: { tipo: 'vai', dest: 'mesi', etichetta: 'Rispondi' } } : {}) },
    { id: 'saldo', titolo: 'Controlla il saldo', stato: approvata || fatte.has(`wf-ferie-saldo-${rif}`) ? 'fatto' : r ? 'ora' : 'attesa', dettaglio: `Ferie residue oggi: ${fmtNum(residue, 1)} ore. Il calendario mostra il saldo previsto.`, azione: { tipo: 'vai', dest: 'ferie', etichetta: 'Saldo previsto' }, ...(r && !approvata ? { manuale: `wf-ferie-saldo-${rif}` } : {}) },
    { id: 'sostituta', titolo: 'Sostituta, se serve', stato: fatte.has(`wf-ferie-sost-${rif}`) ? 'fatto' : approvata ? 'ora' : 'attesa', dettaglio: 'Crea un contratto a termine di sostituzione già compilato. Se non serve, segnalo come fatto.', azione: { tipo: 'vai', dest: 'ferie', etichetta: 'Prepara sostituta' }, ...(r ? { manuale: `wf-ferie-sost-${rif}` } : {}) },
    { id: 'cedolino', titolo: 'Ferie nel cedolino', stato: approvata ? 'fatto' : 'attesa', dettaglio: 'Con l\'approvazione i giorni vanno da soli nelle presenze e nel cedolino del mese.' },
  ];
  return { id: 'ferie', titolo: r ? `Ferie ${periodo}` : 'Ferie', passi };
}

/** Malattia: certificato → presenze → archivio → giorni pagati e comporto. */
export function percorsoMalattia(rapporto, catena, { documenti = [], fatte = new Set(), oggi }) {
  // ultimo giorno di malattia segnato negli ultimi 60 giorni
  const da = addGiorni(oggi, -60);
  const giorniM = catena.flatMap((m) => Object.entries(m.salvato?.presenze?.giorni ?? {}).filter(([d, g]) => g.tipo === 'M' && d >= da).map(([d]) => d)).sort();
  let inizio = null;
  if (giorniM.length) {
    inizio = giorniM[giorniM.length - 1];
    for (let i = giorniM.length - 2; i >= 0 && giorniM[i] >= addGiorni(inizio, -4); i--) inizio = giorniM[i];
  }
  const rif = inizio ?? 'nuova';
  const nome = rapporto.lavoratrice?.nome || 'la lavoratrice';
  const certificato = documenti.some((d) => d.categoria === 'Certificati di malattia' && (!inizio || (d.created_at ?? '').slice(0, 10) >= inizio));
  const ultimo = catena[catena.length - 1];
  const usati = ultimo?.risultato.contatori.anno === Number(oggi.slice(0, 4)) ? ultimo.risultato.contatori.giorniMalattiaAnno : 0;
  const regola = R.malattia.find((x) => mesiAnzianita(rapporto.dataAssunzione, oggi) < x.finoMesi);
  const oltre = usati > regola.giorniRetribuiti;
  const passi = [
    { id: 'protocollo', titolo: 'Numero del certificato', stato: fatte.has(`wf-mal-prot-${rif}`) ? 'fatto' : 'ora', dettaglio: `Il medico invia il certificato all'INPS; ${nome} ti comunica il numero di protocollo.`, manuale: `wf-mal-prot-${rif}` },
    inizio
      ? { id: 'presenze', titolo: 'Giorni nelle presenze', stato: 'fatto', dettaglio: `Malattia segnata dal ${dataIt(inizio)} al ${dataIt(giorniM[giorniM.length - 1])}` }
      : { id: 'presenze', titolo: 'Segna i giorni di malattia', stato: 'ora', dettaglio: 'Nel mese, tocca i giorni e scegli Malattia: i primi 3 sono pagati al 50%.', azione: { tipo: 'mese', anno: Number(oggi.slice(0, 4)), mese: Number(oggi.slice(5, 7)), etichetta: 'Apri le presenze' } },
    { id: 'archivio', titolo: 'Archivia il certificato', stato: certificato || fatte.has(`wf-mal-arch-${rif}`) ? 'fatto' : 'ora', dettaglio: 'Caricalo in Documenti, categoria Certificati di malattia.', azione: { tipo: 'vai', dest: 'documenti', etichetta: 'Documenti' }, ...(certificato ? {} : { manuale: `wf-mal-arch-${rif}` }) },
    { id: 'conteggi', titolo: 'Giorni pagati e conservazione del posto', stato: oltre ? 'ora' : 'fatto', dettaglio: `${usati} giorni di malattia nell'anno su ${regola.giorniRetribuiti} pagati; posto conservato fino a ${regola.comportoGiorni} giorni.${oltre ? ' I giorni in più sono un\'assenza giustificata non pagata.' : ''}` },
  ];
  return { id: 'malattia', titolo: inizio ? `Malattia dal ${dataIt(inizio)}` : 'Malattia', passi };
}

/** Fine rapporto: conteggi → lettera → data di cessazione → ultimo cedolino → INPS → dichiarazione. */
export function percorsoFine(rapporto, catena, { fatte = new Set(), oggi }) {
  const dc = rapporto.dataCessazione || null;
  const c = condizioniAl(rapporto, dc || oggi);
  const prLic = giorniPreavviso(c, dc || oggi, 'licenziamento');
  const prDim = giorniPreavviso(c, dc || oggi, 'dimissioni');
  const ultimo = dc ? catena.find((m) => chiave(m.anno, m.mese) === dc.slice(0, 7)) : null;
  const inps = addGiorni(dc || oggi, 5);
  const passi = [
    { id: 'conteggi', titolo: 'Calcola preavviso e spettanze', stato: fatte.has('wf-fine-conteggi') || dc ? 'fatto' : 'ora', dettaglio: `Preavviso: ${prLic} giorni se licenzi, ${prDim} se si dimette. Il Simulatore calcola ferie, 13ª e TFR.`, azione: { tipo: 'vai', dest: 'simulatore', etichetta: 'Simulatore' }, ...(dc ? {} : { manuale: 'wf-fine-conteggi' }) },
    { id: 'lettera', titolo: 'Lettera di licenziamento o dimissioni', stato: fatte.has('wf-fine-lettera') ? 'fatto' : 'ora', dettaglio: 'Le dimissioni della lavoratrice si convalidano anche con lettera firmata.', azione: { tipo: 'lettera', chiave: 'licenziamento', etichetta: 'Licenziamento' }, azione2: { tipo: 'lettera', chiave: 'dimissioni', etichetta: 'Dimissioni' }, manuale: 'wf-fine-lettera' },
    { id: 'data', titolo: 'Inserisci la data di cessazione', stato: dc ? 'fatto' : 'ora', dettaglio: dc ? `Ultimo giorno: ${dataIt(dc)}` : 'In Impostazioni → Rapporto: così l\'app chiude i conteggi.', azione: dc ? null : { tipo: 'impostazioni', scheda: 'rapporto', etichetta: 'Impostazioni' } },
    { id: 'spettanze', titolo: 'Ultimo cedolino e spettanze', stato: ultimo?.stato === 'pagato' || fatte.has('cess-spettanze') ? 'fatto' : dc ? (oggi > dc ? 'ritardo' : 'ora') : 'attesa', dettaglio: dc ? `Entro il ${dataIt(dc)}: ultimo stipendio, ferie non godute, 13ª e TFR.` : 'Dopo la data di cessazione', ...(ultimo ? { azione: { tipo: 'mese', anno: ultimo.anno, mese: ultimo.mese, etichetta: 'Apri il cedolino' } } : {}) },
    { id: 'inps', titolo: 'Comunica la cessazione all\'INPS', stato: fatte.has('cess-inps') ? 'fatto' : dc ? (oggi > inps ? 'ritardo' : 'ora') : 'attesa', dettaglio: dc ? `Entro il ${dataIt(inps)} (5 giorni)` : 'Entro 5 giorni dalla fine', azione: { tipo: 'pratica', chiave: 'cessazione', etichetta: 'Guida INPS' }, ...(dc ? { manuale: 'cess-inps' } : {}) },
    { id: 'dichiarazione', titolo: 'Consegna la dichiarazione dei compensi', stato: fatte.has('cess-dich') ? 'fatto' : dc ? 'ora' : 'attesa', dettaglio: 'Con le ultime spettanze. Si stampa da Documenti.', azione: { tipo: 'vai', dest: 'documenti', etichetta: 'Documenti' }, ...(dc ? { manuale: 'cess-dich' } : {}) },
  ];
  return { id: 'fine', titolo: dc ? `Fine rapporto il ${dataIt(dc)}` : 'Fine rapporto', passi };
}

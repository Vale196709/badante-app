// Pratiche INPS guidate: quando farle, dove, e i dati da inserire, presi dall'app.
import { app, catenaCorrente, eur, esc, dataIt, oggiIso } from '../stato.js';
import { tipologia } from '../engine/tabelle.js';
const CONVIVENZA = { ore: 'non convivente', convivente: 'convivente', conviventePT: 'convivente a tempo parziale', notturna: 'non convivente (assistenza notturna)', presenza: 'non convivente (presenza notturna)' };
import { apriStampa } from './stampe.js';
import { condizioniAl, variazioniOrdinate } from '../engine/variazioni.js';
import { oreSettimanali, retribuzioneOrariaEffettiva, fasciaContributiva, euro } from '../engine/calcolo.js';
import { fmtNum } from '../engine/formato.js';

const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const orarioTesto = (o) => Object.entries(o).map(([g, h]) => `${GIORNI[g - 1]} ${String(h).replace('.', ',')} h`).join(', ');
const tab = (righe) => `<table class="dati">${righe.filter(Boolean).map(([k, v]) => `<tr><td>${esc(k)}</td><td><strong>${v}</strong></td></tr>`).join('')}</table>`;
const canali = `
  <h2>Dove si fa</h2>
  <ul>
    <li>Online sul sito <strong>www.inps.it</strong>, cercando “lavoratori domestici”, con SPID, CIE o CNS.</li>
    <li>Per telefono con il Contact Center INPS: 803 164 da rete fissa (gratuito), 06 164 164 da cellulare.</li>
    <li>In alternativa tramite un patronato o un CAF.</li>
  </ul>`;
const anag = (d) => [
  ['Datore di lavoro', `${esc(d.datore.nome)} · C.F. ${esc(d.datore.cf)}`],
  ['Residenza del datore', esc(d.datore.indirizzo || '—')],
  ['Lavoratrice', `${esc(d.lavoratrice.nome)} · C.F. ${esc(d.lavoratrice.cf || 'da inserire')}`],
  d.codiceRapportoInps ? ['Codice rapporto INPS', esc(d.codiceRapportoInps)] : null,
];

export const PRATICHE = {
  assunzione: {
    titolo: 'Comunicazione di assunzione',
    quando: (d) => `Entro le ore 24 del giorno prima dell'inizio: per l'assunzione del ${dataIt(d.dataAssunzione)}, entro il ${dataIt(new Date(new Date(d.dataAssunzione + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10))}.`,
    corpo: (d) => `
      <h2>Dati da inserire</h2>
      ${tab([
        ...anag(d),
        ['Nascita della lavoratrice', esc(d.lavoratrice.nascita || '—')],
        ['Residenza della lavoratrice', esc(d.lavoratrice.indirizzo || '—')],
        ['Data di inizio', dataIt(d.dataAssunzione)],
        ['Tipo di contratto', d.tipoContratto === 'determinato' ? `tempo determinato fino al ${dataIt(d.dataFineTermine)}` : 'tempo indeterminato'],
        ['Convivenza', CONVIVENZA[d.tipologia || 'ore']],
        ['Livello CCNL', esc(d.livello)],
        ['Ore settimanali', `${oreSettimanali(d.orario)} (${orarioTesto(d.orario)})`],
        tipologia(d).mensile ? ['Retribuzione mensile', `${eur(d.pagaMensile)}${d.vittoAlloggio ? ' + vitto e alloggio' : ''}`] : ['Retribuzione oraria', eur(d.pagaOraria)],
        ['Luogo di lavoro', esc(d.luogoLavoro || d.datore.indirizzo || '—')],
        ['CCNL', 'Lavoro domestico (Fidaldo-Domina) · adesione Cas.Sa.Colf'],
      ])}
      <h2>Dopo l'invio</h2>
      <ul>
        <li>Scarica la ricevuta e caricala in Documenti → Archivio.</li>
        <li>Copia il <strong>codice del rapporto</strong> nella scheda Rapporto: serve per i pagamenti trimestrali.</li>
        <li>Per una lavoratrice extracomunitaria servono anche i dati del permesso di soggiorno.</li>
      </ul>`,
  },
  variazione: {
    titolo: 'Comunicazione di variazione',
    quando: () => 'Quando cambiano orario, retribuzione o livello: consigliato entro 5 giorni dalla decorrenza.',
    corpo: (d) => {
      const vv = variazioniOrdinate(d);
      if (!vv.length) return '<p>Nessuna variazione registrata. Le variazioni si inseriscono in Impostazioni → Variazioni.</p>';
      return vv.map((v) => {
        const c = condizioniAl(d, v.dal);
        return `<h2>Variazione dal ${dataIt(v.dal)}</h2>${tab([
          ...anag(d),
          ['Data della variazione', dataIt(v.dal)],
          ['Nuove ore settimanali', `${oreSettimanali(c.orario)} (${orarioTesto(c.orario)})`],
          tipologia(c).mensile ? ['Nuova retribuzione mensile', eur(c.pagaMensile)] : ['Nuova retribuzione oraria', eur(c.pagaOraria)],
          ['Livello', esc(c.livello)],
        ])}`;
      }).join('');
    },
  },
  cessazione: {
    titolo: 'Comunicazione di cessazione',
    quando: (d) => `Entro 5 giorni dalla fine del rapporto${d.dataCessazione ? `: per la cessazione del ${dataIt(d.dataCessazione)}` : ''}.`,
    corpo: (d) => `
      <h2>Dati da inserire</h2>
      ${tab([...anag(d), ['Data di cessazione', d.dataCessazione ? dataIt(d.dataCessazione) : 'da indicare nella scheda Rapporto'], ['Motivo', 'licenziamento, dimissioni, risoluzione consensuale, fine del contratto o decesso']])}
      <h2>Prima e dopo</h2>
      <ul>
        <li>Paga le spettanze finali: conteggi nel Simulatore → Conteggi di fine rapporto.</li>
        <li>Paga i contributi del trimestre della cessazione: in caso di cessazione la scadenza è anticipata, verificala sul portale INPS dei pagamenti.</li>
        <li>Consegna la dichiarazione dei compensi dell'anno.</li>
      </ul>`,
  },
  contributi: {
    titolo: 'Pagamento dei contributi',
    quando: () => 'Ogni trimestre: entro il 10 aprile, 10 luglio, 10 ottobre e 10 gennaio.',
    corpo: (d) => {
      const catena = catenaCorrente();
      const trimestri = new Map();
      for (const m of catena) {
        const k = `${m.anno}-${Math.ceil(m.mese / 3)}`;
        const t = trimestri.get(k) || { anno: m.anno, q: Math.ceil(m.mese / 3), ore: 0, importo: 0, mesi: [] };
        t.ore += m.risultato.contributi.oreContributive; t.importo += m.risultato.contributi.daVersareAInps; t.mesi.push(m);
        trimestri.set(k, t);
      }
      const ultimi = [...trimestri.values()].slice(-2).reverse();
      return `
      <h2>Come si paga</h2>
      <ul>
        <li>Sul Portale dei pagamenti INPS, sezione lavoratori domestici, con SPID o CIE: si genera l'avviso pagoPA indicando le ore del trimestre e la retribuzione oraria effettiva.</li>
        <li>L'avviso si paga online, in banca, in posta, in tabaccheria o con l'app IO.</li>
        <li>Dopo il pagamento registra l'importo in Scadenze e carica la ricevuta in Archivio.</li>
      </ul>
      ${ultimi.map((t) => {
        const c = condizioniAl(d, `${t.anno}-${String(t.q * 3).padStart(2, '0')}-01`);
        return `<h2>${t.q}° trimestre ${t.anno}${t.mesi.length < 3 ? ' (parziale)' : ''}</h2>${tab([
          d.codiceRapportoInps ? ['Codice rapporto INPS', esc(d.codiceRapportoInps)] : null,
          ['Ore retribuite nel trimestre', fmtNum(t.ore, 2)],
          ['Retribuzione oraria effettiva (paga + quota di 13ª)', eur(retribuzioneOrariaEffettiva(c.pagaOraria, c, Number(oggiIso().slice(0, 4))))],
          ['Contributo orario', `${eur(fasciaContributiva(c, t.anno).totaleOrario)} INPS + Cassa Colf`],
          ['Totale stimato', eur(euro(t.importo))],
        ])}`;
      }).join('')}
      <p class="piccolo">Gli importi sono stimati dai cedolini dell'app: fa fede l'importo calcolato dal portale INPS.</p>`;
    },
  },
};

export function apriPratica(chiave) {
  const P = PRATICHE[chiave];
  const d = app.rapporto.dati;
  apriStampa(P.titolo, `
    <h1>${esc(P.titolo)} all'INPS</h1>
    <p class="meta">Guida preparata il ${dataIt(oggiIso())} con i dati dell'app</p>
    <h2>Quando</h2><p>${P.quando(d)}</p>
    ${canali}
    ${P.corpo(d)}`);
}

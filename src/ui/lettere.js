// Lettere pronte: si compilano pochi campi e si stampano (o si salvano in PDF).
import { app, catenaCorrente, eur, esc, dataIt, oggiIso } from '../stato.js';
import { apriStampa } from './stampe.js';
import { condizioniAl, variazioniOrdinate } from '../engine/variazioni.js';
import { giorniPreavviso } from '../engine/cessazione.js';
import { oreSettimanali } from '../engine/calcolo.js';
import { REGOLE_CCNL } from '../engine/tabelle.js';

const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const orarioTesto = (o) => Object.entries(o).map(([g, h]) => `${GIORNI[g - 1]} ${String(h).replace('.', ',')} ore`).join(', ');
const addGiorni = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const luogo = (d) => (d.datore.indirizzo || '').split(',').pop()?.trim() || '______________';

const intestazione = (mitt, dest) => `
  <p>${mitt}</p>
  <div class="destinatario">${dest}</div>`;
const firma = (chi, sotto = '') => `<div class="firme"><div><span>${chi}</span></div>${sotto ? `<div><span>${sotto}</span></div>` : '<div style="border:0"></div>'}</div>`;
const datore = (d) => `${esc(d.datore.nome)}<br>${esc(d.datore.indirizzo || '')}<br>C.F. ${esc(d.datore.cf)}`;
const lavoratrice = (d) => `Gentile Sig.ra<br><strong>${esc(d.lavoratrice.nome)}</strong><br>${esc(d.lavoratrice.indirizzo || '')}`;

export const LETTERE = {
  licenziamento: {
    titolo: 'Lettera di licenziamento',
    descr: 'Recesso del datore con il preavviso previsto dal CCNL',
    campi: (d) => {
      const g = giorniPreavviso(condizioniAl(d, oggiIso()), oggiIso(), 'licenziamento');
      return [
        { n: 'data', e: 'Data della lettera', t: 'date', v: oggiIso() },
        { n: 'ultimo', e: `Ultimo giorno di lavoro (preavviso CCNL: ${g} giorni)`, t: 'date', v: addGiorni(oggiIso(), g) },
        { n: 'preavviso', e: 'Preavviso', t: 'select', o: [['lavorato', 'Lavorato fino all\'ultimo giorno'], ['indennita', 'Non lavorato: pagato con l\'indennità sostitutiva']] },
        { n: 'motivo', e: 'Motivo (facoltativo)', t: 'text', v: '' },
      ];
    },
    testo: (d, f) => `
      ${intestazione(datore(d), lavoratrice(d))}
      <p>${esc(luogo(d))}, ${dataIt(f.data)}</p>
      <p class="oggetto">Oggetto: recesso dal rapporto di lavoro domestico</p>
      <p>Con la presente Le comunico il recesso dal rapporto di lavoro domestico in essere dal ${dataIt(d.dataAssunzione)}, ai sensi dell'art. 2118 del Codice civile e del CCNL sulla disciplina del rapporto di lavoro domestico${f.motivo ? `, per il seguente motivo: ${esc(f.motivo)}` : ''}.</p>
      <p>${f.preavviso === 'lavorato'
        ? `Il periodo di preavviso previsto dal CCNL decorre da oggi: il rapporto cesserà al termine della giornata del ${dataIt(f.ultimo)}.`
        : `Il rapporto cessa il ${dataIt(f.ultimo)}; il preavviso non lavorato Le sarà corrisposto con l'indennità sostitutiva prevista dal CCNL.`}</p>
      <p>Con l'ultima retribuzione Le saranno corrisposti le ferie maturate e non godute, i ratei di tredicesima e il trattamento di fine rapporto. Le sarà consegnata la dichiarazione dei compensi dell'anno. La cessazione sarà comunicata all'INPS nei termini di legge.</p>
      <p>Distinti saluti.</p>
      ${firma('Il datore di lavoro', 'La lavoratrice, per ricevuta (data e firma)')}
      <p class="piccolo">Il licenziamento non è consentito durante la gravidanza e fino al termine del congedo di maternità, né in caso di matrimonio nei termini di legge: in questi casi rivolgersi a un consulente.</p>`,
  },
  dimissioni: {
    titolo: 'Lettera di dimissioni',
    descr: 'Da far firmare alla lavoratrice se decide di lasciare il lavoro',
    campi: (d) => {
      const g = giorniPreavviso(condizioniAl(d, oggiIso()), oggiIso(), 'dimissioni');
      return [
        { n: 'data', e: 'Data della lettera', t: 'date', v: oggiIso() },
        { n: 'ultimo', e: `Ultimo giorno di lavoro (preavviso CCNL: ${g} giorni)`, t: 'date', v: addGiorni(oggiIso(), g) },
      ];
    },
    testo: (d, f) => `
      ${intestazione(`${esc(d.lavoratrice.nome)}<br>${esc(d.lavoratrice.indirizzo || '')}<br>C.F. ${esc(d.lavoratrice.cf || '')}`, `Spett.le<br><strong>${esc(d.datore.nome)}</strong><br>${esc(d.datore.indirizzo || '')}`)}
      <p>${esc(luogo(d))}, ${dataIt(f.data)}</p>
      <p class="oggetto">Oggetto: dimissioni dal rapporto di lavoro domestico</p>
      <p>Con la presente comunico le mie dimissioni dal rapporto di lavoro domestico in essere dal ${dataIt(d.dataAssunzione)}. Nel rispetto del preavviso previsto dal CCNL, il mio ultimo giorno di lavoro sarà il ${dataIt(f.ultimo)}.</p>
      <p>Chiedo che mi siano corrisposte le spettanze di fine rapporto e consegnata la dichiarazione dei compensi.</p>
      <p>Distinti saluti.</p>
      ${firma('La lavoratrice', 'Il datore di lavoro, per ricevuta')}
      <p class="piccolo">Per il lavoro domestico non è richiesta la procedura telematica delle dimissioni: è sufficiente la lettera firmata.</p>`,
  },
  anticipoTfr: {
    titolo: 'Richiesta di anticipo del TFR',
    descr: 'Richiesta della lavoratrice e ricevuta del pagamento',
    campi: () => {
      const ult = catenaCorrente().at(-1)?.risultato.contatori.tfrAccantonato ?? 0;
      const max = Math.floor(ult * REGOLE_CCNL.anticipoTfrMassimo * 100) / 100;
      return [
        { n: 'data', e: 'Data', t: 'date', v: oggiIso() },
        { n: 'importo', e: `Importo richiesto (massimo ${eur(max)}, il 70% di ${eur(ult)})`, t: 'text', v: String(max.toFixed(2)).replace('.', ',') },
        { n: '_max', t: 'hidden', v: max }, { n: '_tfr', t: 'hidden', v: ult },
      ];
    },
    testo: (d, f) => `
      ${intestazione(`${esc(d.lavoratrice.nome)}<br>C.F. ${esc(d.lavoratrice.cf || '')}`, `Spett.le<br><strong>${esc(d.datore.nome)}</strong>`)}
      <p>${esc(luogo(d))}, ${dataIt(f.data)}</p>
      <p class="oggetto">Oggetto: richiesta di anticipo del trattamento di fine rapporto</p>
      <p>La sottoscritta chiede un anticipo del trattamento di fine rapporto pari a <strong>${esc(f.importo)} €</strong>, nel limite del 70% del TFR maturato (${eur(f._tfr)} alla data odierna), come previsto dal CCNL sulla disciplina del rapporto di lavoro domestico.</p>
      ${firma('La lavoratrice')}
      <h2>Ricevuta</h2>
      <p>La sottoscritta dichiara di aver ricevuto in data ____________ la somma di ${esc(f.importo)} € a titolo di anticipo del TFR, che sarà detratta da quanto spettante alla cessazione del rapporto.</p>
      ${firma('La lavoratrice', 'Il datore di lavoro')}
      <p class="piccolo">Nell'app l'anticipo va inserito nel cedolino del mese di pagamento (campo "Anticipo TFR in questo mese").</p>`,
  },
  ferie: {
    titolo: 'Accordo sulle ferie',
    descr: 'Periodo di ferie concordato, da firmare in due copie',
    campi: () => [
      { n: 'dal', e: 'Dal', t: 'date', v: oggiIso() },
      { n: 'al', e: 'Al (compreso)', t: 'date', v: addGiorni(oggiIso(), 13) },
      { n: 'note', e: 'Note (facoltative)', t: 'text', v: '' },
    ],
    testo: (d, f) => `
      <h1>Accordo sul periodo di ferie</h1>
      <p>Tra ${esc(d.datore.nome)} (datore di lavoro) e ${esc(d.lavoratrice.nome)} (lavoratrice) si concorda che la lavoratrice fruirà delle ferie dal <strong>${dataIt(f.dal)}</strong> al <strong>${dataIt(f.al)}</strong> compresi, con ripresa del lavoro il giorno lavorativo successivo.</p>
      <p>Durante le ferie spetta la normale retribuzione. ${f.note ? esc(f.note) : ''}</p>
      <p>${esc(luogo(d))}, ${dataIt(oggiIso())}</p>
      ${firma('Il datore di lavoro', 'La lavoratrice')}`,
  },
  variazione: {
    titolo: 'Comunicazione di variazione',
    descr: 'Nuova paga, orario o livello, da far firmare per accettazione',
    campi: (d) => {
      const vv = variazioniOrdinate(d);
      return vv.length
        ? [{ n: 'quale', e: 'Variazione', t: 'select', o: vv.map((v, i) => [String(i), `Dal ${dataIt(v.dal)}`]).reverse() }, { n: 'data', e: 'Data della lettera', t: 'date', v: oggiIso() }]
        : [{ n: '_vuoto', t: 'info', e: 'Nessuna variazione registrata: aggiungila prima in Impostazioni → Variazioni.' }];
    },
    testo: (d, f) => {
      const v = variazioniOrdinate(d)[Number(f.quale)];
      if (!v) return '<p>Nessuna variazione selezionata.</p>';
      const c = condizioniAl(d, v.dal);
      return `
      ${intestazione(datore(d), lavoratrice(d))}
      <p>${esc(luogo(d))}, ${dataIt(f.data)}</p>
      <p class="oggetto">Oggetto: variazione delle condizioni del rapporto di lavoro domestico</p>
      <p>Con riferimento al rapporto di lavoro in essere dal ${dataIt(d.dataAssunzione)}, Le comunico che dal <strong>${dataIt(v.dal)}</strong> le condizioni saranno le seguenti:</p>
      <ul>
        <li>retribuzione oraria lorda: <strong>${eur(c.pagaOraria)}</strong>${v.pagaOraria != null ? ' (variata)' : ''};</li>
        <li>livello di inquadramento: <strong>${esc(c.livello)}</strong>${v.livello ? ' (variato)' : ''};</li>
        <li>orario: <strong>${oreSettimanali(c.orario)} ore settimanali</strong>, ${orarioTesto(c.orario)}${v.orario ? ' (variato)' : ''}.</li>
      </ul>
      <p>Restano invariate tutte le altre condizioni. La variazione sarà comunicata all'INPS.</p>
      ${firma('Il datore di lavoro', 'La lavoratrice, per accettazione')}`;
    },
  },
  proroga: {
    titolo: 'Proroga del contratto a termine',
    descr: 'Per prolungare un contratto a tempo determinato',
    campi: (d) => [
      { n: 'data', e: 'Data della lettera', t: 'date', v: oggiIso() },
      { n: 'nuovaFine', e: 'Nuova scadenza', t: 'date', v: d.dataFineTermine ? addGiorni(d.dataFineTermine, 30) : addGiorni(oggiIso(), 30) },
      { n: 'motivo', e: 'Motivo', t: 'text', v: 'sostituzione della lavoratrice titolare assente per ferie' },
    ],
    testo: (d, f) => `
      ${intestazione(datore(d), lavoratrice(d))}
      <p>${esc(luogo(d))}, ${dataIt(f.data)}</p>
      <p class="oggetto">Oggetto: proroga del contratto di lavoro domestico a tempo determinato</p>
      <p>Il contratto a tempo determinato in essere dal ${dataIt(d.dataAssunzione)}${d.dataFineTermine ? ` con scadenza ${dataIt(d.dataFineTermine)}` : ''} è prorogato fino al <strong>${dataIt(f.nuovaFine)}</strong>, per il seguente motivo: ${esc(f.motivo)}. Restano invariate le altre condizioni.</p>
      ${firma('Il datore di lavoro', 'La lavoratrice, per accettazione')}
      <p class="piccolo">La proroga va comunicata all'INPS entro 5 giorni. Aggiorna anche la data di fine nella scheda Rapporto.</p>`,
  },
  trasformazione: {
    titolo: 'Trasformazione a tempo indeterminato',
    descr: 'Da contratto a termine a tempo indeterminato',
    campi: () => [
      { n: 'data', e: 'Data della lettera', t: 'date', v: oggiIso() },
      { n: 'dal', e: 'Decorrenza', t: 'date', v: oggiIso() },
    ],
    testo: (d, f) => `
      ${intestazione(datore(d), lavoratrice(d))}
      <p>${esc(luogo(d))}, ${dataIt(f.data)}</p>
      <p class="oggetto">Oggetto: trasformazione del rapporto di lavoro domestico a tempo indeterminato</p>
      <p>Il rapporto di lavoro a tempo determinato in essere dal ${dataIt(d.dataAssunzione)} prosegue a tempo indeterminato a decorrere dal <strong>${dataIt(f.dal)}</strong>, alle stesse condizioni.</p>
      ${firma('Il datore di lavoro', 'La lavoratrice, per accettazione')}
      <p class="piccolo">La trasformazione va comunicata all'INPS entro 5 giorni. Aggiorna il tipo di contratto nella scheda Rapporto.</p>`,
  },
};

/** Apre il modulo della lettera e poi l'anteprima di stampa. */
export function apriLettera(dlg, chiave) {
  const L = LETTERE[chiave];
  const d = app.rapporto.dati;
  const campi = L.campi(d);
  dlg.innerHTML = `
    <form method="dialog" class="form-giorno">
      <h3>${esc(L.titolo)}</h3>
      <p class="nota" style="margin-bottom:12px">${esc(L.descr)}</p>
      ${campi.map((c) => c.t === 'hidden' ? `<input type="hidden" name="${c.n}" value="${esc(c.v)}" />`
        : c.t === 'info' ? `<p class="avviso attenzione">${esc(c.e)}</p>`
        : c.t === 'select' ? `<label>${esc(c.e)}<select name="${c.n}">${c.o.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`
        : `<label>${esc(c.e)}<input type="${c.t}" name="${c.n}" value="${esc(c.v ?? '')}" /></label>`).join('')}
      <div class="riga fine">
        <button value="annulla" class="secondario">Annulla</button>
        ${campi.some((c) => c.t === 'info') ? '' : '<button value="ok" class="primario">Prepara la lettera</button>'}
      </div>
    </form>`;
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    const f = Object.fromEntries(new FormData(dlg.querySelector('form')));
    apriStampa(L.titolo, L.testo(d, f));
  };
  dlg.showModal();
}


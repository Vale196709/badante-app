// Versioni dell'app e novità principali.
export const VERSIONE = __VERSIONE__;
export const DATA_BUILD = __DATA_BUILD__;

export const NOVITA = [
  { versione: '1.4.0', data: '2026-10-29', voci: [
    'Nuovo nome: Badante di Maria',
    'Nuovi colori: blu notte e ambra',
    'Report: consuntivo e previsione dell\'anno, composizione dei costi, uscite dei prossimi 90 giorni',
    'Ripristino da backup con anteprima, anche come nuovo rapporto e con i file dell\'archivio',
    'Versione e data di aggiornamento visibili',
  ] },
  { versione: '1.3.0', data: '2026-10-29', voci: [
    'Grafica stile iPhone con barra in basso e colonna laterale su PC',
    'Più rapporti di lavoro, variazioni di paga e orario',
    'Lettere pronte e pratiche INPS guidate',
    'Promemoria via email e notifiche (da configurare)',
  ] },
  { versione: '1.2.0', data: '2026-10-29', voci: [
    'Archivio documenti, registro dei versamenti INPS',
    'Richieste di ferie e permessi, firma col dito, vista lavoratrice in 5 lingue',
    'Tabelle annuali modificabili, backup JSON e CSV',
  ] },
  { versione: '1.1.0', data: '2026-10-29', voci: ['Importi nel formato 1.234,56 €', 'Paga oraria netta nel simulatore'] },
  { versione: '1.0.0', data: '2026-10-29', voci: ['Presenze, cedolini, scadenze, simulatore, documenti, accessi profilati'] },
];

export const dataBuildIt = () => {
  const d = new Date(DATA_BUILD);
  return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' })} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}`;
};

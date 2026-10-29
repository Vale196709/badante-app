// Icone a tratto (24×24, colore del testo), disegnate per l'app.
const svg = (corpo, classe = 'ico') => `<svg class="${classe}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;

export const ICONE = {
  casa: svg('<path d="M3.5 10.5 12 4l8.5 6.5"/><path d="M5.5 9v10.5h13V9"/><path d="M10 19.5v-5h4v5"/>'),
  calendario: svg('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 13h2M12 13h2M16 13h0M8 16.5h2M12 16.5h2"/>'),
  campana: svg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  documento: svg('<path d="M7 3.5h7l4.5 4.5v12.5H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M13.5 3.5V8.5h5"/><path d="M9 13h6M9 16.5h6"/>'),
  altro: svg('<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>'),
  bilancia: svg('<path d="M12 4v16M7 20h10"/><path d="M5 7h14"/><path d="M5 7 2.5 13a3 3 0 0 0 5 0z"/><path d="M19 7l-2.5 6a3 3 0 0 0 5 0z"/>'),
  ingranaggio: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/>'),
  persone: svg('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.3a4.6 4.6 0 0 1 5.5 4.7"/>'),
  persona: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
  esci: svg('<path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5"/>'),
  euro: svg('<path d="M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5"/><path d="M4.5 10.5h8M4.5 13.5h8"/>'),
  valigia: svg('<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5h6v2M3.5 12.5h17"/>'),
  firma: svg('<path d="M3.5 17c3-4 4.5-9 2.5-9S3 16 7 16s5-5 6-5-1 5 1 5 3-2 3-2"/><path d="M14 20h6.5"/>'),
  chevron: svg('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>', 'ico chev'),
  piu: svg('<path d="M12 5v14M5 12h14"/>'),
  scambia: svg('<path d="M5 8.5h13l-3.5-3.5M19 15.5H6l3.5 3.5"/>'),
  nuvola: svg('<path d="M7 18.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6-1.3A4.5 4.5 0 0 1 17.5 18.5z"/><path d="M12 11v5M9.8 13.2 12 11l2.2 2.2"/>'),
  orologio: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  scudo: svg('<path d="M12 3.5 5 6v5.5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  matita: svg('<path d="M15.5 4.5l4 4L8.5 19.5H4.5v-4z"/><path d="m13.5 6.5 4 4"/>'),
  tabella: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>'),
  busta: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 6.5 8 6 8-6"/>'),
  inps: svg('<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 11.5h8M8 15h5"/>'),
  grafico: svg('<path d="M4 19.5h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>'),
};

/** Riquadro colorato con icona bianca, come nelle Impostazioni di iOS. */
export const tessera = (icona, colore) => `<span class="tessera" style="--t:${colore}">${ICONE[icona]}</span>`;

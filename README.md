# App Badante – gestione del lavoro domestico (CCNL)

Web app installabile su PC e iPhone per gestire un rapporto di lavoro domestico non convivente:
presenze, cedolini, costi, contributi, scadenze, documenti e accessi profilati.

Online: https://vale196709.github.io/badante-app/

## Funzioni
- **Riepilogo**: mese corrente, contatori (ferie, TFR, 13ª, malattia), scadenze, avvisi, costi dell'anno.
- **Presenze e cedolini**: calendario giorno per giorno (lavorato, ferie, malattia, permessi, assenze,
  ore extra e straordinari), cedolino calcolato in tempo reale, bozza → confermato → pagato, stampa/PDF.
- **Scadenze**: contributi INPS trimestrali con importo, stipendi, 13ª, dichiarazione annuale,
  aggiornamenti tabelle, fine prova, documenti; esportazione nel calendario (.ics).
- **Simulatore**: confronto di tre scenari di costo e conteggi di fine rapporto (preavviso, ferie, 13ª, TFR).
- **Documenti**: lettera di assunzione, informativa privacy, dichiarazione annuale dei compensi,
  prospetto costi con contributi deducibili, prospetto TFR, conteggi di cessazione.
- **Accessi**: titolare, gestore (familiare/consulente), sola lettura, lavoratrice (vede i suoi cedolini
  confermati e conferma la ricevuta).

## Struttura
- `src/engine/` motore di calcolo (tabelle annuali, cedolino, presenze, catena mensile, scadenze,
  riepilogo annuo, cessazione) – coperto da test (`npm test`).
- `src/ui/` schermate; `src/lib/` accesso a Supabase.
- `supabase/` script SQL da eseguire nel SQL Editor (01 poi 02).

## Aggiornamento annuale
A inizio anno aggiungere in `src/engine/tabelle.js` il blocco del nuovo anno (minimi CCNL e circolare INPS)
e il dato ISTAT di dicembre per la rivalutazione del TFR. Senza tabelle l'app usa l'ultimo anno disponibile
e lo segnala.

## Sviluppo
    npm install
    npm test
    npm run dev

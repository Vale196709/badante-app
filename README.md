# Badante di Maria – gestione del lavoro domestico (CCNL)

Web app installabile su PC e iPhone per gestire un rapporto di lavoro domestico non convivente:
presenze, cedolini, costi, contributi, scadenze, documenti e accessi profilati.

Online: https://vale196709.github.io/badante-app/

## Funzioni
- **Report**: consuntivo e previsione dell'anno, composizione dei costi, maturato verso la lavoratrice, uscite dei prossimi 90 giorni, anche per più rapporti; stampa.
- **Riepilogo**: mese corrente, contatori (ferie, TFR, 13ª, malattia), scadenze, avvisi, costi dell'anno.
- **Presenze e cedolini**: calendario giorno per giorno (lavorato, ferie, malattia, permessi, assenze,
  ore extra e straordinari), cedolino calcolato in tempo reale, bozza → confermato → pagato, stampa/PDF.
- **Scadenze**: contributi INPS trimestrali con importo, stipendi, 13ª, dichiarazione annuale,
  aggiornamenti tabelle, fine prova, documenti; esportazione nel calendario (.ics).
- **Simulatore**: confronto di tre scenari di costo e conteggi di fine rapporto (preavviso, ferie, 13ª, TFR).
- **Documenti**: lettera di assunzione, informativa privacy, dichiarazione annuale dei compensi,
  prospetto costi con contributi deducibili, prospetto TFR, conteggi di cessazione.
- **Archivio**: file del rapporto (ricevute pagoPA, certificati, documenti) su Supabase Storage, condivisibili con la lavoratrice.
- **Versamenti INPS**: registrazione dei pagamenti trimestrali, confronto con il dovuto, deduzione calcolata sul pagato.
- **Richieste di ferie e permessi**: la lavoratrice chiede, titolare o gestore approvano e le presenze si aggiornano.
- **Backup e ripristino**: copia completa anche con i file dell'archivio; ripristino con anteprima, nel rapporto attuale o come nuovo.
- **Impostazioni**: dati del rapporto, tabelle annuali modificabili (minimi CCNL, contributi INPS, Cassa Colf,
  inflazione per il TFR), accessi, backup (JSON completo, CSV per Excel, ripristino).
- **Accessi**: titolare, gestore (familiare/consulente), sola lettura, lavoratrice (vede i suoi cedolini
  confermati, firma la ricevuta col dito, chiede ferie e permessi, vede i documenti condivisi;
  interfaccia in italiano, română, українська, русский, English).
- **Variazioni**: paga, orario e livello che cambiano nel tempo, con decorrenza dal primo del mese.
- **Più rapporti**: per esempio una sostituta durante le ferie, ognuno con i suoi cedolini.
- **Lettere pronte**: licenziamento, dimissioni, anticipo TFR, accordo ferie, variazione, proroga, trasformazione.
- **Pratiche INPS guidate**: assunzione, variazione, contributi trimestrali, cessazione, con i dati da inserire.
- **Promemoria**: email (Gmail) e notifiche sul telefono ogni mattina, da GitHub Actions (`scripts/promemoria.mjs`).
- **Keep-alive**: un'attività GitHub due volte a settimana tiene attivo il progetto Supabase gratuito.

## Versioni
La versione è in `package.json` e le novità in `src/novita.js`; versione e data di aggiornamento compaiono in Altro → Informazioni.

## Struttura
- `src/engine/` motore di calcolo (tabelle annuali, cedolino, presenze, catena mensile, scadenze,
  riepilogo annuo, cessazione) – coperto da test (`npm test`).
- `src/ui/` schermate; `src/lib/` accesso a Supabase.
- `supabase/` script SQL da eseguire nel SQL Editor, in ordine: 01, 02, 03, 04.

## Aggiornamento annuale
A inizio anno, in Impostazioni → Tabelle annuali: "+ Nuovo anno", aggiornare minimi CCNL e contributi INPS
dalla circolare, salvare. Inserire anche il dato ISTAT di dicembre dell'anno chiuso per la rivalutazione del TFR. Senza tabelle l'app usa l'ultimo anno disponibile
e lo segnala.

## Sviluppo
    npm install
    npm test
    npm run dev

## Promemoria: configurazione una tantum
1. In Supabase crea un utente per i promemoria (Auto Confirm) e invitalo nell'app come "Sola lettura".
2. In GitHub → Settings → Secrets and variables → Actions crea:
   `PROMEMORIA_EMAIL`, `PROMEMORIA_PASSWORD` (l'utente del punto 1),
   `GMAIL_USER`, `GMAIL_APP_PASSWORD` (password per le app di Google),
   `VAPID_PRIVATE_KEY` (chiave privata delle notifiche).
3. In Impostazioni → Promemoria attiva gli invii e, sul telefono, le notifiche.

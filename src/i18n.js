// Traduzioni della vista della lavoratrice. I documenti restano in italiano (testo valido),
// con la traduzione affiancata delle voci.
export const LINGUE = { it: 'Italiano', ro: 'Română', uk: 'Українська', ru: 'Русский', en: 'English' };

const T = {
  it: {
    daFare: 'Da fare', firmaDi: 'Firma la ricevuta di {mese}', giorniDaSegnare: 'Giorni senza ore segnate: {n}', segnaOre: 'Segna le ore', firmaBreve: 'Firma',
    tabOre: 'Le mie ore', oreTitolo: 'Segna le ore lavorate', oreSpiega: 'Scrivi le ore lavorate ogni giorno e premi Invia: il datore le approva e il cedolino si prepara da solo.', previste: 'previste', comeOrario: 'Come da orario', inviaOre: 'Invia le ore', oreInviate: 'Ore inviate', inCoda: 'da inviare', oreInCoda: 'Niente rete: ore salvate sul telefono, partono da sole appena torna la connessione.', codaAvviso: 'Alcune ore sono salvate sul telefono e non sono ancora partite: verranno inviate appena c\'è rete.', codaInviata: 'Ore salvate sul telefono inviate.', nienteDaInviare: 'Nessuna ora nuova da inviare.', meseChiuso: 'Mese già chiuso: le ore non si possono più cambiare.', riposo: 'riposo', festivo: 'festivo', tabCedolini: 'I miei cedolini', tabRichieste: 'Ferie e permessi', tabDocumenti: 'Documenti',
    permessiResidui: 'Permessi retribuiti residui', ferieResidue: 'Ferie residue', ore: 'ore', tfr: 'TFR accantonato', aggiornati: 'Valori aggiornati all\'ultimo cedolino confermato.',
    vedi: 'Vedi', ricevutoIl: 'ricevuto il', confermoRicevuto: 'Confermo di aver ricevuto', firmaQui: 'Firma qui con il dito',
    cancella: 'Cancella', conferma: 'Conferma', annulla: 'Annulla', ricevutaOk: 'Ricevuta confermata', nessunCedolino: 'Non ci sono ancora cedolini da visualizzare.',
    nuovaRichiesta: 'Nuova richiesta', tipo: 'Tipo', ferie: 'Ferie', permesso: 'Permesso', dal: 'Dal', al: 'Al',
    orePermesso: 'Ore (solo per un permesso di poche ore)', nota: 'Nota', invia: 'Invia richiesta',
    inAttesa: 'In attesa', approvata: 'Approvata', rifiutata: 'Rifiutata', ritira: 'Ritira', inviata: 'Richiesta inviata',
    mieRichieste: 'Le mie richieste', nessunaRichiesta: 'Nessuna richiesta.', risposta: 'Risposta',
    docCondivisi: 'Documenti condivisi con te', nessunDocumento: 'Nessun documento.', apri: 'Apri', esci: 'Esci', lingua: 'Lingua',
    domandaRicevuta: 'Confermi di aver ricevuto {importo} per {mese}?', firmaVuota: 'Firma prima di confermare.',
    mesi: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
    voci: {},
  },
  ro: {
    daFare: 'De făcut', firmaDi: 'Semnează chitanța pentru {mese}', giorniDaSegnare: 'Zile fără ore notate: {n}', segnaOre: 'Notează orele', firmaBreve: 'Semnează',
    tabOre: 'Orele mele', oreTitolo: 'Notează orele lucrate', oreSpiega: 'Scrie orele lucrate în fiecare zi și apasă Trimite: angajatorul le aprobă și fluturașul se pregătește singur.', previste: 'prevăzute', comeOrario: 'Ca în program', inviaOre: 'Trimite orele', oreInviate: 'Ore trimise', inCoda: 'de trimis', oreInCoda: 'Fără internet: orele sunt salvate pe telefon și pleacă singure când revine conexiunea.', codaAvviso: 'Unele ore sunt salvate pe telefon și nu au fost încă trimise: pleacă imediat ce există semnal.', codaInviata: 'Orele salvate pe telefon au fost trimise.', nienteDaInviare: 'Nicio oră nouă de trimis.', meseChiuso: 'Luna este închisă: orele nu mai pot fi modificate.', riposo: 'liber', festivo: 'sărbătoare', tabCedolini: 'Fluturașii mei', tabRichieste: 'Concedii și învoiri', tabDocumenti: 'Documente',
    permessiResidui: 'Învoiri plătite rămase', ferieResidue: 'Concediu rămas', ore: 'ore', tfr: 'TFR acumulat (indemnizație de sfârșit de contract)', aggiornati: 'Valori actualizate la ultimul fluturaș confirmat.',
    vedi: 'Vezi', ricevutoIl: 'primit la', confermoRicevuto: 'Confirm că am primit', firmaQui: 'Semnați aici cu degetul',
    cancella: 'Șterge', conferma: 'Confirmă', annulla: 'Anulează', ricevutaOk: 'Primire confirmată', nessunCedolino: 'Nu există încă fluturași de salariu.',
    nuovaRichiesta: 'Cerere nouă', tipo: 'Tip', ferie: 'Concediu', permesso: 'Învoire', dal: 'De la', al: 'Până la',
    orePermesso: 'Ore (doar pentru o învoire de câteva ore)', nota: 'Notă', invia: 'Trimite cererea',
    inAttesa: 'În așteptare', approvata: 'Aprobată', rifiutata: 'Respinsă', ritira: 'Retrage', inviata: 'Cerere trimisă',
    mieRichieste: 'Cererile mele', nessunaRichiesta: 'Nicio cerere.', risposta: 'Răspuns',
    docCondivisi: 'Documente partajate cu tine', nessunDocumento: 'Niciun document.', apri: 'Deschide', esci: 'Ieșire', lingua: 'Limbă',
    domandaRicevuta: 'Confirmați că ați primit {importo} pentru {mese}?', firmaVuota: 'Semnați înainte de a confirma.',
    mesi: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
    voci: {
      titolo: 'Fluturaș de salariu', ORD: 'Ore normale lucrate', AGG: 'Ore în plus (tarif normal)', FES: 'Sărbători plătite',
      FER: 'Concediu de odihnă', PER: 'Învoiri plătite', MEN: 'Salariu lunar', ASS: 'Absențe neplătite', MALNP: 'Boală peste zilele plătite', MAL50: 'Boală, zilele 1–3 (50%)', MAL100: 'Boală din ziua a 4-a (100%)',
      STD: 'Ore suplimentare de zi (+25%)', STN: 'Ore suplimentare de noapte (+50%)', STF: 'Ore suplimentare duminică/sărbătoare (+60%)',
      FLV: 'Ore lucrate în zi de sărbătoare (+60%)', '13M': 'Al 13-lea salariu (rată lunară)', '13A': 'Al 13-lea salariu',
      INPS: 'Contribuții INPS reținute', CCOLF: 'Contribuție Cassa Colf reținută', lordo: 'Total brut', netto: 'NET DE PLATĂ', anticipo: 'Avans TFR',
    },
  },
  uk: {
    daFare: 'Зробити', firmaDi: 'Підпишіть квитанцію за {mese}', giorniDaSegnare: 'Дні без відмічених годин: {n}', segnaOre: 'Відмітити години', firmaBreve: 'Підписати',
    tabOre: 'Мої години', oreTitolo: 'Відмітьте відпрацьовані години', oreSpiega: 'Записуйте відпрацьовані години щодня й натисніть «Надіслати»: роботодавець їх підтвердить, і розрахунковий лист підготується сам.', previste: 'за графіком', comeOrario: 'За графіком', inviaOre: 'Надіслати години', oreInviate: 'Години надіслано', inCoda: 'очікує надсилання', oreInCoda: 'Немає мережі: години збережено на телефоні, вони надішлються самі, щойно з\'явиться зв\'язок.', codaAvviso: 'Деякі години збережено на телефоні й ще не надіслано: вони надішлються, щойно з\'явиться мережа.', codaInviata: 'Години з телефону надіслано.', nienteDaInviare: 'Немає нових годин для надсилання.', meseChiuso: 'Місяць закрито: години вже не можна змінити.', riposo: 'вихідний', festivo: 'свято', tabCedolini: 'Мої розрахункові листи', tabRichieste: 'Відпустки та відгули', tabDocumenti: 'Документи',
    permessiResidui: 'Залишок оплачуваних відгулів', ferieResidue: 'Залишок відпустки', ore: 'год', tfr: 'Накопичений TFR (вихідна допомога)', aggiornati: 'Дані станом на останній підтверджений розрахунковий лист.',
    vedi: 'Переглянути', ricevutoIl: 'отримано', confermoRicevuto: 'Підтверджую, що отримала', firmaQui: 'Підпишіть тут пальцем',
    cancella: 'Очистити', conferma: 'Підтвердити', annulla: 'Скасувати', ricevutaOk: 'Отримання підтверджено', nessunCedolino: 'Розрахункових листів ще немає.',
    nuovaRichiesta: 'Новий запит', tipo: 'Тип', ferie: 'Відпустка', permesso: 'Відгул', dal: 'З', al: 'По',
    orePermesso: 'Години (лише для відгулу на кілька годин)', nota: 'Примітка', invia: 'Надіслати запит',
    inAttesa: 'Очікує', approvata: 'Схвалено', rifiutata: 'Відхилено', ritira: 'Відкликати', inviata: 'Запит надіслано',
    mieRichieste: 'Мої запити', nessunaRichiesta: 'Запитів немає.', risposta: 'Відповідь',
    docCondivisi: 'Документи, доступні вам', nessunDocumento: 'Документів немає.', apri: 'Відкрити', esci: 'Вийти', lingua: 'Мова',
    domandaRicevuta: 'Підтверджуєте, що отримали {importo} за {mese}?', firmaVuota: 'Спочатку підпишіть.',
    mesi: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
    voci: {
      titolo: 'Розрахунковий лист', ORD: 'Відпрацьовані звичайні години', AGG: 'Додаткові години (звичайна ставка)', FES: 'Оплачувані свята',
      FER: 'Відпустка', PER: 'Оплачувані відгули', MEN: 'Місячна зарплата', ASS: 'Неоплачувані відсутності', MALNP: 'Лікарняний понад оплачувані дні', MAL50: 'Лікарняний, дні 1–3 (50%)', MAL100: 'Лікарняний з 4-го дня (100%)',
      STD: 'Понаднормові денні (+25%)', STN: 'Понаднормові нічні (+50%)', STF: 'Понаднормові в неділю/свято (+60%)',
      FLV: 'Години, відпрацьовані у свято (+60%)', '13M': '13-та зарплата (щомісячна частина)', '13A': '13-та зарплата',
      INPS: 'Утримані внески INPS', CCOLF: 'Утриманий внесок Cassa Colf', lordo: 'Разом брутто', netto: 'ДО ВИПЛАТИ (НЕТТО)', anticipo: 'Аванс TFR',
    },
  },
  ru: {
    daFare: 'Нужно сделать', firmaDi: 'Подпишите квитанцию за {mese}', giorniDaSegnare: 'Дни без отмеченных часов: {n}', segnaOre: 'Отметить часы', firmaBreve: 'Подписать',
    tabOre: 'Мои часы', oreTitolo: 'Отметьте отработанные часы', oreSpiega: 'Записывайте отработанные часы каждый день и нажмите «Отправить»: работодатель их подтвердит, и расчётный лист подготовится сам.', previste: 'по графику', comeOrario: 'По графику', inviaOre: 'Отправить часы', oreInviate: 'Часы отправлены', inCoda: 'ожидает отправки', oreInCoda: 'Нет сети: часы сохранены на телефоне и отправятся сами, когда появится связь.', codaAvviso: 'Некоторые часы сохранены на телефоне и ещё не отправлены: они уйдут, как только появится сеть.', codaInviata: 'Часы с телефона отправлены.', nienteDaInviare: 'Нет новых часов для отправки.', meseChiuso: 'Месяц закрыт: часы больше нельзя изменить.', riposo: 'выходной', festivo: 'праздник', tabCedolini: 'Мои расчётные листы', tabRichieste: 'Отпуска и отгулы', tabDocumenti: 'Документы',
    permessiResidui: 'Остаток оплачиваемых отгулов', ferieResidue: 'Остаток отпуска', ore: 'ч', tfr: 'Накопленный TFR (выходное пособие)', aggiornati: 'Данные на момент последнего подтверждённого расчётного листа.',
    vedi: 'Посмотреть', ricevutoIl: 'получено', confermoRicevuto: 'Подтверждаю получение', firmaQui: 'Распишитесь здесь пальцем',
    cancella: 'Очистить', conferma: 'Подтвердить', annulla: 'Отмена', ricevutaOk: 'Получение подтверждено', nessunCedolino: 'Расчётных листов пока нет.',
    nuovaRichiesta: 'Новый запрос', tipo: 'Тип', ferie: 'Отпуск', permesso: 'Отгул', dal: 'С', al: 'По',
    orePermesso: 'Часы (только для отгула на несколько часов)', nota: 'Примечание', invia: 'Отправить запрос',
    inAttesa: 'Ожидает', approvata: 'Одобрено', rifiutata: 'Отклонено', ritira: 'Отозвать', inviata: 'Запрос отправлен',
    mieRichieste: 'Мои запросы', nessunaRichiesta: 'Запросов нет.', risposta: 'Ответ',
    docCondivisi: 'Документы, доступные вам', nessunDocumento: 'Документов нет.', apri: 'Открыть', esci: 'Выйти', lingua: 'Язык',
    domandaRicevuta: 'Подтверждаете получение {importo} за {mese}?', firmaVuota: 'Сначала распишитесь.',
    mesi: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    voci: {
      titolo: 'Расчётный лист', ORD: 'Отработанные обычные часы', AGG: 'Дополнительные часы (обычная ставка)', FES: 'Оплачиваемые праздники',
      FER: 'Отпуск', PER: 'Оплачиваемые отгулы', MEN: 'Месячная зарплата', ASS: 'Неоплачиваемые отсутствия', MALNP: 'Больничный сверх оплачиваемых дней', MAL50: 'Больничный, дни 1–3 (50%)', MAL100: 'Больничный с 4-го дня (100%)',
      STD: 'Сверхурочные дневные (+25%)', STN: 'Сверхурочные ночные (+50%)', STF: 'Сверхурочные в воскресенье/праздник (+60%)',
      FLV: 'Часы, отработанные в праздник (+60%)', '13M': '13-я зарплата (ежемесячная часть)', '13A': '13-я зарплата',
      INPS: 'Удержанные взносы INPS', CCOLF: 'Удержанный взнос Cassa Colf', lordo: 'Итого брутто', netto: 'К ВЫПЛАТЕ (НЕТТО)', anticipo: 'Аванс TFR',
    },
  },
  en: {
    daFare: 'To do', firmaDi: 'Sign the receipt for {mese}', giorniDaSegnare: 'Days without hours logged: {n}', segnaOre: 'Log hours', firmaBreve: 'Sign',
    tabOre: 'My hours', oreTitolo: 'Record the hours you worked', oreSpiega: 'Write the hours you worked each day and press Send: your employer approves them and the payslip is prepared automatically.', previste: 'scheduled', comeOrario: 'As scheduled', inviaOre: 'Send hours', oreInviate: 'Hours sent', inCoda: 'waiting to send', oreInCoda: 'No connection: hours saved on the phone, they will be sent automatically when you are back online.', codaAvviso: 'Some hours are saved on the phone and not sent yet: they will go as soon as there is a connection.', codaInviata: 'Hours saved on the phone have been sent.', nienteDaInviare: 'No new hours to send.', meseChiuso: 'Month closed: hours can no longer be changed.', riposo: 'day off', festivo: 'holiday', tabCedolini: 'My payslips', tabRichieste: 'Holidays and leave', tabDocumenti: 'Documents',
    permessiResidui: 'Paid leave hours left', ferieResidue: 'Holiday left', ore: 'hours', tfr: 'Severance pay (TFR) accrued', aggiornati: 'Figures as of the last confirmed payslip.',
    vedi: 'View', ricevutoIl: 'received on', confermoRicevuto: 'I confirm I received', firmaQui: 'Sign here with your finger',
    cancella: 'Clear', conferma: 'Confirm', annulla: 'Cancel', ricevutaOk: 'Receipt confirmed', nessunCedolino: 'No payslips yet.',
    nuovaRichiesta: 'New request', tipo: 'Type', ferie: 'Holiday', permesso: 'Leave', dal: 'From', al: 'To',
    orePermesso: 'Hours (only for a few hours of leave)', nota: 'Note', invia: 'Send request',
    inAttesa: 'Pending', approvata: 'Approved', rifiutata: 'Declined', ritira: 'Withdraw', inviata: 'Request sent',
    mieRichieste: 'My requests', nessunaRichiesta: 'No requests.', risposta: 'Reply',
    docCondivisi: 'Documents shared with you', nessunDocumento: 'No documents.', apri: 'Open', esci: 'Log out', lingua: 'Language',
    domandaRicevuta: 'Do you confirm you received {importo} for {mese}?', firmaVuota: 'Please sign before confirming.',
    mesi: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    voci: {
      titolo: 'Payslip', ORD: 'Regular hours worked', AGG: 'Extra hours (normal rate)', FES: 'Paid public holidays',
      FER: 'Holiday taken', PER: 'Paid leave', MEN: 'Monthly salary', ASS: 'Unpaid absences', MALNP: 'Sick leave beyond paid days', MAL50: 'Sick leave, days 1–3 (50%)', MAL100: 'Sick leave from day 4 (100%)',
      STD: 'Overtime, daytime (+25%)', STN: 'Overtime, night (+50%)', STF: 'Overtime, Sunday/holiday (+60%)',
      FLV: 'Hours worked on a public holiday (+60%)', '13M': '13th-month pay (monthly share)', '13A': '13th-month pay',
      INPS: 'INPS contributions withheld', CCOLF: 'Cassa Colf contribution withheld', lordo: 'Gross total', netto: 'NET PAY', anticipo: 'TFR advance',
    },
  },
};

const CHIAVE = 'badante-lingua';
export function linguaCorrente() {
  try { return localStorage.getItem(CHIAVE) || 'it'; } catch { return 'it'; }
}
export function impostaLingua(l) {
  try { localStorage.setItem(CHIAVE, l); } catch { /* memoria non disponibile */ }
}
export function t(chiave, valori = {}) {
  const l = linguaCorrente();
  let s = T[l]?.[chiave] ?? T.it[chiave] ?? chiave;
  for (const [k, v] of Object.entries(valori)) s = s.replace(`{${k}}`, v);
  return s;
}
export const meseT = (m) => (T[linguaCorrente()] || T.it).mesi[m - 1];
/** Traduzione di una voce del cedolino (null in italiano). */
export function voceT(codice) {
  const l = linguaCorrente();
  return l === 'it' ? null : T[l]?.voci?.[codice] ?? null;
}

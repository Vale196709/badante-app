// Benvenuto per la lavoratrice al primo accesso: tre schermate nella sua lingua.
// Si rivede da "?" in alto. Si ricorda sul dispositivo che è già stato visto.
import { linguaCorrente, LINGUE, impostaLingua } from '../i18n.js';
import { ICONE } from './icone.js';
import { esc } from '../stato.js';

const TESTI = {
  it: { ciao: 'Benvenuta!', intro: 'Con questa app ricevi i cedolini, segni le ore e chiedi ferie e permessi. Bastano pochi tocchi.', avanti: 'Avanti', fine: 'Ho capito', salta: 'Salta',
    p: [['orologio', 'Segna le ore', 'Ogni giorno scrivi le ore lavorate in "Le mie ore" e premi Invia. Se manca internet, le ore restano sul telefono e partono da sole.'],
      ['valigia', 'Ferie e permessi', 'In "Ferie e permessi" scegli i giorni e invia la richiesta: la risposta arriva nell\'app.'],
      ['euro', 'Cedolino e firma', 'A fine mese trovi il cedolino in "I miei cedolini". Controllalo e firma la ricevuta con il dito, dopo aver ricevuto lo stipendio.']] },
  ro: { ciao: 'Bine ai venit!', intro: 'Cu această aplicație primești fluturașii, notezi orele și ceri concediu sau învoiri. Câteva atingeri sunt de ajuns.', avanti: 'Înainte', fine: 'Am înțeles', salta: 'Sari peste',
    p: [['orologio', 'Notează orele', 'În fiecare zi scrie orele lucrate în „Orele mele” și apasă Trimite. Dacă nu ai internet, orele rămân pe telefon și pleacă singure.'],
      ['valigia', 'Concedii și învoiri', 'În „Concedii și învoiri” alegi zilele și trimiți cererea: răspunsul vine în aplicație.'],
      ['euro', 'Fluturaș și semnătură', 'La sfârșitul lunii găsești fluturașul în „Fluturașii mei”. Verifică-l și semnează chitanța cu degetul, după ce ai primit salariul.']] },
  uk: { ciao: 'Ласкаво просимо!', intro: 'У цьому застосунку ви отримуєте розрахункові листи, відмічаєте години й просите відпустку чи відгул. Досить кількох дотиків.', avanti: 'Далі', fine: 'Зрозуміло', salta: 'Пропустити',
    p: [['orologio', 'Відмічайте години', 'Щодня записуйте відпрацьовані години в «Мої години» й натисніть «Надіслати». Без інтернету години залишаться на телефоні й надішлються самі.'],
      ['valigia', 'Відпустки та відгули', 'У «Відпустки та відгули» оберіть дні й надішліть запит: відповідь прийде в застосунок.'],
      ['euro', 'Розрахунковий лист і підпис', 'Наприкінці місяця лист буде в «Мої розрахункові листи». Перевірте його й підпишіть квитанцію пальцем, коли отримаєте зарплату.']] },
  ru: { ciao: 'Добро пожаловать!', intro: 'В этом приложении вы получаете расчётные листы, отмечаете часы и просите отпуск или отгул. Достаточно нескольких касаний.', avanti: 'Далее', fine: 'Понятно', salta: 'Пропустить',
    p: [['orologio', 'Отмечайте часы', 'Каждый день записывайте отработанные часы в «Мои часы» и нажмите «Отправить». Без интернета часы останутся на телефоне и отправятся сами.'],
      ['valigia', 'Отпуска и отгулы', 'В «Отпуска и отгулы» выберите дни и отправьте запрос: ответ придёт в приложение.'],
      ['euro', 'Расчётный лист и подпись', 'В конце месяца лист будет в «Мои расчётные листы». Проверьте его и подпишите квитанцию пальцем, когда получите зарплату.']] },
  en: { ciao: 'Welcome!', intro: 'With this app you get your payslips, record your hours and ask for holidays or leave. A few taps are enough.', avanti: 'Next', fine: 'Got it', salta: 'Skip',
    p: [['orologio', 'Record your hours', 'Every day write the hours you worked in "My hours" and press Send. With no internet, hours stay on the phone and are sent automatically later.'],
      ['valigia', 'Holidays and leave', 'In "Holidays and leave" choose the days and send the request: the answer arrives in the app.'],
      ['euro', 'Payslip and signature', 'At the end of the month your payslip is in "My payslips". Check it and sign the receipt with your finger once you have been paid.']] },
};

const CHIAVE = 'badante-benvenuto-visto';
export const benvenutoVisto = () => { try { return localStorage.getItem(CHIAVE) === '1'; } catch { return true; } };

export function mostraBenvenuto({ allaFine } = {}) {
  let passo = 0;
  document.querySelector('.benvenuto')?.remove();
  const el = document.createElement('div');
  el.className = 'benvenuto';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  document.body.appendChild(el);
  const chiudi = () => { try { localStorage.setItem(CHIAVE, '1'); } catch { /* */ } el.remove(); allaFine?.(); };
  const disegna = () => {
    const T = TESTI[linguaCorrente()] || TESTI.it;
    const ultimo = passo === T.p.length;
    const [ic, tit, txt] = passo === 0 ? ['casa', T.ciao, T.intro] : T.p[passo - 1];
    el.innerHTML = `<div class="benvenuto-foglio">
      ${passo === 0 ? `<select class="lingua" aria-label="lingua">${Object.entries(LINGUE).map(([k, v]) => `<option value="${k}" ${k === linguaCorrente() ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}
      <div class="benvenuto-icona">${ICONE[ic] || ''}</div>
      <h2>${esc(tit)}</h2>
      <p>${esc(txt)}</p>
      <div class="benvenuto-punti" aria-hidden="true">${[0, ...T.p.keys()].map((_, i) => `<span class="${i === passo ? 'attivo' : ''}"></span>`).join('')}</div>
      <div class="benvenuto-azioni">
        ${ultimo ? '' : `<button type="button" class="link salta">${esc(T.salta)}</button>`}
        <button type="button" class="primario avanti">${esc(ultimo ? T.fine : T.avanti)}</button>
      </div>
    </div>`;
    el.querySelector('.lingua')?.addEventListener('change', (e) => { impostaLingua(e.target.value); disegna(); });
    el.querySelector('.salta')?.addEventListener('click', chiudi);
    el.querySelector('.avanti').addEventListener('click', () => { if (ultimo) chiudi(); else { passo++; disegna(); } });
  };
  disegna();
}

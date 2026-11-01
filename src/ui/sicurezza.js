// Sicurezza su questo dispositivo: resta collegato e sblocco con Face ID.
import { app, toast, esc } from '../stato.js';
import { leggiLeggibilita, impostaLeggibilita } from '../lib/leggibilita.js';
import { restaCollegato, impostaRestaCollegato, sbloccoDisponibile, sbloccoAttivo, attivaSblocco, disattivaSblocco, MINUTI_BLOCCO } from '../lib/sblocco.js';

const nomeBiometria = () => (/iPhone|iPad/.test(navigator.userAgent) ? 'Face ID o Touch ID' : /Mac/.test(navigator.userAgent) ? 'Touch ID' : /Android/.test(navigator.userAgent) ? 'impronta o volto' : 'Windows Hello, impronta o volto');

export async function mostraSicurezza(root) {
  const disp = await sbloccoDisponibile();
  const attivo = sbloccoAttivo(app.user);
  const lg = leggiLeggibilita();
  root.innerHTML = `
    <section class="card">
      <h2>Leggibilità</h2>
      <label class="spunta"><input type="checkbox" name="grande" ${lg.grande ? 'checked' : ''} /> Testo più grande</label>
      <label class="spunta"><input type="checkbox" name="contrasto" ${lg.contrasto ? 'checked' : ''} /> Contrasto alto (scritte secondarie più scure, bordi più marcati)</label>
      <p class="nota">Vale solo su questo dispositivo.</p>
    </section>
    <section class="card">
      <h2>Su questo dispositivo</h2>
      <label class="spunta"><input type="checkbox" name="resta" ${restaCollegato() ? 'checked' : ''} /> Resta collegato</label>
      <p class="nota">Se lo togli, quando chiudi l'app dovrai inserire di nuovo email e password. Lascialo attivo sui dispositivi solo tuoi.</p>
    </section>
    <section class="card">
      <h2>Sblocco con ${esc(nomeBiometria())}</h2>
      ${disp ? `
        <p class="nota" style="margin:-4px 0 12px">All'apertura, e dopo ${MINUTI_BLOCCO} minuti in background, l'app chiede ${esc(nomeBiometria())}. Così nessun altro vede cedolini e dati anche se prende in mano il dispositivo sbloccato.</p>
        <div class="azioni-mese">
          ${attivo ? '<button type="button" class="secondario ko" data-a="disattiva">Disattiva lo sblocco</button>' : '<button type="button" class="primario" data-a="attiva">Attiva lo sblocco</button>'}
        </div>
        <p class="nota">Il riconoscimento avviene sul dispositivo: l'app non riceve né conserva il tuo volto o la tua impronta. Se lo sblocco non riesce puoi sempre uscire e accedere con la password.</p>`
        : `<p class="nota">Questo dispositivo o browser non offre lo sblocco biometrico. Su iPhone serve iOS 16 o successivo e l'app aperta da Safari o dalla schermata Home.</p>`}
    </section>`;
  root.querySelector('[name=grande]').addEventListener('change', (e) => impostaLeggibilita({ grande: e.target.checked }));
  root.querySelector('[name=contrasto]').addEventListener('change', (e) => impostaLeggibilita({ contrasto: e.target.checked }));
  root.querySelector('[name=resta]').addEventListener('change', (e) => {
    impostaRestaCollegato(e.target.checked);
    toast(e.target.checked ? 'Resterai collegato su questo dispositivo' : 'Alla chiusura dell\'app ti verrà chiesta la password');
  });
  root.querySelector('[data-a=attiva]')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { await attivaSblocco(app.user); toast('Sblocco attivato'); }
    catch (err) { toast(err.name === 'NotAllowedError' ? 'Operazione annullata' : `Non riuscito: ${err.message}`, 'ko'); }
    mostraSicurezza(root);
  });
  root.querySelector('[data-a=disattiva]')?.addEventListener('click', () => { disattivaSblocco(); toast('Sblocco disattivato'); mostraSicurezza(root); });
}

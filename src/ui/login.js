import { supabase } from '../lib/supabase.js';
import { VERSIONE, dataBuildIt } from '../novita.js';
import { restaCollegato, impostaRestaCollegato } from '../lib/sblocco.js';

export function mostraLogin(root) {
  root.innerHTML = `
    <main class="login">
      <div class="login-card">
        <div class="brand">
          <img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" width="56" height="56" />
          <h1>Badante di Maria</h1>
          <p>Cedolini, costi e scadenze del lavoro domestico</p>
        </div>
        <form id="f-login" novalidate>
          <label>Email
            <input name="email" type="email" autocomplete="username" required inputmode="email" />
          </label>
          <label>Password
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <label class="spunta"><input type="checkbox" name="resta" ${restaCollegato() ? 'checked' : ''} /> Resta collegato su questo dispositivo</label>
          <p class="errore" role="alert" hidden></p>
          <button type="submit" class="primario">Accedi</button>
        </form>
        <p class="nota centro" style="margin-top:18px">Versione ${VERSIONE} · aggiornata il ${dataBuildIt()}</p>
      </div>
    </main>`;

  const form = root.querySelector('#f-login');
  const err = root.querySelector('.errore');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button');
    impostaRestaCollegato(form.resta.checked);
    btn.disabled = true;
    btn.textContent = 'Accesso in corso…';
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.value.trim(),
      password: form.password.value,
    });
    btn.disabled = false;
    btn.textContent = 'Accedi';
    if (error) {
      err.textContent = error.message.includes('Invalid login')
        ? 'Email o password non corretti.'
        : `Accesso non riuscito: ${error.message}`;
      err.hidden = false;
    }
  });
}

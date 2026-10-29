import { supabase } from '../lib/supabase.js';

export function mostraLogin(root) {
  root.innerHTML = `
    <main class="login">
      <div class="login-card">
        <div class="brand">
          <img src="/icons/icon-192.png" alt="" width="56" height="56" />
          <h1>Badante</h1>
          <p>Cedolini, costi e scadenze del lavoro domestico</p>
        </div>
        <form id="f-login" novalidate>
          <label>Email
            <input name="email" type="email" autocomplete="username" required inputmode="email" />
          </label>
          <label>Password
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <p class="errore" role="alert" hidden></p>
          <button type="submit" class="primario">Accedi</button>
        </form>
      </div>
    </main>`;

  const form = root.querySelector('#f-login');
  const err = root.querySelector('.errore');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button');
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

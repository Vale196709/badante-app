// Accesso rapido su questo dispositivo.
// - "Resta collegato": se disattivato, la sessione dura finché l'app resta aperta.
// - Sblocco con Face ID / Touch ID / impronta: blocco locale dell'app con una chiave d'accesso
//   (WebAuthn) del dispositivo. Non sostituisce la password: protegge l'app già collegata
//   se qualcun altro prende in mano il telefono o il computer.

const CHIAVE_RESTA = 'badante-resta';
const CHIAVE_ATTIVA = 'badante-attiva';
const CHIAVE_SBLOCCO = 'badante-sblocco';
const CHIAVE_SBLOCCATO = 'badante-sbloccato';
export const MINUTI_BLOCCO = 5;

const leggi = (s, k) => { try { return s.getItem(k); } catch { return null; } };
const scrivi = (s, k, v) => { try { if (v == null) s.removeItem(k); else s.setItem(k, v); } catch { /* */ } };

// ---------- Resta collegato ----------
export function impostaRestaCollegato(resta) {
  scrivi(localStorage, CHIAVE_RESTA, resta ? null : '0');
  scrivi(sessionStorage, CHIAVE_ATTIVA, '1');
}
export const restaCollegato = () => leggi(localStorage, CHIAVE_RESTA) !== '0';
/** Vero se l'utente aveva chiesto di non restare collegato e l'app è stata chiusa nel frattempo. */
export const sessioneScaduta = () => !restaCollegato() && !leggi(sessionStorage, CHIAVE_ATTIVA);

// ---------- Sblocco biometrico ----------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const daB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const casuale = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function sbloccoDisponibile() {
  try {
    return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

function datiSblocco() {
  try { return JSON.parse(leggi(localStorage, CHIAVE_SBLOCCO) || 'null'); } catch { return null; }
}
/** Sblocco attivo per questo utente su questo dispositivo. */
export const sbloccoAttivo = (user) => { const s = datiSblocco(); return !!(s && user && s.utente === user.id); };

export async function attivaSblocco(user) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: casuale(32),
      rp: { name: 'Badante di Maria', id: location.hostname },
      user: { id: casuale(16), name: user.email, displayName: user.email },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  scrivi(localStorage, CHIAVE_SBLOCCO, JSON.stringify({ id: b64url(cred.rawId), utente: user.id, dal: new Date().toISOString() }));
  segnaSbloccato();
}

export function disattivaSblocco() {
  scrivi(localStorage, CHIAVE_SBLOCCO, null);
  scrivi(sessionStorage, CHIAVE_SBLOCCATO, null);
}

export async function sblocca() {
  const s = datiSblocco();
  if (!s) return true;
  await navigator.credentials.get({
    publicKey: {
      challenge: casuale(32),
      allowCredentials: [{ type: 'public-key', id: daB64url(s.id), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  segnaSbloccato();
  return true;
}

export const segnaSbloccato = () => scrivi(sessionStorage, CHIAVE_SBLOCCATO, String(Date.now()));
export const sbloccatoOra = () => !!leggi(sessionStorage, CHIAVE_SBLOCCATO);
export const dimenticaSblocco = () => scrivi(sessionStorage, CHIAVE_SBLOCCATO, null);

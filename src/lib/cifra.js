// Cifratura dei backup automatici: AES-256-GCM con chiave ricavata dalla password (PBKDF2-SHA256).
// Lo stesso formato si legge nel browser (WebCrypto) e si scrive in Node (scripts/backup.mjs).
export const FORMATO_CIFRATO = 'badante-backup-cifrato';

const daB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const eCifrato = (o) => o?.formato === FORMATO_CIFRATO;

/** Decifra un backup cifrato; lancia un errore se la password è sbagliata. */
export async function decifraBackup(busta, password) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const chiave = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: daB64(busta.sale), iterations: busta.iterazioni },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  let chiaro;
  try {
    chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daB64(busta.iv) }, chiave, daB64(busta.dati));
  } catch {
    throw new Error('Password sbagliata, oppure file danneggiato.');
  }
  return JSON.parse(new TextDecoder().decode(chiaro));
}

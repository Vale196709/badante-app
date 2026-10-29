// Controllo e formattazione dell'IBAN (ISO 13616, verifica modulo 97).
const LUNGHEZZE = { IT: 27, SM: 27, RO: 24, UA: 29, MD: 24, DE: 22, FR: 27, ES: 24, AT: 20, BE: 16, NL: 18, PT: 25, CH: 21, PL: 28, BG: 22, HR: 21, SK: 24, CZ: 24, HU: 28, GB: 22, IE: 22, LT: 20, LV: 21, EE: 20, SI: 19, GR: 27, LU: 20, MT: 31, CY: 28, FI: 18, SE: 24, DK: 18, NO: 15 };

export const pulisciIban = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

export function verificaIban(valore) {
  const iban = pulisciIban(valore);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return { ok: false, msg: 'formato non valido' };
  const atteso = LUNGHEZZE[iban.slice(0, 2)];
  if (atteso && iban.length !== atteso) return { ok: false, msg: `deve avere ${atteso} caratteri (ne ha ${iban.length})` };
  if (iban.length < 15 || iban.length > 34) return { ok: false, msg: 'lunghezza non valida' };
  const riordinato = iban.slice(4) + iban.slice(0, 4);
  let resto = 0;
  for (const ch of riordinato) {
    const n = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of n) resto = (resto * 10 + Number(c)) % 97;
  }
  return resto === 1 ? { ok: true, iban } : { ok: false, msg: 'codice di controllo errato' };
}

export const formattaIban = (s) => pulisciIban(s).replace(/(.{4})/g, '$1 ').trim();

// Controllo formale del codice fiscale italiano (formato e carattere di controllo).
const DISPARI = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const valPari = (c) => (/[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 65);

export function verificaCodiceFiscale(cf) {
  if (!cf) return { ok: false, msg: 'Mancante' };
  const s = cf.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(s)) {
    return { ok: false, msg: 'Formato non valido' };
  }
  let somma = 0;
  for (let i = 0; i < 15; i++) somma += i % 2 === 0 ? DISPARI[s[i]] : valPari(s[i]);
  const atteso = String.fromCharCode(65 + (somma % 26));
  if (atteso !== s[15]) return { ok: false, msg: 'Carattere di controllo errato' };
  return { ok: true, msg: 'Valido', valore: s };
}

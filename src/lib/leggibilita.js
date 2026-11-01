// Leggibilità su questo dispositivo: testo più grande e contrasto alto (dalla 1.8).
const CHIAVE = 'badante-leggibilita';

export function leggiLeggibilita() {
  try { return { grande: false, contrasto: false, ...JSON.parse(localStorage.getItem(CHIAVE) || '{}') }; } catch { return { grande: false, contrasto: false }; }
}
export function applicaLeggibilita(v = leggiLeggibilita()) {
  document.documentElement.classList.toggle('testo-grande', !!v.grande);
  document.documentElement.classList.toggle('contrasto-alto', !!v.contrasto);
}
export function impostaLeggibilita(campi) {
  const v = { ...leggiLeggibilita(), ...campi };
  try { localStorage.setItem(CHIAVE, JSON.stringify(v)); } catch { /* memoria non disponibile */ }
  applicaLeggibilita(v);
  return v;
}

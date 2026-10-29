// Formato numerico italiano fisso: 1.234,56 (il separatore delle migliaia c'è sempre,
// anche sotto 10.000, a differenza di toLocaleString('it-IT')).
export function fmtNum(n, decimali = 2) {
  const x = Number(n) || 0;
  const negativo = x < 0;
  const [intero, dec] = Math.abs(x).toFixed(decimali).split('.');
  const conPunti = intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '−' : ''}${conPunti}${decimali > 0 ? `,${dec}` : ''}`;
}
export const fmtEur = (n) => `${fmtNum(n, 2)} €`;
/** Ore: senza decimali se intere, altrimenti con due. */
export const fmtOre = (n) => fmtNum(n, Number(n) % 1 === 0 ? 0 : 2);

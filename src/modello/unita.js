// ============================================================================
//  Unità del disegno ($INSUNITS).
//
//  🔴 Regola: le unità si LEGGONO dal file, non si suppongono. Un disegno in
//  metri trattato come millimetri esce sbagliato di mille volte, e l'errore non
//  si vede a schermo — si vede solo sulla stampa, in cantiere, quando è tardi.
//
//  Se il file non le dichiara (codice 0, «senza unità»), non si inventa un
//  valore: si dice all'utente che mancano e gli si fa scegliere. Una scala
//  1:100 su unità ignote è un numero senza significato.
// ============================================================================

/** codice $INSUNITS → nome in italiano e millimetri per unità di disegno */
export const UNITA = {
  0: { nome: 'non dichiarate', mm: null },
  1: { nome: 'pollici', mm: 25.4 },
  2: { nome: 'piedi', mm: 304.8 },
  3: { nome: 'miglia', mm: 1609344 },
  4: { nome: 'millimetri', mm: 1 },
  5: { nome: 'centimetri', mm: 10 },
  6: { nome: 'metri', mm: 1000 },
  7: { nome: 'chilometri', mm: 1000000 },
  8: { nome: 'micropollici', mm: 0.0000254 },
  9: { nome: 'mils', mm: 0.0254 },
  10: { nome: 'iarde', mm: 914.4 },
  11: { nome: 'ångström', mm: 1e-7 },
  12: { nome: 'nanometri', mm: 1e-6 },
  13: { nome: 'micron', mm: 0.001 },
  14: { nome: 'decimetri', mm: 100 },
  15: { nome: 'decametri', mm: 10000 },
  16: { nome: 'ettometri', mm: 100000 },
  17: { nome: 'gigametri', mm: 1e12 },
  18: { nome: 'unità astronomiche', mm: 1.495978707e14 },
  19: { nome: 'anni luce', mm: 9.4607304725808e18 },
  20: { nome: 'parsec', mm: 3.0856775814913673e19 },
  21: { nome: 'piedi (US survey)', mm: 304.8006096 },
  22: { nome: 'pollici (US survey)', mm: 25.40005080 },
  23: { nome: 'iarde (US survey)', mm: 914.4018288 },
  24: { nome: 'miglia (US survey)', mm: 1609347.2186944 },
}

/** Le unità che ha senso proporre a mano quando il file non le dichiara. */
export const SCELTE_UNITA = [4, 5, 6, 1, 2]

export function leggiUnita(codice) {
  const u = UNITA[codice] || UNITA[0]
  return { codice: codice ?? 0, nome: u.nome, mm: u.mm, dichiarate: !!u.mm }
}

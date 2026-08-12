// ============================================================================
//  Libreria di simboli da posare sul disegno.
//
//  🔴 I simboli sono definiti in coordinate UNITARIE (0..1, y verso l'alto) e
//  come sole spezzate. Non sono immagini né percorsi SVG: così la stessa
//  definizione serve allo schermo, al PDF vettoriale e al PNG senza che
//  nessuno dei tre debba reinterpretarla — che è il modo con cui un simbolo
//  finisce stampato diverso da come lo si è visto.
//
//  🔴 I colori non sono scelti a gusto: seguono la convenzione della
//  segnaletica (ISO 7010 / UNI). Rosso = antincendio, verde = salvataggio ed
//  emergenza, giallo = pericolo, blu = obbligo. Un idrante verde o un'uscita
//  di emergenza rossa sarebbero sbagliati due volte: perché non si leggono a
//  colpo d'occhio e perché contraddicono la segnaletica vera dell'edificio.
//  Il colore resta modificabile, ma parte giusto.
// ============================================================================

export const CATEGORIE = {
  antincendio: { nome: 'Antincendio', colore: '#d32f2f' },
  emergenza: { nome: 'Emergenza e salvataggio', colore: '#2e7d32' },
  pericolo: { nome: 'Pericolo', colore: '#e8b93c' },
  obbligo: { nome: 'Obbligo e divieto', colore: '#2f6fb5' },
  elettrico: { nome: 'Impianto elettrico', colore: '#c58a2a' },
  idraulico: { nome: 'Idraulico e gas', colore: '#3f8fb5' },
  clima: { nome: 'Clima e aria', colore: '#5aa0a0' },
  rete: { nome: 'Reti e sicurezza', colore: '#8a7fb5' },
}

// Abbreviazioni per non scrivere mille volte le stesse forme.
const l = (x1, y1, x2, y2) => ['l', x1, y1, x2, y2]
const p = (...v) => ['p', ...v]
const pc = (...v) => ['pc', ...v]
const c = (x, y, r) => ['c', x, y, r]
const a = (x, y, r, d0, d1) => ['a', x, y, r, d0, d1]
const rett = (x, y, w, h) => pc(x, y, x + w, y, x + w, y + h, x, y + h)
/** La cornice quadrata della segnaletica, con gli angoli smussati. */
const cornice = () => pc(0.06, 0.06, 0.94, 0.06, 0.94, 0.94, 0.06, 0.94)
/** La fiamma, che ricorre in mezzo mondo antincendio. */
const fiamma = (x, y, s) => p(
  x, y, x - 0.10 * s, y + 0.10 * s, x - 0.04 * s, y + 0.13 * s,
  x - 0.09 * s, y + 0.26 * s, x + 0.06 * s, y + 0.15 * s,
  x + 0.02 * s, y + 0.12 * s, x + 0.11 * s, y + 0.06 * s, x, y
)

export const SIMBOLI = [
  // --- antincendio ---------------------------------------------------------
  { id: 'estintore', nome: 'Estintore', cat: 'antincendio', forme: [
    rett(0.38, 0.12, 0.24, 0.6), rett(0.44, 0.72, 0.12, 0.08),
    p(0.56, 0.76, 0.7, 0.76, 0.7, 0.62), l(0.38, 0.6, 0.62, 0.6),
    fiamma(0.24, 0.2, 0.9) ] },
  { id: 'estintore-co2', nome: 'Estintore CO₂', cat: 'antincendio', forme: [
    rett(0.38, 0.12, 0.24, 0.6), a(0.5, 0.72, 0.12, 0, 180),
    p(0.62, 0.72, 0.76, 0.72, 0.8, 0.58), l(0.42, 0.3, 0.58, 0.3), l(0.42, 0.4, 0.58, 0.4) ] },
  { id: 'idrante-uni45', nome: 'Idrante UNI 45', cat: 'antincendio', forme: [
    rett(0.2, 0.18, 0.6, 0.64), c(0.5, 0.5, 0.16), l(0.5, 0.34, 0.5, 0.66),
    l(0.34, 0.5, 0.66, 0.5), fiamma(0.5, 0.86, 0.5) ] },
  { id: 'idrante-uni70', nome: 'Idrante UNI 70', cat: 'antincendio', forme: [
    rett(0.16, 0.18, 0.68, 0.64), c(0.5, 0.5, 0.2), l(0.5, 0.3, 0.5, 0.7),
    l(0.3, 0.5, 0.7, 0.5), fiamma(0.5, 0.86, 0.5) ] },
  { id: 'idrante-soprasuolo', nome: 'Idrante soprasuolo', cat: 'antincendio', forme: [
    l(0.5, 0.08, 0.5, 0.7), rett(0.34, 0.7, 0.32, 0.2), c(0.5, 0.8, 0.06),
    l(0.28, 0.5, 0.72, 0.5), l(0.3, 0.08, 0.7, 0.08) ] },
  { id: 'naspo', nome: 'Naspo', cat: 'antincendio', forme: [
    c(0.5, 0.5, 0.3), c(0.5, 0.5, 0.1), l(0.8, 0.5, 0.92, 0.5),
    l(0.5, 0.2, 0.5, 0.08), a(0.5, 0.5, 0.2, 30, 300) ] },
  { id: 'manichetta', nome: 'Manichetta VVF', cat: 'antincendio', forme: [
    a(0.36, 0.5, 0.24, 90, 330), a(0.64, 0.5, 0.24, 210, 90),
    l(0.86, 0.36, 0.94, 0.28), rett(0.06, 0.2, 0.1, 0.16) ] },
  { id: 'attacco-motopompa', nome: 'Attacco motopompa', cat: 'antincendio', forme: [
    rett(0.16, 0.3, 0.68, 0.4), c(0.36, 0.5, 0.1), c(0.64, 0.5, 0.1),
    l(0.5, 0.7, 0.5, 0.86), l(0.36, 0.86, 0.64, 0.86) ] },
  { id: 'sprinkler', nome: 'Sprinkler', cat: 'antincendio', forme: [
    l(0.5, 0.9, 0.5, 0.56), c(0.5, 0.48, 0.08), l(0.3, 0.34, 0.7, 0.34),
    l(0.38, 0.34, 0.3, 0.18), l(0.62, 0.34, 0.7, 0.18), l(0.5, 0.34, 0.5, 0.16) ] },
  { id: 'rilevatore-fumo', nome: 'Rilevatore di fumo', cat: 'antincendio', forme: [
    c(0.5, 0.5, 0.3), c(0.5, 0.5, 0.12), a(0.5, 0.5, 0.22, 200, 340) ] },
  { id: 'pulsante-allarme', nome: 'Pulsante allarme', cat: 'antincendio', forme: [
    rett(0.2, 0.2, 0.6, 0.6), c(0.5, 0.5, 0.14), l(0.28, 0.28, 0.4, 0.4),
    l(0.72, 0.28, 0.6, 0.4) ] },
  { id: 'coperta-antifiamma', nome: 'Coperta antifiamma', cat: 'antincendio', forme: [
    rett(0.24, 0.18, 0.52, 0.52), a(0.5, 0.7, 0.26, 0, 180), fiamma(0.5, 0.28, 0.7) ] },
  { id: 'porta-rei', nome: 'Porta REI', cat: 'antincendio', forme: [
    rett(0.24, 0.12, 0.52, 0.76), c(0.66, 0.5, 0.04),
    l(0.34, 0.7, 0.66, 0.7), fiamma(0.5, 0.2, 0.5) ] },

  // --- emergenza e salvataggio --------------------------------------------
  { id: 'uscita-emergenza', nome: 'Uscita di emergenza', cat: 'emergenza', forme: [
    rett(0.56, 0.14, 0.3, 0.72), c(0.3, 0.76, 0.07),
    p(0.3, 0.69, 0.3, 0.44, 0.22, 0.3), p(0.3, 0.44, 0.4, 0.3),
    p(0.16, 0.6, 0.3, 0.62, 0.44, 0.58), l(0.5, 0.5, 0.62, 0.5) ] },
  { id: 'via-fuga-dx', nome: 'Via di fuga →', cat: 'emergenza', forme: [
    l(0.12, 0.5, 0.8, 0.5), p(0.62, 0.32, 0.84, 0.5, 0.62, 0.68) ] },
  { id: 'via-fuga-sx', nome: 'Via di fuga ←', cat: 'emergenza', forme: [
    l(0.88, 0.5, 0.2, 0.5), p(0.38, 0.32, 0.16, 0.5, 0.38, 0.68) ] },
  { id: 'scala-emergenza', nome: 'Scala di emergenza', cat: 'emergenza', forme: [
    p(0.14, 0.16, 0.34, 0.16, 0.34, 0.36, 0.54, 0.36, 0.54, 0.56, 0.74, 0.56, 0.74, 0.76, 0.9, 0.76),
    l(0.14, 0.16, 0.14, 0.86) ] },
  { id: 'punto-raccolta', nome: 'Punto di raccolta', cat: 'emergenza', forme: [
    rett(0.1, 0.1, 0.8, 0.8), c(0.32, 0.66, 0.06), c(0.5, 0.72, 0.06), c(0.68, 0.66, 0.06),
    p(0.24, 0.6, 0.28, 0.34, 0.36, 0.34), p(0.42, 0.66, 0.5, 0.3, 0.58, 0.66),
    p(0.64, 0.34, 0.72, 0.34, 0.76, 0.6) ] },
  { id: 'primo-soccorso', nome: 'Kit primo soccorso', cat: 'emergenza', forme: [
    rett(0.14, 0.24, 0.72, 0.52), rett(0.4, 0.76, 0.2, 0.06),
    l(0.5, 0.36, 0.5, 0.64), l(0.36, 0.5, 0.64, 0.5) ] },
  { id: 'dae', nome: 'Defibrillatore DAE', cat: 'emergenza', forme: [
    rett(0.16, 0.24, 0.68, 0.52), p(0.3, 0.5, 0.42, 0.5, 0.48, 0.64, 0.56, 0.34, 0.62, 0.5, 0.72, 0.5),
    l(0.3, 0.76, 0.7, 0.76), c(0.34, 0.82, 0.05), c(0.66, 0.82, 0.05) ] },
  { id: 'doccia-emergenza', nome: 'Doccia di emergenza', cat: 'emergenza', forme: [
    l(0.5, 0.9, 0.5, 0.7), a(0.5, 0.7, 0.22, 180, 360),
    l(0.34, 0.6, 0.34, 0.42), l(0.5, 0.6, 0.5, 0.36), l(0.66, 0.6, 0.66, 0.42),
    c(0.5, 0.2, 0.08) ] },
  { id: 'lavaocchi', nome: 'Lavaocchi', cat: 'emergenza', forme: [
    c(0.5, 0.62, 0.14), c(0.5, 0.62, 0.05), l(0.26, 0.62, 0.34, 0.62),
    l(0.66, 0.62, 0.74, 0.62), l(0.5, 0.48, 0.5, 0.16), l(0.3, 0.16, 0.7, 0.16) ] },
  { id: 'barella', nome: 'Barella', cat: 'emergenza', forme: [
    rett(0.12, 0.38, 0.76, 0.24), l(0.12, 0.5, 0.04, 0.5), l(0.88, 0.5, 0.96, 0.5),
    c(0.28, 0.3, 0.07), c(0.72, 0.3, 0.07) ] },
  { id: 'telefono-emergenza', nome: 'Telefono di emergenza', cat: 'emergenza', forme: [
    rett(0.2, 0.2, 0.6, 0.6), p(0.34, 0.62, 0.34, 0.44, 0.42, 0.36, 0.58, 0.36, 0.66, 0.44, 0.66, 0.62),
    l(0.34, 0.62, 0.42, 0.62), l(0.58, 0.62, 0.66, 0.62) ] },

  // --- pericolo ------------------------------------------------------------
  { id: 'pericolo-generico', nome: 'Pericolo generico', cat: 'pericolo', forme: [
    pc(0.5, 0.9, 0.94, 0.14, 0.06, 0.14), l(0.5, 0.34, 0.5, 0.62), c(0.5, 0.25, 0.035) ] },
  { id: 'alta-tensione', nome: 'Alta tensione', cat: 'pericolo', forme: [
    pc(0.5, 0.9, 0.94, 0.14, 0.06, 0.14), p(0.56, 0.68, 0.42, 0.46, 0.52, 0.46, 0.42, 0.26) ] },
  { id: 'infiammabile', nome: 'Materiale infiammabile', cat: 'pericolo', forme: [
    pc(0.5, 0.9, 0.94, 0.14, 0.06, 0.14), fiamma(0.5, 0.24, 1.4) ] },
  { id: 'esplosivo', nome: 'Materiale esplosivo', cat: 'pericolo', forme: [
    pc(0.5, 0.9, 0.94, 0.14, 0.06, 0.14), c(0.5, 0.36, 0.1),
    l(0.5, 0.46, 0.5, 0.66), l(0.36, 0.4, 0.24, 0.5), l(0.64, 0.4, 0.76, 0.5) ] },
  { id: 'gas', nome: 'Gas', cat: 'pericolo', forme: [
    pc(0.5, 0.9, 0.94, 0.14, 0.06, 0.14), a(0.42, 0.36, 0.09, 180, 360),
    a(0.58, 0.46, 0.09, 0, 180), a(0.44, 0.56, 0.07, 180, 360) ] },
  { id: 'caduta', nome: 'Rischio di caduta', cat: 'pericolo', forme: [
    pc(0.5, 0.9, 0.94, 0.14, 0.06, 0.14), c(0.4, 0.6, 0.05),
    p(0.34, 0.54, 0.46, 0.46, 0.58, 0.5), p(0.4, 0.46, 0.36, 0.3), l(0.2, 0.24, 0.8, 0.24) ] },
  { id: 'carichi-sospesi', nome: 'Carichi sospesi', cat: 'pericolo', forme: [
    pc(0.5, 0.9, 0.94, 0.14, 0.06, 0.14), l(0.3, 0.66, 0.7, 0.66), l(0.5, 0.66, 0.5, 0.48),
    pc(0.4, 0.28, 0.6, 0.28, 0.6, 0.44, 0.4, 0.44) ] },

  // --- obbligo e divieto ---------------------------------------------------
  { id: 'divieto-fumo', nome: 'Vietato fumare', cat: 'obbligo', forme: [
    c(0.5, 0.5, 0.42), l(0.2, 0.8, 0.8, 0.2), rett(0.24, 0.44, 0.4, 0.1), l(0.68, 0.56, 0.68, 0.68) ] },
  { id: 'divieto-accesso', nome: 'Vietato l’accesso', cat: 'obbligo', forme: [
    c(0.5, 0.5, 0.42), rett(0.22, 0.44, 0.56, 0.12) ] },
  { id: 'divieto-spegnere-acqua', nome: 'Vietato spegnere con acqua', cat: 'obbligo', forme: [
    c(0.5, 0.5, 0.42), l(0.2, 0.8, 0.8, 0.2), p(0.5, 0.28, 0.62, 0.46, 0.5, 0.6, 0.38, 0.46, 0.5, 0.28) ] },
  { id: 'obbligo-casco', nome: 'Casco obbligatorio', cat: 'obbligo', forme: [
    c(0.5, 0.5, 0.42), a(0.5, 0.44, 0.24, 0, 180), l(0.2, 0.44, 0.8, 0.44) ] },
  { id: 'obbligo-guanti', nome: 'Guanti obbligatori', cat: 'obbligo', forme: [
    c(0.5, 0.5, 0.42), rett(0.36, 0.26, 0.28, 0.3),
    l(0.4, 0.56, 0.4, 0.7), l(0.48, 0.56, 0.48, 0.74), l(0.56, 0.56, 0.56, 0.7), l(0.64, 0.5, 0.72, 0.6) ] },
  { id: 'obbligo-occhiali', nome: 'Occhiali obbligatori', cat: 'obbligo', forme: [
    c(0.5, 0.5, 0.42), a(0.38, 0.5, 0.11, 0, 360), a(0.62, 0.5, 0.11, 0, 360), l(0.49, 0.5, 0.51, 0.5) ] },
  { id: 'obbligo-scarpe', nome: 'Calzature obbligatorie', cat: 'obbligo', forme: [
    c(0.5, 0.5, 0.42), p(0.3, 0.36, 0.3, 0.56, 0.44, 0.6, 0.62, 0.5, 0.72, 0.44, 0.72, 0.36, 0.3, 0.36) ] },

  // --- impianto elettrico --------------------------------------------------
  { id: 'quadro-elettrico', nome: 'Quadro elettrico', cat: 'elettrico', forme: [
    rett(0.18, 0.18, 0.64, 0.64), l(0.18, 0.66, 0.82, 0.66),
    l(0.3, 0.3, 0.3, 0.54), l(0.44, 0.3, 0.44, 0.54), l(0.58, 0.3, 0.58, 0.54), l(0.7, 0.3, 0.7, 0.54) ] },
  { id: 'trasformatore', nome: 'Trasformatore', cat: 'elettrico', forme: [
    c(0.38, 0.5, 0.24), c(0.62, 0.5, 0.24), l(0.5, 0.16, 0.5, 0.84) ] },
  { id: 'contatore-elettrico', nome: 'Contatore elettrico', cat: 'elettrico', forme: [
    rett(0.2, 0.2, 0.6, 0.6), c(0.5, 0.56, 0.14), l(0.5, 0.56, 0.58, 0.64),
    rett(0.32, 0.28, 0.36, 0.1) ] },
  { id: 'presa', nome: 'Presa di corrente', cat: 'elettrico', forme: [
    c(0.5, 0.5, 0.3), c(0.4, 0.5, 0.05), c(0.6, 0.5, 0.05), rett(0.46, 0.62, 0.08, 0.08) ] },
  { id: 'presa-industriale', nome: 'Presa industriale', cat: 'elettrico', forme: [
    c(0.5, 0.5, 0.32), a(0.5, 0.5, 0.32, 0, 200), c(0.44, 0.44, 0.05), c(0.58, 0.46, 0.05),
    c(0.5, 0.6, 0.05) ] },
  { id: 'interruttore', nome: 'Interruttore', cat: 'elettrico', forme: [
    c(0.28, 0.5, 0.05), c(0.72, 0.5, 0.05), l(0.33, 0.5, 0.66, 0.66), l(0.12, 0.5, 0.23, 0.5),
    l(0.77, 0.5, 0.88, 0.5) ] },
  { id: 'punto-luce', nome: 'Punto luce', cat: 'elettrico', forme: [
    c(0.5, 0.5, 0.24), l(0.33, 0.33, 0.67, 0.67), l(0.33, 0.67, 0.67, 0.33),
    l(0.5, 0.74, 0.5, 0.9) ] },
  { id: 'emergenza-luce', nome: 'Lampada di emergenza', cat: 'elettrico', forme: [
    rett(0.16, 0.4, 0.68, 0.24), l(0.3, 0.4, 0.24, 0.22), l(0.5, 0.4, 0.5, 0.2), l(0.7, 0.4, 0.76, 0.22),
    l(0.5, 0.64, 0.5, 0.8) ] },
  { id: 'generatore', nome: 'Gruppo elettrogeno', cat: 'elettrico', forme: [
    c(0.5, 0.5, 0.32), p(0.42, 0.62, 0.42, 0.4), p(0.42, 0.5, 0.58, 0.5), p(0.58, 0.62, 0.58, 0.4) ] },
  { id: 'ups', nome: 'UPS', cat: 'elettrico', forme: [
    rett(0.22, 0.24, 0.56, 0.52), p(0.54, 0.66, 0.42, 0.5, 0.5, 0.5, 0.42, 0.34),
    l(0.3, 0.78, 0.7, 0.78) ] },
  { id: 'messa-a-terra', nome: 'Messa a terra', cat: 'elettrico', forme: [
    l(0.5, 0.9, 0.5, 0.5), l(0.24, 0.5, 0.76, 0.5), l(0.32, 0.38, 0.68, 0.38), l(0.4, 0.26, 0.6, 0.26) ] },
  { id: 'fotovoltaico', nome: 'Fotovoltaico', cat: 'elettrico', forme: [
    pc(0.12, 0.3, 0.78, 0.3, 0.88, 0.62, 0.22, 0.62), l(0.3, 0.3, 0.4, 0.62),
    l(0.5, 0.3, 0.6, 0.62), l(0.16, 0.46, 0.83, 0.46) ] },

  // --- idraulico e gas -----------------------------------------------------
  { id: 'valvola-gas', nome: 'Valvola gas', cat: 'idraulico', forme: [
    p(0.2, 0.34, 0.5, 0.5, 0.2, 0.66, 0.2, 0.34), p(0.8, 0.34, 0.5, 0.5, 0.8, 0.66, 0.8, 0.34),
    l(0.5, 0.5, 0.5, 0.78), l(0.34, 0.78, 0.66, 0.78) ] },
  { id: 'saracinesca', nome: 'Saracinesca', cat: 'idraulico', forme: [
    p(0.2, 0.34, 0.5, 0.5, 0.2, 0.66, 0.2, 0.34), p(0.8, 0.34, 0.5, 0.5, 0.8, 0.66, 0.8, 0.34),
    l(0.5, 0.5, 0.5, 0.8), c(0.5, 0.84, 0.08) ] },
  { id: 'contatore-acqua', nome: 'Contatore acqua', cat: 'idraulico', forme: [
    c(0.5, 0.5, 0.3), l(0.2, 0.5, 0.08, 0.5), l(0.8, 0.5, 0.92, 0.5),
    l(0.5, 0.5, 0.5, 0.68), l(0.5, 0.5, 0.64, 0.42) ] },
  { id: 'contatore-gas', nome: 'Contatore gas', cat: 'idraulico', forme: [
    rett(0.22, 0.28, 0.56, 0.44), l(0.34, 0.72, 0.34, 0.86), l(0.66, 0.72, 0.66, 0.86),
    rett(0.34, 0.4, 0.32, 0.14) ] },
  { id: 'pozzetto', nome: 'Pozzetto', cat: 'idraulico', forme: [
    rett(0.2, 0.2, 0.6, 0.6), rett(0.3, 0.3, 0.4, 0.4), l(0.3, 0.5, 0.7, 0.5) ] },
  { id: 'pompa', nome: 'Pompa', cat: 'idraulico', forme: [
    c(0.5, 0.5, 0.28), p(0.5, 0.5, 0.74, 0.62, 0.74, 0.38, 0.5, 0.5),
    l(0.22, 0.5, 0.08, 0.5), l(0.5, 0.78, 0.5, 0.92) ] },
  { id: 'caldaia', nome: 'Caldaia', cat: 'idraulico', forme: [
    rett(0.22, 0.2, 0.56, 0.6), fiamma(0.5, 0.28, 0.9), l(0.34, 0.66, 0.66, 0.66),
    l(0.34, 0.8, 0.34, 0.9), l(0.66, 0.8, 0.66, 0.9) ] },
  { id: 'scarico', nome: 'Scarico', cat: 'idraulico', forme: [
    c(0.5, 0.5, 0.3), l(0.3, 0.5, 0.7, 0.5), l(0.5, 0.3, 0.5, 0.7),
    a(0.5, 0.5, 0.16, 20, 200) ] },
  { id: 'serbatoio', nome: 'Serbatoio', cat: 'idraulico', forme: [
    a(0.5, 0.28, 0.28, 180, 360), a(0.5, 0.72, 0.28, 0, 180),
    l(0.22, 0.28, 0.22, 0.72), l(0.78, 0.28, 0.78, 0.72) ] },

  // --- clima e aria --------------------------------------------------------
  { id: 'uta', nome: 'Unità trattamento aria', cat: 'clima', forme: [
    rett(0.12, 0.28, 0.76, 0.44), l(0.38, 0.28, 0.38, 0.72), l(0.62, 0.28, 0.62, 0.72),
    l(0.04, 0.5, 0.12, 0.5), l(0.88, 0.5, 0.96, 0.5) ] },
  { id: 'split', nome: 'Split', cat: 'clima', forme: [
    pc(0.14, 0.44, 0.86, 0.44, 0.86, 0.66, 0.14, 0.66), l(0.2, 0.44, 0.26, 0.32),
    l(0.5, 0.44, 0.5, 0.28), l(0.8, 0.44, 0.74, 0.32) ] },
  { id: 'ventilconvettore', nome: 'Ventilconvettore', cat: 'clima', forme: [
    rett(0.14, 0.36, 0.72, 0.34), l(0.22, 0.36, 0.22, 0.7), l(0.34, 0.36, 0.34, 0.7),
    l(0.46, 0.36, 0.46, 0.7), l(0.58, 0.36, 0.58, 0.7), l(0.7, 0.36, 0.7, 0.7) ] },
  { id: 'estrattore', nome: 'Estrattore', cat: 'clima', forme: [
    c(0.5, 0.5, 0.3), a(0.5, 0.5, 0.16, 0, 120), a(0.5, 0.5, 0.16, 120, 240),
    a(0.5, 0.5, 0.16, 240, 360), c(0.5, 0.5, 0.05) ] },
  { id: 'canale-aria', nome: 'Canale aria', cat: 'clima', forme: [
    l(0.08, 0.38, 0.92, 0.38), l(0.08, 0.62, 0.92, 0.62),
    l(0.3, 0.38, 0.3, 0.62), l(0.62, 0.38, 0.62, 0.62) ] },
  { id: 'griglia', nome: 'Griglia di ventilazione', cat: 'clima', forme: [
    rett(0.18, 0.24, 0.64, 0.52), l(0.18, 0.38, 0.82, 0.38), l(0.18, 0.5, 0.82, 0.5),
    l(0.18, 0.62, 0.82, 0.62) ] },

  // --- reti e sicurezza ----------------------------------------------------
  { id: 'rack', nome: 'Armadio rack', cat: 'rete', forme: [
    rett(0.24, 0.14, 0.52, 0.72), l(0.24, 0.34, 0.76, 0.34), l(0.24, 0.5, 0.76, 0.5),
    l(0.24, 0.66, 0.76, 0.66) ] },
  { id: 'access-point', nome: 'Access point', cat: 'rete', forme: [
    c(0.5, 0.34, 0.06), a(0.5, 0.34, 0.18, 20, 160), a(0.5, 0.34, 0.3, 20, 160),
    a(0.5, 0.34, 0.42, 20, 160) ] },
  { id: 'telecamera', nome: 'Telecamera', cat: 'rete', forme: [
    pc(0.16, 0.42, 0.62, 0.42, 0.62, 0.62, 0.16, 0.62), p(0.62, 0.46, 0.84, 0.36, 0.84, 0.68, 0.62, 0.58),
    l(0.36, 0.42, 0.36, 0.28) ] },
  { id: 'citofono', nome: 'Citofono', cat: 'rete', forme: [
    rett(0.28, 0.18, 0.44, 0.64), c(0.5, 0.62, 0.08), rett(0.38, 0.28, 0.24, 0.14) ] },
  { id: 'sirena', nome: 'Sirena di allarme', cat: 'rete', forme: [
    p(0.28, 0.38, 0.28, 0.62, 0.5, 0.74, 0.5, 0.26, 0.28, 0.38),
    a(0.5, 0.5, 0.2, 300, 60), a(0.5, 0.5, 0.32, 300, 60) ] },
  { id: 'centrale-allarme', nome: 'Centrale allarme', cat: 'rete', forme: [
    rett(0.2, 0.24, 0.6, 0.52), c(0.34, 0.5, 0.06), c(0.5, 0.5, 0.06), c(0.66, 0.5, 0.06),
    l(0.28, 0.66, 0.72, 0.66) ] },
]

export const PER_ID = Object.fromEntries(SIMBOLI.map((s) => [s.id, s]))

/** Le forme di un simbolo, in coordinate 0..1, come sole spezzate. */
export function formeSimbolo(id) {
  const s = PER_ID[id]
  if (!s) return []
  const fuori = []
  for (const f of s.forme) {
    const [tipo, ...v] = f
    if (tipo === 'l') fuori.push([v[0], v[1], v[2], v[3]])
    else if (tipo === 'p') fuori.push(v.slice())
    else if (tipo === 'pc') fuori.push([...v, v[0], v[1]])
    else if (tipo === 'c') fuori.push(archi(v[0], v[1], v[2], 0, 360))
    else if (tipo === 'a') fuori.push(archi(v[0], v[1], v[2], v[3], v[4]))
  }
  return fuori
}

/** Un arco in gradi diventa una spezzata: 24 segmenti bastano a questa misura. */
function archi(cx, cy, r, g0, g1) {
  const punti = []
  const passi = Math.max(6, Math.round((Math.abs(g1 - g0) / 360) * 28))
  for (let i = 0; i <= passi; i++) {
    const g = ((g0 + ((g1 - g0) * i) / passi) * Math.PI) / 180
    punti.push(cx + r * Math.cos(g), cy + r * Math.sin(g))
  }
  return punti
}

/** Il colore che un simbolo deve avere se non lo si cambia. */
export const coloreDi = (id) => CATEGORIE[PER_ID[id]?.cat]?.colore || '#d32f2f'

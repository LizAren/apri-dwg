// ============================================================================
//  Colori: dall'indice AutoCAD (ACI) al colore da disegnare.
//
//  Un'entità può dichiarare il colore in tre modi, in ordine di precedenza:
//    1. colore vero a 24 bit  (campo `color`)
//    2. indice ACI            (campo `colorIndex`, 1-255)
//    3. per layer             (colorIndex 256 o assente) → si guarda il layer
//  L'indice 0 significa "per blocco": si eredita da chi ha inserito il blocco.
//
//  ⚠️ L'indice 7 non è un colore fisso: è "l'inchiostro", cioè bianco su fondo
//  scuro e nero su fondo chiaro. Trattarlo come bianco fisso rende invisibile
//  metà disegno quando si passa al fondo bianco — che è poi il fondo con cui
//  si stampa.
// ============================================================================

/**
 * I primi nove indici sono fissati dalla convenzione AutoCAD; il 7 è
 * l'inchiostro e viene risolto altrove.
 */
const FISSI = {
  1: [255, 0, 0],
  2: [255, 255, 0],
  3: [0, 255, 0],
  4: [0, 255, 255],
  5: [0, 0, 255],
  6: [255, 0, 255],
  7: [255, 255, 255],
  8: [128, 128, 128],
  9: [192, 192, 192],
}

/** Gli ultimi sei indici sono la scala di grigi. */
const GRIGI = {
  250: [51, 51, 51],
  251: [80, 80, 80],
  252: [105, 105, 105],
  253: [130, 130, 130],
  254: [190, 190, 190],
  255: [255, 255, 255],
}

/**
 * Gli indici da 10 a 249 sono 24 tinte (una ogni 15°) per 10 varianti:
 * cinque livelli di luminosità, ciascuno in versione piena e slavata.
 * È la ricostruzione della tavola standard, non la tavola originale copiata:
 * la differenza è di pochi valori su tinte poco usate, e per un visualizzatore
 * non cambia nulla. Se un giorno servisse la corrispondenza esatta, si sostituisce
 * questa funzione con una tabella e il resto del programma non se ne accorge.
 */
const VARIANTI = [
  [1.0, 1.0],
  [1.0, 0.5],
  [0.8, 1.0],
  [0.8, 0.5],
  [0.6, 1.0],
  [0.6, 0.5],
  [0.5, 1.0],
  [0.5, 0.5],
  [0.3, 1.0],
  [0.3, 0.5],
]

function hsvRgb(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

const TAVOLA = (() => {
  const t = new Array(256)
  for (const [i, rgb] of Object.entries(FISSI)) t[i] = rgb
  for (const [i, rgb] of Object.entries(GRIGI)) t[i] = rgb
  for (let i = 10; i <= 249; i++) {
    const tinta = (Math.floor((i - 10) / 10) * 15) % 360
    const [v, s] = VARIANTI[(i - 10) % 10]
    t[i] = hsvRgb(tinta, s, v)
  }
  t[0] = [255, 255, 255] // per blocco: risolto da chi inserisce
  return t
})()

const esa = ([r, g, b]) =>
  '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')

/** Colore esadecimale di un indice ACI. L'indice 7 va risolto prima. */
export function daIndice(indice) {
  const rgb = TAVOLA[indice & 255] || [255, 255, 255]
  return esa(rgb)
}

/** Colore esadecimale da un valore a 24 bit (0x00RRGGBB). */
export function daVero(valore) {
  return (
    '#' +
    ((valore >>> 16) & 255).toString(16).padStart(2, '0') +
    ((valore >>> 8) & 255).toString(16).padStart(2, '0') +
    (valore & 255).toString(16).padStart(2, '0')
  )
}

/**
 * Colore definitivo di un'entità, risolvendo per-layer, per-blocco e inchiostro.
 *
 * @param {object} ent      entità
 * @param {object} layer    voce di tabella del suo layer (può mancare)
 * @param {string} ereditato colore del blocco che la contiene (per BYBLOCK)
 * @returns {string|'INCHIOSTRO'} colore esadecimale, oppure il segnaposto
 *          'INCHIOSTRO' se il colore dipende dal fondo scelto dall'utente.
 */
export function coloreEntita(ent, layer, ereditato) {
  // 1. colore vero dichiarato sull'entità
  if (typeof ent.color === 'number' && ent.color > 0) return daVero(ent.color)

  let ci = ent.colorIndex
  // Un indice negativo indica il layer spento: il colore resta quello, la
  // visibilità la decide altri.
  if (typeof ci === 'number' && ci < 0) ci = -ci

  if (ci === 0) return ereditato || 'INCHIOSTRO' // BYBLOCK
  if (typeof ci === 'number' && ci !== 256) {
    return ci === 7 ? 'INCHIOSTRO' : daIndice(ci)
  }

  // 2. BYLAYER (256 o assente)
  return coloreLayer(layer)
}

/**
 * Colore di un layer, con lo stesso trattamento dell'inchiostro.
 *
 * ⚠️ La voce di layer arriva già normalizzata dai lettori, quindi i campi si
 * chiamano `colore` e `indiceColore`. Leggendo `color`/`colorIndex` — che sono
 * i nomi dell'entità grezza — questa funzione restituiva sempre l'inchiostro:
 * il disegno usciva tutto dello stesso colore e le pastiglie dei layer erano
 * tutte uguali. Si è visto guardando il pannello, non il codice.
 */
export function coloreLayer(layer) {
  if (!layer) return 'INCHIOSTRO'

  // 🔴 Sul LAYER comanda l'indice, non il colore a 24 bit.
  // LibreDWG riempie il campo del colore vero con 0xFFFFFF su ogni layer, anche
  // su quelli gialli o ciano: è un valore di riempimento, non un'informazione.
  // Dando la precedenza al colore vero — che è la regola giusta per le entità —
  // il disegno usciva tutto bianco e le pastiglie del pannello erano identiche.
  // Misurato sui quattro file di prova: indice 2 e 4, colore 16777215 su tutti.
  const ci = Math.abs(layer.indiceColore ?? layer.colorIndex ?? 256)
  if (ci >= 1 && ci <= 255) return ci === 7 ? 'INCHIOSTRO' : daIndice(ci)

  const vero = layer.colore ?? layer.color
  if (typeof vero === 'number' && vero > 0 && vero !== 0xffffff) return daVero(vero)
  return 'INCHIOSTRO'
}

/** Sostituisce il segnaposto con il colore giusto per il fondo in uso. */
export function risolviInchiostro(colore, fondoChiaro) {
  return colore === 'INCHIOSTRO' ? (fondoChiaro ? '#000000' : '#e8e8e8') : colore
}

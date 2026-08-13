// ============================================================================
//  Il disegno d'esempio.
//
//  Perché esiste. I quattro file di prova di LibreDWG sono tutti lo stesso
//  disegno: tre spezzate e la parola «valoro». Vanno benissimo per misurare che
//  il lettore legge, ma su una vetrina non ci vanno — chi guarda vede tre righe
//  storte e conclude che il programma non sa disegnare. Serviva una pianta che
//  somigli a una pianta.
//
//  🔴 È un disegno INVENTATO, e va detto dove compare: non è il rilievo di un
//  edificio esistente. Serve a far vedere come si comporta il programma, non a
//  spacciare un lavoro che non c'è.
//
//  Si scrive un DXF R2000 a mano, con le stesse coppie codice/valore
//  dell'esportatore (`src/esporta/dxf.js`): niente librerie, e il file resta
//  leggibile con un editor di testo.
//
//  Uso:  node strumenti/esempio.mjs
// ============================================================================

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const QUI = dirname(fileURLToPath(import.meta.url))
const USCITA = join(QUI, '../prove/file/esempio-pianta.dxf')

/** Una coppia codice/valore, che è tutto ciò di cui è fatto un DXF. */
const c = (codice, valore) => `${codice}\n${valore}\n`
const n = (v) => (Math.round(v * 1000) / 1000).toString()

// ---------------------------------------------------------------------------
//  I layer, con i colori della tavolozza AutoCAD (l'indice, non il 24 bit:
//  è lì che vive il colore di un layer).
// ---------------------------------------------------------------------------

const LAYER = [
  ['MURI', 7], // bianco/nero: la struttura
  ['TRAMEZZE', 8], // grigio: i divisori leggeri
  ['INFISSI', 4], // ciano: porte e finestre
  ['ARREDO', 9], // grigio chiaro
  ['SANITARI', 4],
  ['QUOTE', 2], // giallo, come vuole l'uso
  ['TESTI', 3], // verde
  ['CORNICE', 7],
]

const entita = []

const su = (layer, corpo) => entita.push({ layer, corpo })

function linea(layer, x0, y0, x1, y1) {
  su(layer,
    c(0, 'LINE') + c(8, layer) + c(100, 'AcDbEntity') + c(100, 'AcDbLine') +
    c(10, n(x0)) + c(20, n(y0)) + c(30, 0) +
    c(11, n(x1)) + c(21, n(y1)) + c(31, 0))
}

function spezzata(layer, punti, chiusa = false) {
  let t =
    c(0, 'LWPOLYLINE') + c(8, layer) + c(100, 'AcDbEntity') + c(100, 'AcDbPolyline') +
    c(90, punti.length / 2) + c(70, chiusa ? 1 : 0)
  for (let i = 0; i < punti.length; i += 2) t += c(10, n(punti[i])) + c(20, n(punti[i + 1]))
  su(layer, t)
}

const rett = (layer, x0, y0, x1, y1) =>
  spezzata(layer, [x0, y0, x1, y0, x1, y1, x0, y1], true)

function cerchio(layer, x, y, r) {
  su(layer,
    c(0, 'CIRCLE') + c(8, layer) + c(100, 'AcDbEntity') + c(100, 'AcDbCircle') +
    c(10, n(x)) + c(20, n(y)) + c(30, 0) + c(40, n(r)))
}

/** Gli angoli di un ARC nel FILE stanno in gradi (in memoria diventano radianti). */
function arco(layer, x, y, r, da, a) {
  su(layer,
    c(0, 'ARC') + c(8, layer) + c(100, 'AcDbEntity') + c(100, 'AcDbCircle') +
    c(10, n(x)) + c(20, n(y)) + c(30, 0) + c(40, n(r)) +
    c(100, 'AcDbArc') + c(50, n(da)) + c(51, n(a)))
}

function testo(layer, x, y, altezza, contenuto, rotazione = 0, allineamento = 0) {
  su(layer,
    c(0, 'TEXT') + c(8, layer) + c(100, 'AcDbEntity') + c(100, 'AcDbText') +
    c(10, n(x)) + c(20, n(y)) + c(30, 0) + c(40, n(altezza)) + c(1, contenuto) +
    c(50, n(rotazione)) + c(72, allineamento) +
    c(11, n(x)) + c(21, n(y)) + c(31, 0))
}

// ---------------------------------------------------------------------------
//  I muri.
//
//  Un muro è disegnato come il suo ingombro — due facce e i due tappi — cioè
//  una spezzata chiusa. Le aperture non si «bucano»: il muro è fatto di pezzi,
//  e fra un pezzo e l'altro c'è il vano. È il modo in cui lo si disegna davvero
//  e l'unico che regge quando poi ci metti dentro una finestra.
// ---------------------------------------------------------------------------

const SP_EST = 300 // muratura perimetrale
const SP_INT = 100 // tramezze

const LARG = 14000
const ALT = 9000

/** Un pezzo di muro orizzontale: da x0 a x1, con la faccia inferiore a y. */
const muroX = (layer, x0, x1, y, sp) => rett(layer, x0, y, x1, y + sp)
/** Un pezzo di muro verticale: da y0 a y1, con la faccia sinistra a x. */
const muroY = (layer, y0, y1, x, sp) => rett(layer, x, y0, x + sp, y1)

/**
 * Una finestra dentro un vano: i due montanti che chiudono il muro, e il vetro
 * come una riga sola a metà spessore. È la convenzione, e si legge subito.
 */
function finestraX(x0, x1, y, sp) {
  linea('INFISSI', x0, y, x0, y + sp)
  linea('INFISSI', x1, y, x1, y + sp)
  linea('INFISSI', x0, y + sp / 2, x1, y + sp / 2)
}
function finestraY(y0, y1, x, sp) {
  linea('INFISSI', x, y0, x + sp, y0)
  linea('INFISSI', x, y1, x + sp, y1)
  linea('INFISSI', x + sp / 2, y0, x + sp / 2, y1)
}

/**
 * Una porta: l'anta e il quarto di cerchio che descrive dove passa aprendola.
 * `versoX` e `versoY` dicono da che parte sta il cardine e da che parte apre.
 */
function porta(xc, yc, larghezza, versoX, versoY) {
  // L'anta, chiusa contro lo stipite.
  linea('INFISSI', xc, yc, xc, yc + versoY * larghezza)
  const da = versoX > 0 ? (versoY > 0 ? 0 : 270) : (versoY > 0 ? 90 : 180)
  arco('INFISSI', xc, yc, larghezza, da, da + 90)
  linea('INFISSI', xc, yc, xc + versoX * larghezza, yc)
}

// --- perimetro -------------------------------------------------------------
// Sud: due finestre e il tratto pieno fra loro.
muroX('MURI', 0, 1200, 0, SP_EST)
finestraX(1200, 3600, 0, SP_EST)
muroX('MURI', 3600, 5600, 0, SP_EST)
finestraX(5600, 8000, 0, SP_EST)
muroX('MURI', 8000, 10200, 0, SP_EST)
finestraX(10200, 12600, 0, SP_EST)
muroX('MURI', 12600, LARG, 0, SP_EST)

// Nord: l'ingresso e due finestre.
muroX('MURI', 0, 1400, ALT - SP_EST, SP_EST)
porta(1400, ALT - SP_EST, 1400, 1, -1)
muroX('MURI', 2800, 4400, ALT - SP_EST, SP_EST)
finestraX(4400, 6400, ALT - SP_EST, SP_EST)
muroX('MURI', 6400, 9800, ALT - SP_EST, SP_EST)
finestraX(9800, 12200, ALT - SP_EST, SP_EST)
muroX('MURI', 12200, LARG, ALT - SP_EST, SP_EST)

// Ovest e est, con una finestra per parte.
muroY('MURI', 0, 2400, 0, SP_EST)
finestraY(2400, 4200, 0, SP_EST)
muroY('MURI', 4200, ALT, 0, SP_EST)

muroY('MURI', 0, 3000, LARG - SP_EST, SP_EST)
finestraY(3000, 5400, LARG - SP_EST, SP_EST)
muroY('MURI', 5400, ALT, LARG - SP_EST, SP_EST)

// --- il corridoio ----------------------------------------------------------
// Due tramezze parallele, spezzate dove passano le porte.
const COR_S = 4100 // faccia sud del corridoio
const COR_N = 5400 // faccia nord

const tramezzaX = (y, vani) => {
  let x = SP_EST
  for (const [a, b] of vani) {
    if (a > x) muroX('TRAMEZZE', x, a, y, SP_INT)
    x = b
  }
  if (x < LARG - SP_EST) muroX('TRAMEZZE', x, LARG - SP_EST, y, SP_INT)
}

tramezzaX(COR_S, [[2000, 2900], [6400, 7300], [11000, 11900]])
tramezzaX(COR_N, [[1400, 2300], [4800, 5700], [7500, 8300], [11000, 11900]])

porta(2900, COR_S, 900, -1, -1)
porta(6400, COR_S, 900, 1, -1)
porta(11900, COR_S, 900, -1, -1)
porta(1400, COR_N + SP_INT, 900, 1, 1)
porta(5700, COR_N + SP_INT, 900, -1, 1)
porta(7500, COR_N + SP_INT, 800, 1, 1)
porta(11000, COR_N + SP_INT, 900, 1, 1)

// --- divisori delle stanze -------------------------------------------------
muroY('TRAMEZZE', SP_EST, COR_S, 4600, SP_INT)
muroY('TRAMEZZE', SP_EST, COR_S, 9000, SP_INT)
muroY('TRAMEZZE', COR_N + SP_INT, ALT - SP_EST, 3600, SP_INT)
muroY('TRAMEZZE', COR_N + SP_INT, ALT - SP_EST, 6800, SP_INT)
muroY('TRAMEZZE', COR_N + SP_INT, ALT - SP_EST, 9000, SP_INT)

// ---------------------------------------------------------------------------
//  Arredo e nomi delle stanze.
//
//  Regola tenuta ovunque: l'arredo sta nella METÀ della stanza lontana dal
//  nome. Senza una regola, il nome finisce sopra una sedia — ed è il primo
//  difetto che si vede in una pianta.
// ---------------------------------------------------------------------------

/** Una scrivania con la sua sedia davanti. */
function scrivania(x, y, larg = 1500, prof = 750) {
  rett('ARREDO', x, y, x + larg, y + prof)
  cerchio('ARREDO', x + larg / 2, y + prof + 420, 240)
}

// I due uffici: due postazioni affiancate, contro la parete finestrata.
scrivania(800, 700)
scrivania(2700, 700)
scrivania(5200, 700)
scrivania(7100, 700)

// Sala riunioni: tavolo e otto sedie.
rett('ARREDO', 9900, 1000, 12900, 2200)
for (let i = 0; i < 3; i++) {
  cerchio('ARREDO', 10500 + i * 900, 550, 240)
  cerchio('ARREDO', 10500 + i * 900, 2650, 240)
}
cerchio('ARREDO', 9450, 1600, 240)
cerchio('ARREDO', 13350, 1600, 240)

// Ingresso: il bancone, di fianco alla porta.
rett('ARREDO', 700, 5800, 3400, 6300)

// Archivio: scaffalature contro la parete del corridoio.
for (let i = 0; i < 4; i++) rett('ARREDO', 3800 + i * 750, 5700, 4400 + i * 750, 6400)

// Servizi: due wc e due lavabi.
rett('SANITARI', 7000, 5700, 7400, 6200)
rett('SANITARI', 7700, 5700, 8100, 6200)
cerchio('SANITARI', 8600, 5950, 240)
cerchio('SANITARI', 8600, 6700, 240)

// Deposito: scaffalature su una fila.
for (let i = 0; i < 5; i++) rett('ARREDO', 9300 + i * 850, 5700, 10000 + i * 850, 6400)

// Il nome si legge da lontano, la superficie quando serve: due corpi diversi.
const stanza = (x, y, nome, mq) => {
  testo('TESTI', x, y, 300, nome)
  testo('TESTI', x, y - 460, 190, `${mq} m²`)
}

stanza(800, 3350, 'UFFICIO 1', '16,34')
stanza(5200, 3350, 'UFFICIO 2', '16,34')
stanza(9400, 3350, 'SALA RIUNIONI', '17,48')

stanza(700, 7900, 'INGRESSO', '10,89')
stanza(3800, 7900, 'ARCHIVIO', '10,23')
stanza(7000, 7900, 'SERVIZI', '6,93')
stanza(9300, 7900, 'DEPOSITO', '15,18')

testo('TESTI', 5600, 4600, 240, 'CORRIDOIO')

// ---------------------------------------------------------------------------
//  Le quote.
//
//  Sono linee e testo, non entità DIMENSION: qui il file deve restare
//  leggibile a mano, e il programma le mostrerebbe uguali.
// ---------------------------------------------------------------------------

const TACCA = 180

/** Una quota orizzontale, con le due tacche a 45° come si usa. */
function quotaX(x0, x1, y, etichetta) {
  linea('QUOTE', x0, y, x1, y)
  for (const x of [x0, x1]) {
    linea('QUOTE', x - TACCA / 2, y - TACCA / 2, x + TACCA / 2, y + TACCA / 2)
    linea('QUOTE', x, y - TACCA, x, y + TACCA)
  }
  testo('QUOTE', (x0 + x1) / 2 - etichetta.length * 62, y + 160, 220, etichetta)
}

function quotaY(y0, y1, x, etichetta) {
  linea('QUOTE', x, y0, x, y1)
  for (const y of [y0, y1]) {
    linea('QUOTE', x - TACCA / 2, y - TACCA / 2, x + TACCA / 2, y + TACCA / 2)
    linea('QUOTE', x - TACCA, y, x + TACCA, y)
  }
  testo('QUOTE', x - 160, (y0 + y1) / 2 - etichetta.length * 62, 220, etichetta, 90)
}

// Catena delle stanze a sud, e la quota complessiva sotto.
quotaX(0, 4700, -900, '4,70')
quotaX(4700, 9100, -900, '4,40')
quotaX(9100, LARG, -900, '4,90')
quotaX(0, LARG, -1900, '14,00')
quotaY(0, ALT, -900, '9,00')

// Le linee di richiamo che portano la quota fuori dal disegno.
for (const x of [0, 4700, 9100, LARG]) linea('QUOTE', x, 0, x, -2100)
for (const y of [0, ALT]) linea('QUOTE', 0, y, -1100, y)

// ---------------------------------------------------------------------------
//  Cornice e nord.
// ---------------------------------------------------------------------------

rett('CORNICE', -2900, -2900, LARG + 1400, ALT + 1400)

const NX = LARG + 600
const NY = ALT + 700
spezzata('CORNICE', [NX, NY + 500, NX - 300, NY - 500, NX, NY - 200, NX + 300, NY - 500], true)
testo('CORNICE', NX - 110, NY + 700, 260, 'N')

testo('CORNICE', -2700, ALT + 900, 300, 'PIANTA PIANO TERRA — esempio dimostrativo')
testo('CORNICE', -2700, -2700, 200, 'Disegno inventato a scopo di prova · scala 1:100 · quote in metri')

// ---------------------------------------------------------------------------
//  Il file.
// ---------------------------------------------------------------------------

let tabella =
  c(0, 'SECTION') + c(2, 'TABLES') + c(0, 'TABLE') + c(2, 'LAYER') + c(70, LAYER.length)
for (const [nome, colore] of LAYER) {
  tabella +=
    c(0, 'LAYER') + c(100, 'AcDbSymbolTableRecord') + c(100, 'AcDbLayerTableRecord') +
    c(2, nome) + c(70, 0) + c(62, colore) + c(6, 'CONTINUOUS')
}
tabella += c(0, 'ENDTAB') + c(0, 'ENDSEC')

// $INSUNITS = 4 → millimetri. Sbagliarlo qui farebbe uscire un PDF in scala
// mille volte errata, ed è la trappola numero uno di questo formato.
const file =
  c(0, 'SECTION') + c(2, 'HEADER') +
  c(9, '$ACADVER') + c(1, 'AC1015') +
  c(9, '$INSUNITS') + c(70, 4) +
  c(9, '$EXTMIN') + c(10, -2900) + c(20, -2900) + c(30, 0) +
  c(9, '$EXTMAX') + c(10, LARG + 1400) + c(20, ALT + 1400) + c(30, 0) +
  c(0, 'ENDSEC') +
  tabella +
  c(0, 'SECTION') + c(2, 'ENTITIES') + entita.map((e) => e.corpo).join('') + c(0, 'ENDSEC') +
  c(0, 'EOF')

writeFileSync(USCITA, file)
console.log(`✅ ${USCITA}`)
console.log(`   ${entita.length} entità su ${LAYER.length} layer, ${(file.length / 1024).toFixed(0)} kB`)

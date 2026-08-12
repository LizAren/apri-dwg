// ============================================================================
//  Export in PDF vettoriale.
//
//  🔴 Il PDF si genera dalle ENTITÀ, non dallo schermo. Una schermata dentro un
//  PDF è un'immagine: sfoca stampando, non si misura, e a qualsiasi scala è
//  carta sprecata. Qui ogni spezzata diventa un percorso vettoriale in
//  millimetri, e il file resta leggero e ingrandibile.
//
//  🔴 La scala si DICHIARA. Un disegno «adattato alla pagina» senza dire a
//  quanto sta è inutilizzabile: in cantiere si misura sul foglio. Per questo
//  anche la modalità automatica non produce mai 1:137, ma arrotonda alla scala
//  normalizzata successiva (1, 2, 5 × 10ⁿ) e la scrive sul foglio.
// ============================================================================

import { risolviInchiostro } from '../modello/colori.js'
import { geometriaNota } from '../modello/note.js'

/** Formati in millimetri, lato corto × lato lungo. */
export const FORMATI = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
}

/** Le scale che si possono scegliere a mano nel pannello di stampa. */
export const SCALE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]

/**
 * 🔴 La scala automatica non è «quella che fa entrare il disegno»: quella
 * sarebbe 1:10822, un numero che su una tavola non significa niente e che
 * nessuno può usare per misurare. Si sale sempre al gradino successivo della
 * scala normalizzata 1-2-5 × 10ⁿ, che non ha fine e quindi vale anche per un
 * disegno lungo tre chilometri.
 */
export function scalaNormalizzata(necessaria) {
  if (!(necessaria > 0)) return 1
  const esponente = Math.floor(Math.log10(necessaria))
  for (const m of [1, 2, 5, 10]) {
    const s = m * 10 ** esponente
    if (s >= necessaria - 1e-9) return arrotonda(s)
  }
  return arrotonda(10 ** (esponente + 1))
}

// Le potenze di dieci calcolate in virgola mobile possono uscire 999,9999.
const arrotonda = (s) => (s >= 1 ? Math.round(s) : Number(s.toPrecision(3)))

/** Vero se un denominatore appartiene alla scala normalizzata 1-2-5 × 10ⁿ. */
export function eNormalizzata(scala) {
  if (!(scala > 0)) return false
  const e = Math.floor(Math.log10(scala))
  return [1, 2, 5].some((m) => Math.abs(m * 10 ** e - scala) < 1e-6)
}

const ALTEZZA_PIEDE = 7
const SPESSORE_MINIMO = 0.13

/**
 * @returns {{blob: Blob, scala: number, avvisi: string[]}}
 */
/** Misure del foglio scelto, in millimetri. */
function foglio(o) {
  const [corto, lungo] = FORMATI[o.formato] || FORMATI.A4
  return o.orientamento === 'orizzontale' ? [lungo, corto] : [corto, lungo]
}

function opzioni(o) {
  return {
    formato: 'A4',
    orientamento: 'orizzontale',
    margine: 10,
    scala: null, // null = adatta alla pagina
    monocromatico: false,
    piede: true,
    layerVisibili: null,
    ...o,
  }
}

async function nuovoDocumento(o) {
  const { jsPDF } = await import('jspdf')
  const [larghezza, altezza] = foglio(o)
  const doc = new jsPDF({
    unit: 'mm',
    format: [larghezza, altezza],
    orientation: o.orientamento === 'orizzontale' ? 'landscape' : 'portrait',
    compress: true,
  })
  doc.setLineJoin('round')
  doc.setLineCap('round')
  return doc
}

/**
 * Disegna UNO spazio sulla pagina corrente. Sta a parte perché le tavole
 * multiple sono lo stesso disegno ripetuto: se questa logica fosse dentro
 * `esportaPdf` bisognerebbe copiarla, e due copie divergono sempre.
 */
function disegnaSpazio(doc, modello, spazio, o) {
  const avvisi = []
  const [larghezzaFoglio, altezzaFoglio] = foglio(o)

  // Lo spazio carta è già in millimetri di foglio: là una scala diversa da 1:1
  // rimpicciolirebbe una tavola che è già impaginata.
  const mmPerUnita = spazio.carta ? 1 : modello.unita.mm
  if (!mmPerUnita) {
    avvisi.push(
      'Il disegno non dichiara le unità: la scala indicata sul foglio vale solo ' +
      'se le unità scelte sono quelle giuste.'
    )
  }
  const fattoreUnita = mmPerUnita || o.mmPerUnitaSupposto || 1

  const visibili = disegnabili(spazio, o.layerVisibili)
  if (!visibili.length) throw new Error("Non c'è niente da stampare: tutti i layer sono nascosti.")

  const est = estensione(visibili)
  const utileL = larghezzaFoglio - o.margine * 2
  const utileA = altezzaFoglio - o.margine * 2 - (o.piede ? ALTEZZA_PIEDE : 0)

  const larghezzaReale = (est[2] - est[0]) * fattoreUnita
  const altezzaReale = (est[3] - est[1]) * fattoreUnita

  let scala = o.scala
  if (!scala) {
    const necessaria = Math.max(larghezzaReale / utileL, altezzaReale / utileA)
    scala = scalaNormalizzata(necessaria)
  }
  const k = fattoreUnita / scala // millimetri di carta per unità di disegno

  // Il disegno si centra nell'area utile.
  const offX = o.margine + (utileL - (est[2] - est[0]) * k) / 2
  const offY = o.margine + (o.piede ? ALTEZZA_PIEDE : 0) + (utileA - (est[3] - est[1]) * k) / 2
  const versoX = (x) => offX + (x - est[0]) * k
  // Il PDF ha l'origine in alto: l'asse Y si rovescia una volta sola, qui.
  const versoY = (y) => altezzaFoglio - (offY + (y - est[1]) * k)

  if ((est[2] - est[0]) * k > utileL + 0.5 || (est[3] - est[1]) * k > utileA + 0.5) {
    avvisi.push(`Alla scala 1:${scala} il disegno non entra nel foglio: una parte resta fuori.`)
  }

  let coloreCorrente = null
  let spessoreCorrente = null
  let disegnate = 0

  for (const p of visibili) {
    if (p.infinita) continue // le rette infinite non si stampano
    if (p.tipo === 'vista') continue // la cornice della vista non è disegno
    const colore = o.monocromatico ? '#000000' : risolviInchiostro(p.colore, true)
    const spessore = Math.max(SPESSORE_MINIMO, p.spessore || 0)

    if (p.tipo === 'testo') {
      if (colore !== coloreCorrente) {
        doc.setTextColor(colore)
        coloreCorrente = colore
      }
      const altezzaMm = p.altezza * k
      if (altezzaMm < 0.6) continue // sotto il mezzo millimetro è una macchia
      doc.setFontSize((altezzaMm * 72) / 25.4)
      doc.text(p.testo, versoX(p.x), versoY(p.y), {
        angle: (p.rotazione * 180) / Math.PI,
        align: ['left', 'center', 'right'][p.allineamento] || 'left',
        baseline: 'alphabetic',
      })
      disegnate++
      continue
    }

    if (colore !== coloreCorrente) {
      doc.setDrawColor(colore)
      doc.setFillColor(colore)
      coloreCorrente = colore
    }
    if (spessore !== spessoreCorrente) {
      doc.setLineWidth(spessore)
      spessoreCorrente = spessore
    }

    const punti = p.punti
    const x0 = versoX(punti[0])
    const y0 = versoY(punti[1])
    if (p.punto) {
      // Un POINT si stampa come una crocetta di mezzo millimetro.
      doc.line(x0 - 0.25, y0, x0 + 0.25, y0)
      doc.line(x0, y0 - 0.25, x0, y0 + 0.25)
      disegnate++
      continue
    }

    const salti = []
    let px = x0
    let py = y0
    for (let i = 2; i < punti.length; i += 2) {
      const x = versoX(punti[i])
      const y = versoY(punti[i + 1])
      salti.push([x - px, y - py])
      px = x
      py = y
    }
    if (!salti.length) continue
    doc.lines(salti, x0, y0, [1, 1], p.pieno ? 'F' : 'S', p.chiusa)
    disegnate++
  }

  // Le annotazioni si stampano DOPO il disegno, così restano leggibili sopra.
  // Stessa geometria dello schermo: se il PDF se la ricalcolasse, la nuvola
  // stampata non sarebbe quella vista.
  for (const n of o.note || []) {
    const { spezzate, testi } = geometriaNota(n, (n.scala || 1) * 14)
    doc.setDrawColor(n.colore)
    doc.setTextColor(n.colore)
    doc.setLineWidth(0.4)
    for (const punti of spezzate) {
      if (punti.length < 4) continue
      const salti = []
      let px = versoX(punti[0])
      let py = versoY(punti[1])
      const ix = px
      const iy = py
      for (let i = 2; i < punti.length; i += 2) {
        const x = versoX(punti[i])
        const y = versoY(punti[i + 1])
        salti.push([x - px, y - py])
        px = x
        py = y
      }
      if (salti.length) doc.lines(salti, ix, iy, [1, 1], 'S', false)
    }
    for (const t of testi) {
      const h = Math.max(2, t.altezza * k)
      doc.setFontSize((h * 72) / 25.4)
      doc.text(t.testo, versoX(t.x), versoY(t.y))
    }
    disegnate++
  }

  if (o.piede) {
    scriviPiede(doc, {
      larghezzaFoglio,
      altezzaFoglio,
      margine: o.margine,
      nomeFile: modello.nomeFile,
      spazio: spazio.nome,
      scala,
      unita: modello.unita,
      formato: o.formato,
    })
  }

  return { scala, disegnate, avvisi }
}

/**
 * @returns {{blob: Blob, scala: number, avvisi: string[]}}
 */
export async function esportaPdf(modello, spazio, o) {
  const opz = opzioni(o)
  const doc = await nuovoDocumento(opz)
  const esito = disegnaSpazio(doc, modello, spazio, opz)
  return {
    blob: doc.output('blob'),
    arrayBuffer: () => doc.output('arraybuffer'),
    ...esito,
  }
}

/**
 * Tutte le tavole in un PDF solo — una pagina per spazio.
 *
 * È la richiesta più frequente di chi «converte in PDF»: un disegno ha di
 * norma più layout e mandarne uno per volta significa rifare la stessa cosa
 * cinque volte. Ogni pagina tiene la SUA scala, perché due tavole dello stesso
 * file quasi mai stanno alla stessa.
 */
export async function esportaPdfMultiplo(modello, spazi, o) {
  const opz = opzioni(o)
  const doc = await nuovoDocumento(opz)
  const pagine = []
  const avvisi = []
  let primo = true
  for (const spazio of spazi) {
    if (!primo) doc.addPage()
    try {
      const esito = disegnaSpazio(doc, modello, spazio, opz)
      pagine.push({ nome: spazio.nome, scala: esito.scala, disegnate: esito.disegnate })
      avvisi.push(...esito.avvisi)
      primo = false
    } catch (e) {
      // Uno spazio vuoto non deve far fallire l'intero fascicolo: si salta e
      // si dice quale.
      avvisi.push(`«${spazio.nome}» saltata: ${e.message}`)
      if (!primo) doc.deletePage(doc.getNumberOfPages())
    }
  }
  if (!pagine.length) throw new Error('Nessuna tavola da stampare.')
  return {
    blob: doc.output('blob'),
    arrayBuffer: () => doc.output('arraybuffer'),
    pagine,
    avvisi,
  }
}

/**
 * Il piè di pagina non è decorazione: porta la scala, il formato e le unità,
 * cioè le tre cose senza le quali un disegno stampato non si può usare.
 */
function scriviPiede(doc, d) {
  const y = d.altezzaFoglio - d.margine / 2 - 1
  doc.setLineWidth(0.2)
  doc.setDrawColor('#000000')
  doc.line(d.margine, y - 3.5, d.larghezzaFoglio - d.margine, y - 3.5)
  doc.setFontSize(7)
  doc.setTextColor('#000000')

  const sinistra = `${d.nomeFile} — ${d.spazio}`
  const unita = d.unita.dichiarate ? d.unita.nome : 'unità NON dichiarate nel file'
  const centro = `scala 1:${d.scala} · ${d.formato} · disegno in ${unita}`
  const destra = new Date().toLocaleDateString('it-IT')

  doc.text(sinistra, d.margine, y)
  doc.text(centro, d.larghezzaFoglio / 2, y, { align: 'center' })
  doc.text(destra, d.larghezzaFoglio - d.margine, y, { align: 'right' })
}

function disegnabili(spazio, layerVisibili) {
  if (!layerVisibili) return spazio.primitive
  return spazio.primitive.filter((p) => p.tipo !== 'vista' && layerVisibili.has(p.layer))
}

function estensione(primitive) {
  let e = null
  for (const p of primitive) {
    if (p.infinita || p.tipo === 'vista') continue
    e = e
      ? [
          Math.min(e[0], p.ingombro[0]), Math.min(e[1], p.ingombro[1]),
          Math.max(e[2], p.ingombro[2]), Math.max(e[3], p.ingombro[3]),
        ]
      : p.ingombro.slice()
  }
  return e && isFinite(e[0]) ? e : [0, 0, 100, 100]
}

// ============================================================================
//  Tavola con legenda.
//
//  Non è «stampa il disegno»: è «stampa QUELLO CHE VEDO adesso, e spiega cosa
//  c'è dentro». Prende l'inquadratura corrente — non l'estensione totale — la
//  ritaglia al bordo del riquadro e accanto mette una legenda che elenca
//  soltanto ciò che compare in quel riquadro.
//
//  🔴 La legenda elenca il VISIBILE, non il disponibile. Una legenda che
//  riporta tutti i layer del file anche quando in tavola non si vedono è una
//  legenda che mente, e su una tavola di sicurezza la differenza fra «c'è» e
//  «c'è nel file» è tutta.
// ============================================================================

import { formeSimbolo, PER_ID, CATEGORIE } from '../modello/simboli.js'
import { ritaglia } from '../modello/normalizza.js'
import { coloreLayer } from '../modello/colori.js'

const LEGENDA_MM = 58

export async function esportaTavola(modello, spazio, o) {
  const opz = opzioni(o)
  const doc = await nuovoDocumento(opz)
  const [LF, AF] = foglio(opz)
  const vista = o.vista // [x0, y0, x1, y1] in coordinate del disegno
  if (!vista) throw new Error('Serve un\'inquadratura da stampare.')

  const margine = opz.margine
  const areaL = LF - margine * 2 - LEGENDA_MM
  const areaA = AF - margine * 2 - 14 // spazio per il cartiglio in basso
  const largo = Math.max(1e-9, vista[2] - vista[0])
  const alto = Math.max(1e-9, vista[3] - vista[1])

  const mmPerUnita = spazio.carta ? 1 : modello.unita.mm || o.mmPerUnitaSupposto || 1
  const scala = opz.scala || scalaNormalizzata(Math.max((largo * mmPerUnita) / areaL, (alto * mmPerUnita) / areaA))
  const k = mmPerUnita / scala

  // Il disegno si centra nel riquadro. La verticale si scrive una volta e in un
  // modo solo: il bordo ALTO del riquadro corrisponde al lato alto
  // dell'inquadratura, e da lì si scende. La versione precedente sommava e
  // sottraeva gli stessi termini, e il disegno finiva fuori centro.
  const offX = margine + (areaL - largo * k) / 2
  const cima = margine + (areaA - alto * k) / 2
  const vx = (x) => offX + (x - vista[0]) * k
  const vy = (y) => cima + (vista[3] - y) * k

  // Riquadro del disegno.
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.3)
  doc.rect(margine, margine, areaL, areaA)

  // --- disegno, ritagliato al riquadro --------------------------------------
  const layerInVista = new Map()
  let disegnate = 0
  for (const p of spazio.primitive) {
    if (p.tipo === 'vista' || p.infinita) continue
    if (opz.layerVisibili && !opz.layerVisibili.has(p.layer)) continue
    const i = p.ingombro
    if (i[2] < vista[0] || i[0] > vista[2] || i[3] < vista[1] || i[1] > vista[3]) continue

    const colore = opz.monocromatico ? '#000000' : risolviInchiostro(p.colore, true)
    if (p.tipo === 'testo') {
      if (p.x < vista[0] || p.x > vista[2] || p.y < vista[1] || p.y > vista[3]) continue
      layerInVista.set(p.layer, (layerInVista.get(p.layer) || 0) + 1)
      const h = p.altezza * k
      if (h < 0.6) continue
      doc.setTextColor(colore)
      doc.setFontSize((h * 72) / 25.4)
      doc.text(p.testo, vx(p.x), vy(p.y), { angle: (p.rotazione * 180) / Math.PI })
      disegnate++
      continue
    }
    doc.setDrawColor(colore)
    doc.setLineWidth(Math.max(SPESSORE_MINIMO, p.spessore || 0))
    for (const pezzo of ritaglia(p.punti, vista)) {
      const salti = []
      let px = vx(pezzo[0])
      let py = vy(pezzo[1])
      const ix = px
      const iy = py
      for (let i2 = 2; i2 < pezzo.length; i2 += 2) {
        const x = vx(pezzo[i2])
        const y = vy(pezzo[i2 + 1])
        salti.push([x - px, y - py])
        px = x
        py = y
      }
      if (salti.length) {
        doc.lines(salti, ix, iy, [1, 1], 'S', false)
        disegnate++
      }
    }
    layerInVista.set(p.layer, (layerInVista.get(p.layer) || 0) + 1)
  }

  // --- annotazioni e simboli, solo quelli dentro l'inquadratura -------------
  const simboli = new Map()
  for (const n of o.note || []) {
    // Si guarda l'INGOMBRO della nota, non il punto di ancoraggio: una nuvola
    // disegnata partendo da fuori riquadro ha l'angolo fuori ma il corpo
    // dentro, e lasciarla fuori dalla legenda sarebbe sbagliato.
    const g = geometriaNota(n, n.altezza || 14)
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
    for (const f of g.spezzate) {
      for (let i = 0; i < f.length; i += 2) {
        minx = Math.min(minx, f[i]); maxx = Math.max(maxx, f[i])
        miny = Math.min(miny, f[i + 1]); maxy = Math.max(maxy, f[i + 1])
      }
    }
    for (const t of g.testi) {
      minx = Math.min(minx, t.x); maxx = Math.max(maxx, t.x)
      miny = Math.min(miny, t.y); maxy = Math.max(maxy, t.y)
    }
    const dentro = isFinite(minx) &&
      maxx >= vista[0] && minx <= vista[2] && maxy >= vista[1] && miny <= vista[3]
    if (!dentro) continue
    if (n.tipo === 'simbolo') {
      simboli.set(n.simbolo, (simboli.get(n.simbolo) || 0) + 1)
    }
    const { spezzate, testi } = g
    doc.setDrawColor(n.colore)
    doc.setTextColor(n.colore)
    doc.setLineWidth(0.4)
    for (const punti of spezzate) {
      const salti = []
      let px = vx(punti[0])
      let py = vy(punti[1])
      const ix = px
      const iy = py
      for (let i2 = 2; i2 < punti.length; i2 += 2) {
        const x = vx(punti[i2])
        const y = vy(punti[i2 + 1])
        salti.push([x - px, y - py])
        px = x
        py = y
      }
      if (salti.length) doc.lines(salti, ix, iy, [1, 1], 'S', false)
    }
    for (const t of testi) {
      doc.setFontSize((Math.max(2, t.altezza * k) * 72) / 25.4)
      doc.text(t.testo, vx(t.x), vy(t.y))
    }
  }

  const legenda = disegnaLegenda(doc, {
    x: margine + areaL + 6,
    y: margine,
    larghezza: LEGENDA_MM - 6,
    altezza: areaA,
    simboli,
    layer: [...layerInVista.keys()],
    modello,
    mostraLayer: o.conLayer !== false,
  })

  cartiglio(doc, {
    LF, AF, margine,
    titolo: o.titolo || 'Tavola',
    nomeFile: modello.nomeFile,
    spazio: spazio.nome,
    scala,
    unita: modello.unita,
    formato: opz.formato,
  })

  return { blob: doc.output('blob'), arrayBuffer: () => doc.output('arraybuffer'), scala, disegnate, legenda }
}

function disegnaLegenda(doc, d) {
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.3)
  doc.rect(d.x, d.y, d.larghezza, d.altezza)
  doc.setTextColor('#000000')
  doc.setFontSize(9)
  doc.text('LEGENDA', d.x + 3, d.y + 6)
  doc.setLineWidth(0.2)
  doc.line(d.x + 3, d.y + 7.5, d.x + d.larghezza - 3, d.y + 7.5)

  let y = d.y + 13
  let voci = 0
  doc.setFontSize(7)

  for (const [id, quante] of [...d.simboli].sort((a, b) => b[1] - a[1])) {
    const s = PER_ID[id]
    if (!s || y > d.y + d.altezza - 8) continue
    const colore = CATEGORIE[s.cat].colore
    doc.setDrawColor(colore)
    doc.setLineWidth(0.25)
    // Il simbolo si ridisegna dalle sue forme, non da un'immagine: in legenda
    // dev'essere lo stesso segno che sta in tavola.
    for (const f of formeSimbolo(id)) {
      const salti = []
      let px = d.x + 3 + f[0] * 6
      let py = y + 5 - f[1] * 6
      const ix = px
      const iy = py
      for (let i = 2; i < f.length; i += 2) {
        const x = d.x + 3 + f[i] * 6
        const yy = y + 5 - f[i + 1] * 6
        salti.push([x - px, yy - py])
        px = x
        py = yy
      }
      if (salti.length) doc.lines(salti, ix, iy, [1, 1], 'S', false)
    }
    doc.setTextColor('#000000')
    doc.text(`${s.nome}${quante > 1 ? `  ×${quante}` : ''}`, d.x + 11, y + 4)
    y += 8
    voci++
  }

  if (d.mostraLayer && d.layer.length) {
    y += 2
    doc.setTextColor('#000000')
    doc.setFontSize(8)
    doc.text('Layer del disegno', d.x + 3, y + 3)
    y += 6
    doc.setFontSize(7)
    const perNome = new Map(d.modello.layer.map((l) => [l.nome, l]))
    for (const nome of d.layer.sort()) {
      if (y > d.y + d.altezza - 5) break
      const colore = risolviInchiostro(coloreLayer(perNome.get(nome)), true)
      doc.setFillColor(colore)
      doc.rect(d.x + 3, y - 2, 4, 2.4, 'F')
      doc.setTextColor('#000000')
      doc.text(nome.length > 26 ? nome.slice(0, 25) + '…' : nome, d.x + 9, y)
      y += 5
      voci++
    }
  }

  return voci
}

function cartiglio(doc, d) {
  const y = d.AF - d.margine - 4
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.3)
  doc.line(d.margine, y - 6, d.LF - d.margine, y - 6)
  doc.setTextColor('#000000')
  doc.setFontSize(10)
  doc.text(d.titolo, d.margine, y - 0.5)
  doc.setFontSize(7)
  const unita = d.unita.dichiarate ? d.unita.nome : 'unità non dichiarate nel file'
  doc.text(`${d.nomeFile} — ${d.spazio}`, d.margine, y + 4)
  doc.text(`scala 1:${d.scala} · ${d.formato} · disegno in ${unita}`, d.LF / 2, y + 4, { align: 'center' })
  doc.text(new Date().toLocaleDateString('it-IT'), d.LF - d.margine, y + 4, { align: 'right' })
}

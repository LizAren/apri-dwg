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

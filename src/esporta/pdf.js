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
    doc.setTextColor(n.colore)
    doc.setLineWidth(0.4)
    for (const punti of spezzate) {
      if (punti.length < 4) continue
      const tinta = punti.chiaro ? '#ffffff' : n.colore
      doc.setDrawColor(tinta)
      doc.setFillColor(tinta)
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
      if (salti.length) doc.lines(salti, ix, iy, [1, 1], punti.pieno ? 'F' : 'S', punti.pieno)
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

/**
 * Una tavola con UNA O PIÙ viste.
 *
 * L'impostazione è quella già usata per il GIS, che funziona: le viste
 * occupano una griglia scelta perché le celle siano il più grandi e il meno
 * allungate possibile; a destra una colonna con la legenda in alto e il
 * cartiglio in basso. Nessuna cornice attorno a ogni cosa — è quello che fa
 * sembrare vecchia una tavola: bastano un filetto e dello spazio.
 *
 * 🔴 Ogni vista porta LA SUA scala, calcolata davvero. È la differenza fra un
 * disegno tecnico e un'immagine, e due riquadri della stessa tavola quasi mai
 * stanno alla stessa scala.
 */
export async function esportaTavola(modello, spazio, o) {
  const opz = opzioni(o)
  const doc = await nuovoDocumento(opz)
  const [LF, AF] = foglio(opz)
  const viste = (o.viste && o.viste.length ? o.viste : [{ rett: o.vista, nome: '' }])
    .filter((v) => v.rett)
  if (!viste.length) throw new Error("Serve almeno un'inquadratura.")

  const MARGINE = opz.margine
  const RESPIRO = 5
  const COLONNA = 62
  const ALTEZZA_CARTIGLIO = 34

  const utileL = LF - MARGINE * 2 - COLONNA - RESPIRO
  const utileA = AF - MARGINE * 2
  const g = grigliaMigliore(viste.length, utileL, utileA, RESPIRO)

  const mmPerUnita = spazio.carta ? 1 : modello.unita.mm || o.mmPerUnitaSupposto || 1
  const simboli = new Map()
  const layerInVista = new Map()
  const scale = []
  let disegnate = 0

  for (let i = 0; i < viste.length; i++) {
    const riga = Math.floor(i / g.colonne)
    const col = i % g.colonne
    const x0 = MARGINE + col * (g.l + RESPIRO)
    const y0 = MARGINE + riga * (g.a + RESPIRO)
    const r = viste[i].rett
    const largo = Math.max(1e-9, r[2] - r[0])
    const alto = Math.max(1e-9, r[3] - r[1])
    const scala = opz.scala || scalaNormalizzata(
      Math.max((largo * mmPerUnita) / g.l, (alto * mmPerUnita) / (g.a - 6))
    )
    const k = mmPerUnita / scala
    const cx = x0 + (g.l - largo * k) / 2
    const cy = y0 + (g.a - 6 - alto * k) / 2
    const vx = (x) => cx + (x - r[0]) * k
    const vy = (y) => cy + (r[3] - y) * k

    doc.setDrawColor('#8a8a8a')
    doc.setLineWidth(0.25)
    doc.rect(x0, y0, g.l, g.a - 6)

    disegnate += disegnaDentroVista(doc, {
      spazio, r, vx, vy, k, opz, note: o.note || [],
      simboli, layerInVista,
    })

    doc.setTextColor('#333333')
    doc.setFontSize(7.5)
    const etichetta = viste[i].nome
      ? `${viste[i].nome} — 1:${scala}`
      : `Vista ${i + 1} — 1:${scala}`
    doc.text(etichetta, x0, y0 + g.a - 1.5)
    scale.push(scala)
  }

  const xd = LF - MARGINE - COLONNA
  const hLegenda = utileA - ALTEZZA_CARTIGLIO - RESPIRO
  const legenda = disegnaLegenda(doc, {
    x: xd, y: MARGINE, larghezza: COLONNA, altezza: hLegenda,
    simboli, layer: [...layerInVista.keys()], modello,
    mostraLayer: o.conLayer !== false,
  })
  cartiglio(doc, {
    x: xd, y: MARGINE + hLegenda + RESPIRO, larghezza: COLONNA, altezza: ALTEZZA_CARTIGLIO,
    titolo: o.titolo || 'Tavola',
    nomeFile: modello.nomeFile, spazio: spazio.nome,
    scale, unita: modello.unita, formato: opz.formato,
  })

  return {
    blob: doc.output('blob'),
    arrayBuffer: () => doc.output('arraybuffer'),
    scala: scale[0], scale, viste: viste.length, disegnate, legenda,
  }
}

/**
 * La griglia migliore per n viste: fra due disposizioni di pari area si
 * preferisce la cella meno allungata, perché una vista lunga e stretta non si
 * legge. (Stesso criterio della tavola del GIS.)
 */
function grigliaMigliore(n, larghezza, altezza, respiro) {
  let scelta = { righe: 1, colonne: n, punteggio: 0, l: larghezza, a: altezza }
  for (let righe = 1; righe <= n; righe++) {
    const colonne = Math.ceil(n / righe)
    const l = (larghezza - respiro * (colonne - 1)) / colonne
    const a = (altezza - respiro * (righe - 1)) / righe
    if (l <= 20 || a <= 20) continue
    const proporzione = Math.max(l / a, a / l)
    const punteggio = (l * a) / proporzione
    if (punteggio > scelta.punteggio) scelta = { righe, colonne, punteggio, l, a }
  }
  return scelta
}

/** Disegna una vista dentro il suo riquadro e raccoglie le voci di legenda. */
function disegnaDentroVista(doc, d) {
  let disegnate = 0
  for (const p of d.spazio.primitive) {
    if (p.tipo === 'vista' || p.infinita) continue
    if (d.opz.layerVisibili && !d.opz.layerVisibili.has(p.layer)) continue
    const i = p.ingombro
    if (i[2] < d.r[0] || i[0] > d.r[2] || i[3] < d.r[1] || i[1] > d.r[3]) continue

    const colore = d.opz.monocromatico ? '#000000' : risolviInchiostro(p.colore, true)
    if (p.tipo === 'testo') {
      if (p.x < d.r[0] || p.x > d.r[2] || p.y < d.r[1] || p.y > d.r[3]) continue
      d.layerInVista.set(p.layer, (d.layerInVista.get(p.layer) || 0) + 1)
      const h = p.altezza * d.k
      if (h < 0.6) continue
      doc.setTextColor(colore)
      doc.setFontSize((h * 72) / 25.4)
      doc.text(p.testo, d.vx(p.x), d.vy(p.y), { angle: (p.rotazione * 180) / Math.PI })
      disegnate++
      continue
    }
    doc.setDrawColor(colore)
    doc.setLineWidth(Math.max(SPESSORE_MINIMO, p.spessore || 0))
    for (const pezzo of ritaglia(p.punti, d.r)) {
      if (tratta(doc, pezzo, d.vx, d.vy, false, false)) disegnate++
    }
    d.layerInVista.set(p.layer, (d.layerInVista.get(p.layer) || 0) + 1)
  }

  for (const n of d.note) {
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
      maxx >= d.r[0] && minx <= d.r[2] && maxy >= d.r[1] && miny <= d.r[3]
    if (!dentro) continue
    if (n.tipo === 'simbolo') d.simboli.set(n.simbolo, (d.simboli.get(n.simbolo) || 0) + 1)

    doc.setTextColor(n.colore)
    doc.setLineWidth(0.4)
    for (const punti of g.spezzate) {
      const tinta = punti.chiaro ? '#ffffff' : n.colore
      doc.setDrawColor(tinta)
      doc.setFillColor(tinta)
      tratta(doc, punti, d.vx, d.vy, punti.pieno, punti.pieno)
    }
    for (const t of g.testi) {
      doc.setFontSize((Math.max(2, t.altezza * d.k) * 72) / 25.4)
      doc.text(t.testo, d.vx(t.x), d.vy(t.y))
    }
  }
  return disegnate
}

/** Una spezzata sul foglio. Torna false se non c'era niente da disegnare. */
function tratta(doc, punti, vx, vy, pieno, chiudi) {
  if (!punti || punti.length < 4) return false
  const salti = []
  let px = vx(punti[0])
  let py = vy(punti[1])
  const ix = px
  const iy = py
  for (let i = 2; i < punti.length; i += 2) {
    const x = vx(punti[i])
    const y = vy(punti[i + 1])
    salti.push([x - px, y - py])
    px = x
    py = y
  }
  if (!salti.length) return false
  doc.lines(salti, ix, iy, [1, 1], pieno ? 'F' : 'S', !!chiudi)
  return true
}

/**
 * La legenda: niente cornice e niente fascia in testa, solo un filetto e dello
 * spazio. Elenca il VISIBILE, non il disponibile — una legenda che riporta
 * tutti i layer del file anche quando in tavola non si vedono costringe chi
 * legge a cercare segni che lì non ci sono.
 */
function disegnaLegenda(doc, d) {
  doc.setTextColor('#141414')
  doc.setFontSize(7)
  doc.text('LEGENDA', d.x, d.y + 4)
  doc.setDrawColor('#282828')
  doc.setLineWidth(0.35)
  doc.line(d.x, d.y + 6.4, d.x + d.larghezza, d.y + 6.4)

  let y = d.y + 12.5
  const passo = 6.4
  let voci = 0

  for (const [id, quante] of [...d.simboli].sort((a, b) => b[1] - a[1])) {
    const s = PER_ID[id]
    if (!s || y > d.y + d.altezza - 6) continue
    const colore = CATEGORIE[s.cat].colore
    // Il simbolo in legenda si ridisegna dalle SUE forme: dev'essere lo stesso
    // segno che sta in tavola, non una sua imitazione.
    for (const f of formeSimbolo(id)) {
      const tinta = f.chiaro ? '#ffffff' : colore
      doc.setDrawColor(tinta)
      doc.setFillColor(tinta)
      doc.setLineWidth(0.2)
      tratta(doc, f.punti, (u) => d.x + u * 5.4, (v) => y + 1.6 - v * 5.4, f.pieno, f.pieno)
    }
    doc.setTextColor('#232323')
    doc.setFontSize(7)
    doc.text(s.nome, d.x + 8, y, { maxWidth: d.larghezza - 16 })
    doc.setTextColor('#8a8a8a')
    doc.setFontSize(6.4)
    doc.text(String(quante), d.x + d.larghezza, y, { align: 'right' })
    y += passo
    voci++
  }

  if (d.mostraLayer && d.layer.length) {
    y += 3
    doc.setTextColor('#141414')
    doc.setFontSize(7)
    doc.text('LAYER IN TAVOLA', d.x, y)
    doc.setDrawColor('#282828')
    doc.setLineWidth(0.25)
    doc.line(d.x, y + 1.8, d.x + d.larghezza, y + 1.8)
    y += 7
    doc.setFontSize(6.6)
    const perNome = new Map(d.modello.layer.map((l) => [l.nome, l]))
    for (const nome of [...d.layer].sort()) {
      if (y > d.y + d.altezza - 3) break
      doc.setFillColor(risolviInchiostro(coloreLayer(perNome.get(nome)), true))
      doc.rect(d.x, y - 1.8, 5, 2.2, 'F')
      doc.setTextColor('#333333')
      doc.text(nome.length > 28 ? nome.slice(0, 27) + '…' : nome, d.x + 7, y)
      y += 4.6
      voci++
    }
  }
  return voci
}

/** Il cartiglio: i dati senza i quali una tavola stampata non si usa. */
function cartiglio(doc, d) {
  doc.setDrawColor('#282828')
  doc.setLineWidth(0.35)
  doc.line(d.x, d.y, d.x + d.larghezza, d.y)

  doc.setTextColor('#141414')
  doc.setFontSize(10)
  doc.text(d.titolo, d.x, d.y + 6, { maxWidth: d.larghezza })

  doc.setFontSize(6.6)
  doc.setTextColor('#4a4a4a')
  const unita = d.unita.dichiarate ? d.unita.nome : 'unità non dichiarate nel file'
  const scale = [...new Set(d.scale)].map((s) => `1:${s}`).join(' · ')
  const righe = [
    d.nomeFile,
    `spazio: ${d.spazio}`,
    `scala ${scale}`,
    `disegno in ${unita}`,
    `${d.formato} · ${new Date().toLocaleDateString('it-IT')}`,
  ]
  let y = d.y + 12
  for (const r of righe) {
    doc.text(r, d.x, y, { maxWidth: d.larghezza })
    y += 4
  }
}

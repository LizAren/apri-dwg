// ============================================================================
//  La tela: disegna il modello e gestisce spostamento e ingrandimento.
//
//  Perché Canvas 2D e non WebGL. Lo studio di fattibilità ipotizzava three.js;
//  costruito il modello si è visto che non serve: il disegno è già ridotto a
//  spezzate e testi, e un disegno tecnico si guarda fermo, non si fa ruotare.
//  Canvas 2D toglie 600 kB di libreria, non ha contesti da perdere quando il
//  telefono va in sospensione, e permette una cosa che con WebGL sarebbe più
//  complicata: raggruppare le spezzate per colore e spessore e chiudere ogni
//  gruppo con UNA sola passata. La velocità qui non viene dalla GPU, viene dal
//  non ridisegnare ciò che non si vede.
//
//  Tre accorgimenti, tutti misurabili:
//   1. si scartano le primitive fuori schermo (confronto di rettangoli);
//   2. si scarta ciò che a schermo occuperebbe meno di un pixel e mezzo;
//   3. si raggruppa per colore e spessore, così i cambi di stato del contesto
//      sono qualche decina invece di qualche decina di migliaia.
// ============================================================================

import { risolviInchiostro } from '../modello/colori.js'

const MIN_PIXEL = 1.5
const MIN_TESTO = 5

export class Tela {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.spazio = null
    this.zoom = 1
    this.cx = 0
    this.cy = 0
    this.fondoChiaro = false
    this.layerVisibili = null
    this.daRidisegnare = false
    this.ultimoDisegnate = 0
    this.qualitaPiena = true
    this.panBloccato = false
    this._collega()
    this._adatta()
    new ResizeObserver(() => this._adatta()).observe(canvas.parentElement || canvas)
  }

  mostra(spazio) {
    this.spazio = spazio
    this._gruppi = null
    this.zoomTutto()
  }

  /** Inquadra tutto il disegno con un margine del 4%. */
  zoomTutto() {
    if (!this.spazio) return
    this.inquadra(this.spazio.estensione)
  }

  /**
   * Porta l'inquadratura su un rettangolo del disegno, con lo stesso margine.
   * @param {number[]} r  [x0, y0, x1, y1] in coordinate del disegno
   */
  inquadra(r) {
    const l = this.canvas.clientWidth || 1
    const a = this.canvas.clientHeight || 1
    const larghezza = Math.max(1e-9, r[2] - r[0])
    const altezza = Math.max(1e-9, r[3] - r[1])
    this.zoom = Math.min(l / larghezza, a / altezza) * 0.92
    this.cx = (r[0] + r[2]) / 2
    this.cy = (r[1] + r[3]) / 2
    this.ridisegna()
  }

  ridisegna() {
    if (this.daRidisegnare) return
    this.daRidisegnare = true
    requestAnimationFrame(() => {
      this.daRidisegnare = false
      this._disegna()
    })
  }

  /** Coordinate del disegno → pixel sullo schermo. */
  aSchermo(x, y) {
    const l = this.canvas.clientWidth / 2
    const a = this.canvas.clientHeight / 2
    return [l + (x - this.cx) * this.zoom, a - (y - this.cy) * this.zoom]
  }

  /** Pixel sullo schermo → coordinate del disegno. */
  aDisegno(px, py) {
    const l = this.canvas.clientWidth / 2
    const a = this.canvas.clientHeight / 2
    return [this.cx + (px - l) / this.zoom, this.cy - (py - a) / this.zoom]
  }

  // -------------------------------------------------------------------------

  _adatta() {
    const r = window.devicePixelRatio || 1
    const l = this.canvas.clientWidth
    const a = this.canvas.clientHeight
    if (!l || !a) return
    this.canvas.width = Math.round(l * r)
    this.canvas.height = Math.round(a * r)
    this.ctx.setTransform(r, 0, 0, r, 0, 0)
    this.ridisegna()
  }

  /**
   * Raggruppa le primitive per colore e spessore. Si fa una volta sola per
   * disegno: rifarlo a ogni fotogramma costerebbe più del disegno stesso.
   */
  _prepara() {
    if (this._gruppi) return this._gruppi
    const gruppi = new Map()
    const testi = []
    for (const p of this.spazio.primitive) {
      if (p.tipo === 'testo') {
        testi.push(p)
        continue
      }
      if (p.tipo === 'vista') continue
      const chiave = `${p.colore}|${p.spessore}|${p.pieno ? 'p' : 's'}`
      let gruppo = gruppi.get(chiave)
      if (!gruppo) {
        gruppo = { colore: p.colore, spessore: p.spessore, pieno: p.pieno, elementi: [] }
        gruppi.set(chiave, gruppo)
      }
      gruppo.elementi.push(p)
    }
    this._gruppi = { gruppi: [...gruppi.values()], testi }
    return this._gruppi
  }

  _visibile(layer) {
    return !this.layerVisibili || this.layerVisibili.has(layer)
  }

  _disegna() {
    const ctx = this.ctx
    const l = this.canvas.clientWidth
    const a = this.canvas.clientHeight
    ctx.fillStyle = this.fondoChiaro ? '#ffffff' : '#0c0f13'
    ctx.fillRect(0, 0, l, a)
    if (!this.spazio) return

    // Rettangolo inquadrato, in coordinate del disegno, con un po' di margine.
    const [x0, y1] = this.aDisegno(-50, -50)
    const [x1, y0] = this.aDisegno(l + 50, a + 50)
    const vista = [x0, y0, x1, y1]

    const { gruppi, testi } = this._prepara()
    const zoom = this.zoom
    const cxs = l / 2
    const cys = a / 2
    let disegnate = 0

    for (const gruppo of gruppi) {
      ctx.strokeStyle = risolviInchiostro(gruppo.colore, this.fondoChiaro)
      ctx.fillStyle = ctx.strokeStyle
      // Lo spessore vero in millimetri conta solo sulla carta: a schermo si
      // usa un tratto sottile e costante, se no ingrandendo il disegno
      // diventa una macchia nera.
      ctx.lineWidth = gruppo.spessore > 0.35 ? 1.6 : 1
      ctx.beginPath()
      let aperto = false

      for (const p of gruppo.elementi) {
        if (!this._visibile(p.layer)) continue
        const i = p.ingombro
        if (i[2] < vista[0] || i[0] > vista[2] || i[3] < vista[1] || i[1] > vista[3]) continue
        if (!p.punto && (i[2] - i[0]) * zoom < MIN_PIXEL && (i[3] - i[1]) * zoom < MIN_PIXEL) continue

        const punti = p.punti
        if (p.punto) {
          const sx = cxs + (punti[0] - this.cx) * zoom
          const sy = cys - (punti[1] - this.cy) * zoom
          ctx.moveTo(sx - 3, sy)
          ctx.lineTo(sx + 3, sy)
          ctx.moveTo(sx, sy - 3)
          ctx.lineTo(sx, sy + 3)
          aperto = true
          disegnate++
          continue
        }

        ctx.moveTo(cxs + (punti[0] - this.cx) * zoom, cys - (punti[1] - this.cy) * zoom)
        for (let k = 2; k < punti.length; k += 2) {
          ctx.lineTo(cxs + (punti[k] - this.cx) * zoom, cys - (punti[k + 1] - this.cy) * zoom)
        }
        if (p.chiusa) ctx.closePath()
        aperto = true
        disegnate++
      }

      if (!aperto) continue
      if (gruppo.pieno) ctx.fill()
      else ctx.stroke()
    }

    // I testi si disegnano dopo, così non restano sotto alle campiture.
    if (this.qualitaPiena) {
      ctx.textBaseline = 'alphabetic'
      for (const t of testi) {
        if (!this._visibile(t.layer)) continue
        const h = t.altezza * zoom
        if (h < MIN_TESTO) continue
        const i = t.ingombro
        if (i[2] < vista[0] || i[0] > vista[2] || i[3] < vista[1] || i[1] > vista[3]) continue
        const sx = cxs + (t.x - this.cx) * zoom
        const sy = cys - (t.y - this.cy) * zoom
        ctx.fillStyle = risolviInchiostro(t.colore, this.fondoChiaro)
        ctx.font = `${h.toFixed(1)}px "Public Sans", ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = ['left', 'center', 'right'][t.allineamento] || 'left'
        if (t.rotazione) {
          ctx.save()
          ctx.translate(sx, sy)
          ctx.rotate(-t.rotazione)
          ctx.fillText(t.testo, 0, 0)
          ctx.restore()
        } else {
          ctx.fillText(t.testo, sx, sy)
        }
        disegnate++
      }
    }

    // Gli strumenti disegnano sopra il disegno: aggancio, misure, evidenziato.
    // Sta qui e non in un secondo canvas perché così l'ordine è garantito e
    // non c'è un secondo contesto da tenere allineato al variare dello zoom.
    this.sovrapposizione?.(ctx, this)

    this.ultimoDisegnate = disegnate
    this.onDisegnato?.(disegnate)
  }

  // -------------------------------------------------------------------------
  //  Comandi
  // -------------------------------------------------------------------------

  _collega() {
    const c = this.canvas
    let trascina = null

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId)
      trascina = { x: e.clientX, y: e.clientY }
      c.style.cursor = 'grabbing'
    })

    c.addEventListener('pointermove', (e) => {
      // 🔴 Se uno strumento ha preso il trascinamento — sta disegnando,
      // spostando o ridimensionando un'annotazione — la vista NON si muove.
      // Senza questo, spostare una nota faceva scorrere anche il disegno sotto,
      // e la nota sembrava restare ferma mentre in realtà si muovevano
      // entrambi.
      if (this.panBloccato) return
      if (!trascina) return
      const dx = e.clientX - trascina.x
      const dy = e.clientY - trascina.y
      trascina = { x: e.clientX, y: e.clientY }
      this.cx -= dx / this.zoom
      this.cy += dy / this.zoom
      this.ridisegna()
    })

    const fine = (e) => {
      trascina = null
      c.style.cursor = 'grab'
      if (e.pointerId != null && c.hasPointerCapture?.(e.pointerId)) {
        c.releasePointerCapture(e.pointerId)
      }
    }
    c.addEventListener('pointerup', fine)
    c.addEventListener('pointercancel', fine)

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const r = c.getBoundingClientRect()
        const px = e.clientX - r.left
        const py = e.clientY - r.top
        // Si ingrandisce verso il puntatore: il punto sotto il dito resta fermo.
        const [px0, py0] = this.aDisegno(px, py)
        const fattore = Math.exp(-e.deltaY * 0.0015)
        this.zoom = Math.min(1e9, Math.max(1e-9, this.zoom * fattore))
        const [px1, py1] = this.aDisegno(px, py)
        this.cx += px0 - px1
        this.cy += py0 - py1
        this.ridisegna()
      },
      { passive: false }
    )

    // Pizzicata a due dita.
    let dita = new Map()
    let distanza = null
    c.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) distanza = distanzaDita(e.touches)
    })
    c.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length !== 2 || distanza == null) return
        e.preventDefault()
        const nuova = distanzaDita(e.touches)
        this.zoom = Math.min(1e9, Math.max(1e-9, this.zoom * (nuova / distanza)))
        distanza = nuova
        this.ridisegna()
      },
      { passive: false }
    )
    c.addEventListener('touchend', () => {
      distanza = null
      dita = new Map()
      void dita
    })

    c.style.cursor = 'grab'
    c.tabIndex = 0
  }
}

function distanzaDita(t) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
}

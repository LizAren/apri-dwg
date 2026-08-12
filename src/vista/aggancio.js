// ============================================================================
//  Trovare le cose sotto il dito: indice spaziale, selezione e aggancio.
//
//  Un disegno vero ha decine di migliaia di primitive. Cercare la più vicina
//  scorrendole tutte a ogni movimento del mouse costerebbe più del disegno
//  stesso, quindi si costruisce una griglia una volta sola e si guarda solo
//  nelle celle attorno al puntatore.
//
//  🔴 L'aggancio non è un dettaglio da misuratori pignoli: è LA differenza fra
//  una misura e un numero a caso. Senza, si clicca «più o meno» sull'estremo di
//  un muro e si legge una lunghezza che non è quella del muro. Per questo la
//  priorità è fissa e dichiarata — estremo, centro, intersezione, punto medio,
//  e solo per ultimo il punto più vicino sulla linea.
// ============================================================================

/** Priorità: più basso vince, a parità di distanza. */
const PRIORITA = {
  estremo: 1,
  centro: 2,
  intersezione: 3,
  medio: 4,
  vicino: 5,
}

export const NOMI_AGGANCIO = {
  estremo: 'estremo',
  centro: 'centro',
  intersezione: 'intersezione',
  medio: 'punto medio',
  vicino: 'sulla linea',
}

/** Oltre questi si smette di guardare: meglio un aggancio in meno che uno scatto. */
const MAX_SEGMENTI = 900
const MAX_COPPIE = 60

export class Indice {
  constructor(spazio) {
    const e = spazio.estensione
    this.minX = e[0]
    this.minY = e[1]
    const larghezza = Math.max(1e-9, e[2] - e[0])
    const altezza = Math.max(1e-9, e[3] - e[1])
    // Una griglia attorno a 96×96: abbastanza fine da scremare, abbastanza
    // grossa da non costare memoria su disegni enormi.
    this.passo = Math.max(larghezza, altezza) / 96
    this.celle = new Map()
    this.grandi = []

    for (const p of spazio.primitive) {
      if (p.tipo === 'vista') continue
      const i = p.ingombro
      if (!isFinite(i[0])) continue
      const c0 = this.cella(i[0], i[1])
      const c1 = this.cella(i[2], i[3])
      const quante = (c1[0] - c0[0] + 1) * (c1[1] - c0[1] + 1)
      // Una primitiva che copre mezzo disegno starebbe in migliaia di celle:
      // si mette da parte e si guarda sempre, costa meno.
      if (quante > 400) {
        this.grandi.push(p)
        continue
      }
      for (let cx = c0[0]; cx <= c1[0]; cx++) {
        for (let cy = c0[1]; cy <= c1[1]; cy++) {
          const k = cx + ',' + cy
          let lista = this.celle.get(k)
          if (!lista) this.celle.set(k, (lista = []))
          lista.push(p)
        }
      }
    }
  }

  cella(x, y) {
    return [Math.floor((x - this.minX) / this.passo), Math.floor((y - this.minY) / this.passo)]
  }

  /** Primitive che potrebbero trovarsi entro `raggio` dal punto. */
  candidati(x, y, raggio) {
    const [x0, y0] = this.cella(x - raggio, y - raggio)
    const [x1, y1] = this.cella(x + raggio, y + raggio)
    const fuori = new Set(this.grandi)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const lista = this.celle.get(cx + ',' + cy)
        if (lista) for (const p of lista) fuori.add(p)
      }
    }
    return fuori
  }
}

/** Distanza fra un punto e un segmento, e il piede della perpendicolare. */
function suSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const x = ax + t * dx
  const y = ay + t * dy
  return { x, y, d: Math.hypot(px - x, py - y), t }
}

/**
 * L'elemento sotto il punto, o null. `tolleranza` è in unità di disegno
 * (chi chiama la ricava dai pixel dividendo per lo zoom).
 */
export function colpisci(indice, x, y, tolleranza, visibile) {
  let migliore = null
  let minima = tolleranza
  for (const p of indice.candidati(x, y, tolleranza)) {
    if (visibile && !visibile(p.layer)) continue
    const i = p.ingombro
    if (x < i[0] - tolleranza || x > i[2] + tolleranza) continue
    if (y < i[1] - tolleranza || y > i[3] + tolleranza) continue

    if (p.tipo === 'testo') {
      // Per un testo basta il rettangolo: la forma delle lettere non serve.
      const dentro = x >= i[0] && x <= i[2] && y >= i[1] && y <= i[3]
      if (dentro && minima > 0) {
        migliore = p
        minima = 0
      }
      continue
    }
    const pt = p.punti
    for (let k = 0; k < pt.length - 2; k += 2) {
      const r = suSegmento(x, y, pt[k], pt[k + 1], pt[k + 2], pt[k + 3])
      if (r.d < minima) {
        minima = r.d
        migliore = p
      }
    }
  }
  return migliore
}

/**
 * Il punto notevole più vicino. Restituisce `{x, y, tipo}` oppure il punto
 * grezzo con tipo `null` se non c'è niente da agganciare.
 */
export function aggancia(indice, x, y, tolleranza, visibile) {
  const candidati = indice.candidati(x, y, tolleranza)
  let migliore = null
  const proponi = (px, py, tipo) => {
    const d = Math.hypot(px - x, py - y)
    if (d > tolleranza) return
    if (
      !migliore ||
      PRIORITA[tipo] < PRIORITA[migliore.tipo] ||
      (PRIORITA[tipo] === PRIORITA[migliore.tipo] && d < migliore.d)
    ) {
      migliore = { x: px, y: py, tipo, d }
    }
  }

  const segmenti = []
  for (const p of candidati) {
    if (visibile && !visibile(p.layer)) continue
    if (p.tipo === 'testo') continue
    if (p.centro) proponi(p.centro.x, p.centro.y, 'centro')

    const pt = p.punti
    for (let k = 0; k < pt.length - 2 && segmenti.length < MAX_SEGMENTI; k += 2) {
      const ax = pt[k]
      const ay = pt[k + 1]
      const bx = pt[k + 2]
      const by = pt[k + 3]
      // Si scartano subito i segmenti lontani: il confronto di rettangoli
      // costa molto meno della radice quadrata.
      if (Math.min(ax, bx) - tolleranza > x || Math.max(ax, bx) + tolleranza < x) continue
      if (Math.min(ay, by) - tolleranza > y || Math.max(ay, by) + tolleranza < y) continue

      proponi(ax, ay, 'estremo')
      proponi(bx, by, 'estremo')
      proponi((ax + bx) / 2, (ay + by) / 2, 'medio')
      const r = suSegmento(x, y, ax, ay, bx, by)
      proponi(r.x, r.y, 'vicino')
      segmenti.push([ax, ay, bx, by, p])
    }
  }

  // Intersezioni: solo fra segmenti di primitive DIVERSE, e solo su un numero
  // chiuso di coppie. Due segmenti della stessa polilinea si toccano per
  // costruzione, e proporre quel punto come «intersezione» sarebbe rumore.
  let coppie = 0
  for (let i = 0; i < segmenti.length && coppie < MAX_COPPIE; i++) {
    for (let j = i + 1; j < segmenti.length && coppie < MAX_COPPIE; j++) {
      if (segmenti[i][4] === segmenti[j][4]) continue
      coppie++
      const p = incrocio(segmenti[i], segmenti[j])
      if (p) proponi(p.x, p.y, 'intersezione')
    }
  }

  return migliore || { x, y, tipo: null }
}

function incrocio(a, b) {
  const [ax, ay, bx, by] = a
  const [cx, cy, dx, dy] = b
  const r1 = bx - ax
  const r2 = by - ay
  const s1 = dx - cx
  const s2 = dy - cy
  const den = r1 * s2 - r2 * s1
  if (Math.abs(den) < 1e-12) return null
  const t = ((cx - ax) * s2 - (cy - ay) * s1) / den
  const u = ((cx - ax) * r2 - (cy - ay) * r1) / den
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: ax + t * r1, y: ay + t * r2 }
}

/** Lunghezza complessiva di una spezzata. */
export function lunghezza(p) {
  const pt = p.punti
  let l = 0
  for (let k = 0; k < pt.length - 2; k += 2) {
    l += Math.hypot(pt[k + 2] - pt[k], pt[k + 3] - pt[k + 1])
  }
  return l
}

/** Area con segno di una spezzata chiusa (formula di Gauss). */
export function area(p) {
  const pt = p.punti
  let a = 0
  for (let k = 0; k < pt.length - 2; k += 2) {
    a += pt[k] * pt[k + 3] - pt[k + 2] * pt[k + 1]
  }
  return Math.abs(a) / 2
}

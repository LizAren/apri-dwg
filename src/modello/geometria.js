// ============================================================================
//  Geometria: tutto diventa una spezzata.
//
//  Il visualizzatore e il PDF lavorano su due sole forme — spezzate e testi.
//  Archi, cerchi, ellissi, spline e polilinee con bulge vengono quindi
//  suddivisi qui, una volta sola, all'apertura del file.
//
//  🔴 La finezza della suddivisione è RELATIVA al raggio, non assoluta: una
//  tolleranza fissa in unità di disegno sarebbe grossolana su un cerchio da un
//  metro e assurda su uno da un centimetro. Con lo scarto massimo allo 0,05%
//  del raggio un cerchio intero esce in un centinaio di segmenti, che su carta
//  a qualsiasi scala è indistinguibile da una curva.
// ============================================================================

/** Scarto massimo fra corda e arco, in frazione del raggio. */
const TOLLERANZA = 5e-4
const SEGMENTI_MIN = 8
const SEGMENTI_MAX = 512

/** Quanti segmenti servono per un arco di ampiezza `ampiezza` (radianti). */
function quantiSegmenti(ampiezza) {
  const passo = 2 * Math.acos(1 - TOLLERANZA)
  const n = Math.ceil(Math.abs(ampiezza) / passo)
  return Math.min(SEGMENTI_MAX, Math.max(SEGMENTI_MIN, n))
}

/**
 * Punti di un arco. Gli angoli sono in radianti e si percorre sempre in senso
 * antiorario da `a0` ad `a1`, come vuole la convenzione DWG/DXF.
 */
export function arco(cx, cy, r, a0, a1) {
  let ampiezza = a1 - a0
  while (ampiezza <= 0) ampiezza += Math.PI * 2
  const n = quantiSegmenti(ampiezza)
  const punti = new Array((n + 1) * 2)
  for (let i = 0; i <= n; i++) {
    const a = a0 + (ampiezza * i) / n
    punti[i * 2] = cx + r * Math.cos(a)
    punti[i * 2 + 1] = cy + r * Math.sin(a)
  }
  return punti
}

/** Punti di un cerchio intero. */
export function cerchio(cx, cy, r) {
  return arco(cx, cy, r, 0, Math.PI * 2 - 1e-12)
}

/**
 * Punti di un'ellisse, eventualmente ruotata e parziale.
 * `mx,my` è l'estremo dell'asse maggiore rispetto al centro; `rapporto` è il
 * rapporto fra semiasse minore e maggiore; gli angoli sono parametrici.
 */
export function ellisse(cx, cy, mx, my, rapporto, a0, a1) {
  const semiMaggiore = Math.hypot(mx, my)
  const semiMinore = semiMaggiore * rapporto
  const rotazione = Math.atan2(my, mx)
  let ampiezza = a1 - a0
  if (Math.abs(ampiezza) < 1e-12) ampiezza = Math.PI * 2
  while (ampiezza <= 0) ampiezza += Math.PI * 2
  const n = quantiSegmenti(ampiezza)
  const cosR = Math.cos(rotazione)
  const sinR = Math.sin(rotazione)
  const punti = new Array((n + 1) * 2)
  for (let i = 0; i <= n; i++) {
    const t = a0 + (ampiezza * i) / n
    const x = semiMaggiore * Math.cos(t)
    const y = semiMinore * Math.sin(t)
    punti[i * 2] = cx + x * cosR - y * sinR
    punti[i * 2 + 1] = cy + x * sinR + y * cosR
  }
  return punti
}

/**
 * Tratto di polilinea fra due vertici con «bulge» (la tangente dell'angolo al
 * centro diviso quattro: è il modo in cui il DXF descrive un arco dentro una
 * polilinea). Restituisce i punti INTERMEDI più il vertice finale.
 */
export function bulge(x0, y0, x1, y1, b) {
  if (!b) return [x1, y1]
  const angolo = Math.atan(b) * 4
  const corda = Math.hypot(x1 - x0, y1 - y0)
  if (corda < 1e-12) return [x1, y1]
  const raggio = corda / (2 * Math.sin(Math.abs(angolo) / 2))
  // Centro: dal punto medio della corda, spostato lungo la perpendicolare.
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  const h = Math.sqrt(Math.max(0, raggio * raggio - (corda / 2) ** 2))
  const dx = (x1 - x0) / corda
  const dy = (y1 - y0) / corda
  const verso = b > 0 ? 1 : -1
  const grande = Math.abs(angolo) > Math.PI ? -1 : 1
  const cx = mx - dy * h * verso * grande
  const cy = my + dx * h * verso * grande
  const a0 = Math.atan2(y0 - cy, x0 - cx)
  const a1 = Math.atan2(y1 - cy, x1 - cx)
  const punti = b > 0 ? arco(cx, cy, raggio, a0, a1) : rovescia(arco(cx, cy, raggio, a1, a0))
  punti.splice(0, 2) // il primo punto c'è già
  return punti
}

/** Inverte una lista piatta [x,y,x,y,…] mantenendo le coppie. */
export function rovescia(punti) {
  const out = new Array(punti.length)
  for (let i = 0, j = punti.length - 2; i < punti.length; i += 2, j -= 2) {
    out[i] = punti[j]
    out[i + 1] = punti[j + 1]
  }
  return out
}

/**
 * Spline NURBS valutata con l'algoritmo di De Boor.
 * Se mancano i nodi si ripiega sui punti di interpolazione, che è meglio di
 * niente e non produce mai forme assurde.
 */
export function spline(gradi, controllo, nodi, pesi, interpolazione) {
  if (!controllo || controllo.length < 2) {
    return piatti(interpolazione || [])
  }
  const n = controllo.length
  const p = Math.min(gradi || 3, n - 1)
  if (!nodi || nodi.length !== n + p + 1) {
    // Nodi mancanti o incoerenti: si collega quello che c'è.
    return piatti(controllo)
  }
  const passi = Math.min(SEGMENTI_MAX, Math.max(SEGMENTI_MIN, n * 8))
  const t0 = nodi[p]
  const t1 = nodi[n]
  const punti = new Array((passi + 1) * 2)
  for (let i = 0; i <= passi; i++) {
    const t = t0 + ((t1 - t0) * i) / passi
    const [x, y] = deBoor(t, p, controllo, nodi, pesi)
    punti[i * 2] = x
    punti[i * 2 + 1] = y
  }
  return punti
}

function deBoor(t, p, controllo, nodi, pesi) {
  const n = controllo.length
  // intervallo che contiene t
  let k = p
  while (k < n - 1 && t >= nodi[k + 1]) k++
  const d = []
  for (let j = 0; j <= p; j++) {
    const idx = Math.min(n - 1, Math.max(0, k - p + j))
    const w = pesi && pesi.length === n ? pesi[idx] : 1
    d.push([controllo[idx].x * w, controllo[idx].y * w, w])
  }
  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const i = k - p + j
      const den = nodi[i + p - r + 1] - nodi[i]
      const a = den === 0 ? 0 : (t - nodi[i]) / den
      d[j] = [
        (1 - a) * d[j - 1][0] + a * d[j][0],
        (1 - a) * d[j - 1][1] + a * d[j][1],
        (1 - a) * d[j - 1][2] + a * d[j][2],
      ]
    }
  }
  const w = d[p][2] || 1
  return [d[p][0] / w, d[p][1] / w]
}

/** Da lista di punti {x,y} a lista piatta [x,y,x,y,…]. */
export function piatti(punti) {
  const out = new Array(punti.length * 2)
  for (let i = 0; i < punti.length; i++) {
    out[i * 2] = punti[i].x || 0
    out[i * 2 + 1] = punti[i].y || 0
  }
  return out
}

/** Rettangolo di ingombro di una lista piatta di punti. */
export function ingombro(punti) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < punti.length; i += 2) {
    const x = punti[i]
    const y = punti[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return [minX, minY, maxX, maxY]
}

/** Unione di due rettangoli di ingombro. */
export function unisci(a, b) {
  if (!a) return b
  if (!b) return a
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ]
}

/** Matrice di trasformazione: scala, rotazione (radianti), traslazione. */
export function matrice(sx, sy, rot, tx, ty) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return [sx * c, sx * s, -sy * s, sy * c, tx, ty]
}

/** Composizione di due matrici (prima `a`, poi `b`). */
export function componi(b, a) {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ]
}

/** Applica una matrice a una lista piatta di punti, sul posto. */
export function applica(punti, m) {
  for (let i = 0; i < punti.length; i += 2) {
    const x = punti[i]
    const y = punti[i + 1]
    punti[i] = m[0] * x + m[2] * y + m[4]
    punti[i + 1] = m[1] * x + m[3] * y + m[5]
  }
  return punti
}

/** Fattore di scala medio di una matrice (serve per altezze dei testi). */
export function scalaDi(m) {
  return (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2
}

/** Rotazione complessiva di una matrice. */
export function rotazioneDi(m) {
  return Math.atan2(m[1], m[0])
}

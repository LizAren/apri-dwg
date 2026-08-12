// ============================================================================
//  Annotazioni: nuvole di revisione, frecce, testi.
//
//  🔴 Non toccano il disegno. Vivono accanto, in coordinate del disegno, e il
//  DWG di partenza resta quello che era — cosa che va detta in pagina, perché
//  è la differenza fra «annotare» e «modificare», e chi apre un CAD si aspetta
//  la seconda.
//
//  🔴 La geometria si calcola QUI, una volta sola, in coordinate del disegno.
//  Schermo, PDF e PNG la ridisegnano tutti da questa: se ognuno se la
//  ricavasse per conto suo, la nuvola stampata non sarebbe quella vista.
// ============================================================================

/** Colori delle annotazioni: pochi, e tutti leggibili su fondo chiaro e scuro. */
export const COLORI_NOTA = {
  rosso: '#e0483c',
  ambra: '#e8b93c',
  verde: '#4fae63',
  blu: '#3f7fb5',
}

import { formeSimbolo } from './simboli.js'

export const TIPI_NOTA = {
  nuvola: 'nuvola di revisione',
  freccia: 'freccia',
  testo: 'testo',
}

/**
 * Da annotazione a forme disegnabili.
 * @returns {{spezzate: number[][], testi: object[]}}
 */
export function geometriaNota(nota, altezzaTesto) {
  if (nota.tipo === 'freccia') return { spezzate: freccia(nota), testi: [] }
  if (nota.tipo === 'nuvola') return { spezzate: [nuvola(nota)], testi: [] }
  if (nota.tipo === 'simbolo') {
    // Le forme unitarie vengono portate alla misura e al posto della nota. Il
    // simbolo è ancorato in basso a sinistra, come tutto il resto.
    const h = nota.altezza || altezzaTesto
    const [x, y] = nota.punti
    const spezzate = formeSimbolo(nota.simbolo).map((f) => {
      const p = new Array(f.length)
      for (let i = 0; i < f.length; i += 2) {
        p[i] = x + f[i] * h
        p[i + 1] = y + f[i + 1] * h
      }
      return p
    })
    return { spezzate, testi: [] }
  }

  if (nota.tipo === 'testo') {
    // L'altezza è una proprietà della nota, non una costante: si trascina come
    // tutto il resto. Il valore passato serve solo alle note vecchie, che non
    // ce l'hanno.
    return {
      spezzate: [],
      testi: [{
        x: nota.punti[0], y: nota.punti[1],
        testo: nota.testo || '',
        altezza: nota.altezza || altezzaTesto,
      }],
    }
  }
  return { spezzate: [], testi: [] }
}

/**
 * Freccia: l'asta più due barbe. La punta è lunga un dodicesimo dell'asta ma
 * mai meno di un minimo, se no su una freccia corta sparisce e su una lunga
 * diventa una bandiera.
 */
function freccia(nota) {
  const [ax, ay, bx, by] = nota.punti
  const dx = bx - ax
  const dy = by - ay
  const lunga = Math.hypot(dx, dy) || 1
  const punta = Math.min(lunga * 0.28, Math.max(lunga / 12, nota.scala * 10))
  const ang = Math.atan2(dy, dx)
  const apertura = 0.42
  return [
    [ax, ay, bx, by],
    [
      bx - punta * Math.cos(ang - apertura), by - punta * Math.sin(ang - apertura),
      bx, by,
      bx - punta * Math.cos(ang + apertura), by - punta * Math.sin(ang + apertura),
    ],
  ]
}

/**
 * Nuvola di revisione: archi convessi lungo il perimetro di un rettangolo.
 * Il raggio si adatta al lato più corto, se no su un rettangolo stretto gli
 * archi si sovrappongono e viene fuori un ghirigoro.
 */
function nuvola(nota) {
  const [x0, y0, x1, y1] = nota.punti
  const sx = Math.min(x0, x1)
  const sy = Math.min(y0, y1)
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  if (dx < 1e-9 || dy < 1e-9) return []

  const raggio = Math.max(Math.min(dx, dy) / 8, Math.min(dx, dy) / 12)
  const punti = []
  const lati = [
    [sx, sy, sx + dx, sy],
    [sx + dx, sy, sx + dx, sy + dy],
    [sx + dx, sy + dy, sx, sy + dy],
    [sx, sy + dy, sx, sy],
  ]
  for (const [ax, ay, bx, by] of lati) {
    const lung = Math.hypot(bx - ax, by - ay)
    const quanti = Math.max(2, Math.round(lung / (raggio * 1.6)))
    const passo = lung / quanti
    const ux = (bx - ax) / lung
    const uy = (by - ay) / lung
    // La normale punta verso l'esterno percorrendo il perimetro in senso orario.
    const nx = uy
    const ny = -ux
    for (let i = 0; i < quanti; i++) {
      const px = ax + ux * passo * i
      const py = ay + uy * passo * i
      const qx = ax + ux * passo * (i + 1)
      const qy = ay + uy * passo * (i + 1)
      const mx = (px + qx) / 2 + nx * passo * 0.42
      const my = (py + qy) / 2 + ny * passo * 0.42
      // Un arco per gobba, approssimato con la parabola per i tre punti: a
      // questa scala è indistinguibile da un arco e costa un decimo.
      for (let t = 0; t <= 1.0001; t += 0.25) {
        const u = 1 - t
        punti.push(
          u * u * px + 2 * u * t * mx + t * t * qx,
          u * u * py + 2 * u * t * my + t * t * qy
        )
      }
    }
  }
  return punti
}

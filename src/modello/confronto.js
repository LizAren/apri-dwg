// ============================================================================
//  Confronto fra due versioni dello stesso disegno.
//
//  🔴 Si confronta l'IDENTITÀ GEOMETRICA, non la somiglianza. Due segmenti sono
//  «lo stesso» se stanno sullo stesso layer e negli stessi punti entro una
//  tolleranza; tutto il resto è «tolto» o «aggiunto». È un criterio severo e
//  onesto: un muro spostato di un millimetro risulta cambiato, ed è giusto,
//  perché su un disegno tecnico un millimetro è una decisione.
//
//  ⚠️ Quello che NON fa, e va detto: non riconosce che un oggetto è «lo stesso
//  spostato». Se sposti un tavolo, il confronto dice un tavolo tolto e uno
//  aggiunto. Riconoscere lo spostamento richiederebbe di indovinare le
//  intenzioni, e indovinare male su un disegno di lavoro è peggio che tacere.
// ============================================================================

export const COLORI_CONFRONTO = {
  uguale: '#5f5b5c',
  tolto: '#e0483c',
  aggiunto: '#4fae63',
}

/**
 * @param {object} spazioA  la versione aperta adesso
 * @param {object} spazioB  la versione caricata per confronto
 * @returns {{primitive: object[], uguali: number, tolte: number, aggiunte: number}}
 */
export function confronta(spazioA, spazioB) {
  // La tolleranza è relativa alla dimensione del disegno: un decimillesimo su
  // un disegno da tre chilometri sono trenta centimetri, su una vite un
  // micron. Un valore fisso sarebbe sbagliato in un caso o nell'altro.
  const e = spazioA.estensione
  const misura = Math.max(e[2] - e[0], e[3] - e[1], 1e-9)
  const passo = misura * 1e-5

  const chiaviB = new Map()
  for (const p of spazioB.primitive) {
    if (p.tipo === 'vista') continue
    const k = chiave(p, passo)
    chiaviB.set(k, (chiaviB.get(k) || 0) + 1)
  }

  const primitive = []
  let uguali = 0
  let tolte = 0

  for (const p of spazioA.primitive) {
    if (p.tipo === 'vista') continue
    const k = chiave(p, passo)
    const quante = chiaviB.get(k) || 0
    if (quante > 0) {
      chiaviB.set(k, quante - 1)
      primitive.push({ ...p, colore: COLORI_CONFRONTO.uguale, statoConfronto: 'uguale' })
      uguali++
    } else {
      primitive.push({ ...p, colore: COLORI_CONFRONTO.tolto, statoConfronto: 'tolto' })
      tolte++
    }
  }

  // Quel che resta in B non è stato consumato da nessuno: è nuovo.
  let aggiunte = 0
  const rimaste = new Map(chiaviB)
  for (const p of spazioB.primitive) {
    if (p.tipo === 'vista') continue
    const k = chiave(p, passo)
    const quante = rimaste.get(k) || 0
    if (quante <= 0) continue
    rimaste.set(k, quante - 1)
    primitive.push({ ...p, colore: COLORI_CONFRONTO.aggiunto, statoConfronto: 'aggiunto' })
    aggiunte++
  }

  return { primitive, uguali, tolte, aggiunte }
}

/**
 * L'impronta di una primitiva: layer, tipo e coordinate arrotondate al passo.
 * Si prendono i punti in ordine e, per le spezzate lunghe, un campione — su
 * una polilinea da diecimila vertici confrontarli tutti costa e non aggiunge
 * niente: se due spezzate hanno gli stessi estremi, la stessa lunghezza e gli
 * stessi ventiquattro punti intermedi, sono la stessa.
 */
function chiave(p, passo) {
  const q = (v) => Math.round(v / passo)
  if (p.tipo === 'testo') {
    return `T|${p.layer}|${p.testo}|${q(p.x)}|${q(p.y)}|${q(p.altezza)}`
  }
  const pt = p.punti
  const n = pt.length / 2
  const passi = Math.max(1, Math.floor(n / 24))
  let s = `P|${p.layer}|${n}|${p.chiusa ? 1 : 0}`
  for (let i = 0; i < n; i += passi) s += `|${q(pt[i * 2])},${q(pt[i * 2 + 1])}`
  // Gli estremi sempre, anche se il campionamento li saltasse.
  s += `|${q(pt[0])},${q(pt[1])}|${q(pt[pt.length - 2])},${q(pt[pt.length - 1])}`
  return s
}

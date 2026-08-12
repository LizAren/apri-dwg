// ============================================================================
//  Export in DXF.
//
//  Serve a una cosa sola: riportare il disegno dentro un altro CAD. Non è un
//  «salva con nome» del file di partenza — 🔴 è una **esportazione della
//  geometria disegnata**, e va detto: i blocchi sono già stati espansi, le
//  quote sono diventate linee e testi, i tratteggi sono solo il loro contorno.
//  Chi lo riapre trova lo stesso disegno, ma piatto. Fingere il contrario
//  farebbe perdere lavoro a qualcuno.
//
//  Si scrive un DXF in versione R2000 (AC1015): è il più vecchio che tutti
//  leggono e che accetta le polilinee leggere. Solo testo, nessuna libreria.
// ============================================================================

import { risolviInchiostro } from '../modello/colori.js'
import { geometriaNota } from '../modello/note.js'

/** Una coppia codice/valore, che è tutto ciò di cui è fatto un DXF. */
const c = (codice, valore) => `${codice}\n${valore}\n`

/**
 * @param {object} modello
 * @param {object} spazio    lo spazio da esportare
 * @param {Set<string>} layerVisibili
 * @returns {{testo: string, entita: number}}
 */
export function esportaDxf(modello, spazio, layerVisibili) {
  const usati = new Map()
  for (const l of modello.layer) usati.set(l.nome, l)

  let corpo = ''
  let entita = 0

  for (const p of spazio.primitive) {
    if (p.tipo === 'vista' || p.infinita) continue
    if (layerVisibili && !layerVisibili.has(p.layer)) continue
    const layer = p.layer || '0'

    if (p.tipo === 'testo') {
      corpo +=
        c(0, 'TEXT') + c(8, layer) + c(100, 'AcDbEntity') + c(100, 'AcDbText') +
        c(10, num(p.x)) + c(20, num(p.y)) + c(30, 0) +
        c(40, num(p.altezza)) +
        c(1, p.testo.replace(/\n/g, ' ')) +
        c(50, num((p.rotazione * 180) / Math.PI)) +
        c(72, p.allineamento || 0)
      // Il codice 11 serve solo se l'allineamento non è a sinistra, ma darlo
      // sempre non fa danno e alcuni lettori lo pretendono.
      corpo += c(11, num(p.x)) + c(21, num(p.y)) + c(31, 0)
      entita++
      continue
    }

    const punti = p.punti
    const quanti = punti.length / 2
    if (quanti < 2) continue
    corpo +=
      c(0, 'LWPOLYLINE') + c(8, layer) +
      c(100, 'AcDbEntity') + c(100, 'AcDbPolyline') +
      c(90, quanti) + c(70, p.chiusa ? 1 : 0)
    for (let i = 0; i < punti.length; i += 2) {
      corpo += c(10, num(punti[i])) + c(20, num(punti[i + 1]))
    }
    entita++
  }

  const testo =
    c(0, 'SECTION') + c(2, 'HEADER') +
    c(9, '$ACADVER') + c(1, 'AC1015') +
    c(9, '$INSUNITS') + c(70, modello.unita.codice || 0) +
    c(9, '$EXTMIN') + c(10, num(spazio.estensione[0])) + c(20, num(spazio.estensione[1])) + c(30, 0) +
    c(9, '$EXTMAX') + c(10, num(spazio.estensione[2])) + c(20, num(spazio.estensione[3])) + c(30, 0) +
    c(0, 'ENDSEC') +
    tabellaLayer([...usati.values()], layerVisibili) +
    c(0, 'SECTION') + c(2, 'ENTITIES') + corpo + c(0, 'ENDSEC') +
    c(0, 'EOF')

  return { testo, entita }
}

function tabellaLayer(layer, visibili) {
  const dentro = layer.filter((l) => !visibili || visibili.has(l.nome))
  const elenco = dentro.length ? dentro : [{ nome: '0', indiceColore: 7 }]
  let t =
    c(0, 'SECTION') + c(2, 'TABLES') +
    c(0, 'TABLE') + c(2, 'LAYER') + c(70, elenco.length)
  for (const l of elenco) {
    // L'indice di colore si riporta com'era: è così che il colore sopravvive
    // al viaggio, perché nel DXF il layer è la sua tinta.
    const ci = Math.abs(l.indiceColore ?? 7) || 7
    t += c(0, 'LAYER') + c(2, l.nome) + c(70, 0) + c(62, ci) + c(6, 'CONTINUOUS')
  }
  t += c(0, 'ENDTAB') + c(0, 'ENDSEC')
  return t
}

/** Sei decimali bastano e avanzano, e tengono il file leggibile. */
const num = (v) => (Number.isFinite(v) ? Number(v.toFixed(6)) : 0)

// ---------------------------------------------------------------------------
//  Immagine
// ---------------------------------------------------------------------------

/**
 * Disegna lo spazio in un'immagine PNG alla risoluzione richiesta.
 *
 * ⚠️ Non è una fotografia dello schermo: si ridisegna da capo su una tela
 * fuori schermo con l'inquadratura di TUTTO il disegno, se no si esporterebbe
 * anche la porzione che per caso era fuori vista.
 */
export async function esportaPng(spazio, opzioni = {}) {
  const larghezza = opzioni.larghezza || 3000
  const fondoChiaro = opzioni.fondoChiaro !== false
  const layerVisibili = opzioni.layerVisibili
  const e = spazio.estensione
  const largo = Math.max(1e-9, e[2] - e[0])
  const alto = Math.max(1e-9, e[3] - e[1])
  const altezza = Math.max(1, Math.round((larghezza * alto) / largo))

  const tela = document.createElement('canvas')
  tela.width = larghezza
  tela.height = altezza
  const ctx = tela.getContext('2d')
  ctx.fillStyle = fondoChiaro ? '#ffffff' : '#0c0f13'
  ctx.fillRect(0, 0, larghezza, altezza)

  const zoom = larghezza / largo
  const ax = (x) => (x - e[0]) * zoom
  const ay = (y) => altezza - (y - e[1]) * zoom

  const gruppi = new Map()
  const testi = []
  for (const p of spazio.primitive) {
    if (p.tipo === 'vista' || p.infinita) continue
    if (layerVisibili && !layerVisibili.has(p.layer)) continue
    if (p.tipo === 'testo') {
      testi.push(p)
      continue
    }
    const chiave = `${p.colore}|${p.pieno ? 'p' : 's'}`
    if (!gruppi.has(chiave)) gruppi.set(chiave, { colore: p.colore, pieno: p.pieno, righe: [] })
    gruppi.get(chiave).righe.push(p)
  }

  // Il tratto scala con l'immagine: a 3000 pixel una linea da 1 sarebbe un filo
  // invisibile una volta stampata.
  ctx.lineWidth = Math.max(1, larghezza / 1600)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  for (const g of gruppi.values()) {
    ctx.strokeStyle = risolviInchiostro(g.colore, fondoChiaro)
    ctx.fillStyle = ctx.strokeStyle
    ctx.beginPath()
    for (const p of g.righe) {
      const pt = p.punti
      ctx.moveTo(ax(pt[0]), ay(pt[1]))
      for (let k = 2; k < pt.length; k += 2) ctx.lineTo(ax(pt[k]), ay(pt[k + 1]))
      if (p.chiusa) ctx.closePath()
    }
    if (g.pieno) ctx.fill()
    else ctx.stroke()
  }

  // Le annotazioni, con la stessa geometria dello schermo e del PDF.
  for (const n of opzioni.note || []) {
    const { spezzate, testi: tn } = geometriaNota(n, (n.scala || 1) * 14)
    ctx.strokeStyle = n.colore
    ctx.fillStyle = n.colore
    ctx.lineWidth = Math.max(2, larghezza / 900)
    for (const punti of spezzate) {
      if (punti.length < 4) continue
      ctx.beginPath()
      ctx.moveTo(ax(punti[0]), ay(punti[1]))
      for (let k = 2; k < punti.length; k += 2) ctx.lineTo(ax(punti[k]), ay(punti[k + 1]))
      ctx.stroke()
    }
    for (const t of tn) {
      const h = Math.max(10, t.altezza * zoom)
      ctx.font = `600 ${h.toFixed(1)}px "Public Sans", system-ui, sans-serif`
      ctx.fillText(t.testo, ax(t.x), ay(t.y))
    }
  }
  ctx.lineWidth = Math.max(1, larghezza / 1600)

  ctx.textBaseline = 'alphabetic'
  for (const t of testi) {
    const h = t.altezza * zoom
    if (h < 3) continue
    ctx.fillStyle = risolviInchiostro(t.colore, fondoChiaro)
    ctx.font = `${h.toFixed(1)}px "Public Sans", system-ui, sans-serif`
    ctx.textAlign = ['left', 'center', 'right'][t.allineamento] || 'left'
    if (t.rotazione) {
      ctx.save()
      ctx.translate(ax(t.x), ay(t.y))
      ctx.rotate(-t.rotazione)
      ctx.fillText(t.testo, 0, 0)
      ctx.restore()
    } else {
      ctx.fillText(t.testo, ax(t.x), ay(t.y))
    }
  }

  return new Promise((risolvi) => tela.toBlob(risolvi, 'image/png'))
}

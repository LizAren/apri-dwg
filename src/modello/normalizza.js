// ============================================================================
//  Da «entità del file» a «cose da disegnare».
//
//  I due lettori (DWG via LibreDWG, DXF via dxf-parser) producono strutture
//  diverse; ognuno le riduce alla stessa forma intermedia (vedi lettura/) e da
//  qui in poi il programma conosce una sola grammatica.
//
//  L'uscita ha DUE sole primitive — spezzata e testo — perché tutto ciò che sta
//  a valle (schermo, PDF, misure) deve saper disegnare due cose, non trenta.
//
//  🔴 Quello che non si sa disegnare NON si butta in silenzio: si conta e
//  finisce nel rapporto di lettura. Un disegno a cui manca un pezzo senza
//  dirlo è peggio di un disegno che non si apre.
// ============================================================================

import * as g from './geometria.js'
import { coloreEntita, coloreLayer } from './colori.js'
import { leggiUnita } from './unita.js'

/** Oltre questa soglia si smette di espandere: file malato o ricorsione. */
const TETTO_PRIMITIVE = 400000
const PROFONDITA_MAX = 16

/** Tipi che sappiamo disegnare. Tutto il resto finisce nel rapporto. */
const NOTI = new Set([
  'LINE', 'LWPOLYLINE', 'POLYLINE', 'POLYLINE2D', 'POLYLINE3D', 'ARC',
  'CIRCLE', 'ELLIPSE', 'POINT', 'SPLINE', 'TEXT', 'MTEXT', 'ATTRIB',
  'ATTDEF', 'INSERT', 'DIMENSION', 'SOLID', '3DFACE', 'SEQEND', 'VERTEX',
  'HATCH', 'VIEWPORT', 'LEADER', 'MLINE', 'RAY', 'XLINE',
])

/** Perché un tipo non si disegna — testo per il rapporto. */
const MOTIVI = {
  '3DSOLID': 'solido 3D: serve un motore di modellazione, non un lettore 2D',
  REGION: 'regione 3D',
  SURFACE: 'superficie 3D',
  MESH: 'mesh 3D',
  ACAD_PROXY_ENTITY: 'oggetto di un applicativo non installato (proxy)',
  ACAD_TABLE: 'tabella AutoCAD',
  OLE2FRAME: 'oggetto incorporato da un altro programma (OLE)',
  OLEFRAME: 'oggetto incorporato da un altro programma (OLE)',
  IMAGE: 'immagine collegata',
  WIPEOUT: 'mascheratura (wipeout)',
  MULTILEADER: 'direttrice multipla',
  MTEXT_ATTRIBUTE: 'attributo testuale complesso',
  TOLERANCE: 'simbolo di tolleranza geometrica',
  SHAPE: 'forma da libreria SHX',
  BODY: 'corpo 3D',
  HELIX: 'elica',
  LIGHT: 'luce di rendering',
}

/**
 * @param {object} fonte  struttura intermedia prodotta da un lettore
 * @returns {object} modello normalizzato
 */
export function normalizza(fonte) {
  const layerPerNome = new Map(fonte.layer.map((l) => [l.nome, l]))
  const rapporto = creaRapporto(fonte)

  const spazi = []
  for (const spazio of fonte.spazi) {
    const ctx = {
      fonte,
      layerPerNome,
      rapporto,
      primitive: [],
      profondita: 0,
      troncato: false,
      inCarta: spazio.carta === true,
    }
    for (const ent of spazio.entita) {
      disegnaEntita(ent, ctx, IDENTITA, null)
    }
    const estensione = calcolaEstensione(ctx.primitive)
    spazi.push({
      id: spazio.id,
      nome: spazio.nome,
      carta: spazio.carta === true,
      primitive: ctx.primitive,
      estensione,
      troncato: ctx.troncato,
    })
    if (ctx.troncato) rapporto.troncature.push(spazio.nome)
  }

  // Le viste di modello dentro i layout si riempiono solo dopo aver
  // costruito lo spazio modello, che è la loro sorgente.
  const modello = spazi.find((s) => !s.carta)
  for (const spazio of spazi) {
    if (spazio.carta && modello) riempiViste(spazio, modello, rapporto)
  }

  const unita = leggiUnita(fonte.intestazione.INSUNITS)
  rapporto.unita = unita

  return {
    nomeFile: fonte.nomeFile,
    formato: fonte.formato,
    versione: fonte.versione,
    unita,
    layer: fonte.layer,
    spazi,
    rapporto,
  }
}

const IDENTITA = [1, 0, 0, 1, 0, 0]

/** Porta un punto del file nelle coordinate del disegno finale. */
function trasforma(p, m) {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }
}

function creaRapporto(fonte) {
  return {
    conteggi: {},
    nonDisegnati: {},
    xref: [],
    blocchiMancanti: new Set(),
    fontShx: new Set(),
    troncature: [],
    avvisi: fonte.avvisi || [],
    unita: null,
    viste: 0,
  }
}

// ---------------------------------------------------------------------------
//  Disegno di una singola entità
// ---------------------------------------------------------------------------

function disegnaEntita(ent, ctx, m, coloreEreditato) {
  if (!ent || !ent.type) return
  if (ctx.primitive.length > TETTO_PRIMITIVE) {
    ctx.troncato = true
    return
  }

  const tipo = ent.type
  ctx.rapporto.conteggi[tipo] = (ctx.rapporto.conteggi[tipo] || 0) + 1

  if (!NOTI.has(tipo)) {
    const chiave = MOTIVI[tipo] ? tipo : tipo
    ctx.rapporto.nonDisegnati[chiave] =
      (ctx.rapporto.nonDisegnati[chiave] || 0) + 1
    return
  }

  const layer = ctx.layerPerNome.get(ent.layer)
  // Un layer spento o congelato non si disegna, ma resta nell'elenco: è
  // l'utente che decide se riaccenderlo.
  const colore = coloreEntita(ent, layer, coloreEreditato)
  const spessore = spessoreDi(ent, layer)
  // 🔴 Da qui in poi la primitiva è geometria pura: se non si porta dietro DA
  // COSA viene, «proprietà al clic» può dire solo «una spezzata». Il tipo
  // dell'entità e il suo handle costano due campi e si perdono per sempre se
  // non si prendono adesso.
  const comune = {
    layer: ent.layer || '0',
    colore,
    spessore,
    origine: tipo,
    handle: ent.handle,
  }

  // 🔴 Rete di sicurezza: se un tipo che dichiariamo di saper disegnare non
  // produce NIENTE, deve finire nel rapporto lo stesso. È così che si è scoperto
  // che RAY e XLINE sparivano senza un rigo di avviso, perché il campo della
  // direzione si chiama `unitDirection` e non `unitDirectionVector`.
  const primaDi = ctx.primitive.length

  switch (tipo) {
    case 'LINE':
      aggiungiSpezzata(ctx, m, comune, [
        ent.startPoint.x, ent.startPoint.y,
        ent.endPoint.x, ent.endPoint.y,
      ], false)
      break

    case 'LWPOLYLINE':
    case 'POLYLINE':
    case 'POLYLINE2D':
    case 'POLYLINE3D': {
      const v = ent.vertices || []
      if (v.length < 2) break
      const chiusa = !!(ent.flag & 1) || ent.shape === true || ent.chiusa === true
      const punti = []
      const quota = ent.elevation || 0
      for (let i = 0; i < v.length; i++) {
        const p = v[i]
        if (i === 0) punti.push(p.x, p.y)
        const succ = v[i + 1] || (chiusa ? v[0] : null)
        if (!succ) break
        if (p.bulge) punti.push(...g.bulge(p.x, p.y, succ.x, succ.y, p.bulge))
        else punti.push(succ.x, succ.y)
      }
      void quota
      aggiungiSpezzata(ctx, m, comune, punti, chiusa)
      break
    }

    case 'ARC':
      // Il centro non è sulla geometria disegnata: se non lo si conserva qui,
      // l'aggancio al centro di un arco diventa impossibile — dopo la
      // suddivisione in spezzata quell'informazione non esiste più.
      comune.centro = trasforma(ent.center, m)
      comune.raggio = ent.radius * g.scalaDi(m)
      aggiungiSpezzata(ctx, m, comune,
        g.arco(ent.center.x, ent.center.y, ent.radius, ent.startAngle, ent.endAngle), false)
      break

    case 'CIRCLE':
      comune.centro = trasforma(ent.center, m)
      comune.raggio = ent.radius * g.scalaDi(m)
      aggiungiSpezzata(ctx, m, comune,
        g.cerchio(ent.center.x, ent.center.y, ent.radius), true)
      break

    case 'ELLIPSE':
      comune.centro = trasforma(ent.center, m)
      aggiungiSpezzata(ctx, m, comune, g.ellisse(
        ent.center.x, ent.center.y,
        ent.majorAxisEndPoint.x, ent.majorAxisEndPoint.y,
        ent.axisRatio, ent.startAngle || 0, ent.endAngle ?? Math.PI * 2), false)
      break

    case 'SPLINE':
      aggiungiSpezzata(ctx, m, comune, g.spline(
        ent.degree ?? ent.degreeOfSplineCurve,
        ent.controlPoints, ent.knots ?? ent.knotValues,
        ent.weights, ent.fitPoints), false)
      break

    case 'POINT': {
      // Un punto non ha dimensione: si segna con una crocetta minuscola, che
      // a schermo resta visibile e sul PDF non sporca.
      const p = ent.position
      aggiungiSpezzata(ctx, m, { ...comune, punto: true }, [p.x, p.y, p.x, p.y], false)
      break
    }

    case 'SOLID':
    case '3DFACE': {
      const c = ent.corner1
        ? [ent.corner1, ent.corner2, ent.corner4 || ent.corner3, ent.corner3]
        : ent.vertices || ent.points || []
      const punti = []
      for (const p of c) if (p) punti.push(p.x, p.y)
      if (punti.length >= 6) aggiungiSpezzata(ctx, m, { ...comune, pieno: true }, punti, true)
      break
    }

    case 'RAY':
    case 'XLINE': {
      // Rette infinite: si disegna un tratto lungo, ma restano ESCLUSE dal
      // calcolo dell'estensione (vedi `infinita`), altrimenti lo zoom-tutto
      // inquadra il vuoto. È il difetto che si vede in EXTMIN/EXTMAX di molti
      // file veri, dove i valori sono nell'ordine dei milioni.
      const p = ent.firstPoint || ent.startPoint || ent.position
      const d = ent.unitDirection || ent.unitDirectionVector || ent.direction
      if (!p || !d) break
      const L = 1e6
      const punti = ent.type === 'RAY'
        ? [p.x, p.y, p.x + d.x * L, p.y + d.y * L]
        : [p.x - d.x * L, p.y - d.y * L, p.x + d.x * L, p.y + d.y * L]
      aggiungiSpezzata(ctx, m, { ...comune, infinita: true }, punti, false)
      break
    }

    case 'TEXT':
    case 'ATTRIB':
    case 'ATTDEF': {
      // ⚠️ In un TEXT i campi stanno in superficie; in un ATTRIB/ATTDEF sono
      // annidati sotto `text`. Trattarli allo stesso modo scrive «[object
      // Object]» sul disegno, alto quanto il testo vero.
      const t = typeof ent.text === 'object' && ent.text ? ent.text : ent
      const contenuto = typeof ent.text === 'object' ? ent.text.text : ent.text
      const p = t.startPoint || t.position || ent.startPoint || ent.position
      if (!p || !contenuto) break
      aggiungiTesto(ctx, m, comune, {
        testo: pulisciTesto(contenuto),
        x: p.x, y: p.y,
        altezza: t.textHeight || 1,
        rotazione: t.rotation || 0,
        allineamento: t.halign || 0,
        verticale: t.valign || 0,
      })
      break
    }

    case 'MTEXT': {
      const p = ent.insertionPoint || ent.position
      if (!p || !ent.text) break
      const righe = pulisciTesto(ent.text).split('\n')
      const h = ent.textHeight || ent.height || 1
      const rot = ent.rotation || 0
      for (let i = 0; i < righe.length; i++) {
        if (!righe[i]) continue
        // Le righe scendono perpendicolarmente alla direzione del testo.
        const dx = Math.sin(rot) * h * 1.4 * i
        const dy = -Math.cos(rot) * h * 1.4 * i
        aggiungiTesto(ctx, m, comune, {
          testo: righe[i],
          x: p.x + dx, y: p.y + dy,
          altezza: h,
          rotazione: rot,
          allineamento: allineamentoMTesto(ent.attachmentPoint),
          verticale: verticaleMTesto(ent.attachmentPoint),
        })
      }
      break
    }

    case 'HATCH': {
      // I motivi di riempimento non si disegnano: si traccia il CONTORNO, che
      // è l'informazione geometrica vera. Dichiarato nel rapporto.
      ctx.rapporto.nonDisegnati['HATCH (solo contorno)'] =
        (ctx.rapporto.nonDisegnati['HATCH (solo contorno)'] || 0) + 1
      for (const perc of ent.boundaryPaths || []) {
        const punti = puntiContorno(perc)
        if (punti.length >= 4) aggiungiSpezzata(ctx, m, comune, punti, true)
      }
      break
    }

    case 'LEADER': {
      const v = ent.vertices || []
      const punti = []
      for (const p of v) punti.push(p.x, p.y)
      if (punti.length >= 4) aggiungiSpezzata(ctx, m, comune, punti, false)
      break
    }

    case 'MLINE': {
      for (const linea of ent.vertices || []) {
        const punti = []
        for (const p of linea.points || []) punti.push(p.x, p.y)
        if (punti.length >= 4) aggiungiSpezzata(ctx, m, comune, punti, false)
      }
      break
    }

    case 'DIMENSION': {
      // 🔴 Una quota non si ridisegna a mano: il file contiene già un blocco
      // anonimo con linee, frecce e testo esattamente come li ha messi il CAD.
      // Ridisegnarla significherebbe reinventare lo stile di quotatura e
      // sbagliarlo.
      const nome = ent.name || ent.block
      if (nome) disegnaBlocco(nome, ctx, m, comune.colore)
      break
    }

    case 'INSERT': {
      const nome = ent.name
      const px = ent.insertionPoint || ent.position
      if (!nome || !px) break
      const righe = Math.max(1, ent.rowCount || 1)
      const colonne = Math.max(1, ent.columnCount || 1)
      const passoR = ent.rowSpacing || 0
      const passoC = ent.columnSpacing || 0
      for (let r = 0; r < righe; r++) {
        for (let c = 0; c < colonne; c++) {
          const mm = g.componi(m, g.matrice(
            ent.xScale || 1, ent.yScale || 1, ent.rotation || 0,
            px.x + c * passoC, px.y + r * passoR))
          disegnaBlocco(nome, ctx, mm, comune.colore)
        }
      }
      for (const a of ent.attribs || []) disegnaEntita(a, ctx, m, comune.colore)
      break
    }

    case 'VIEWPORT':
      // ⚠️ Anche lo spazio modello contiene un VIEWPORT — è la finestra attiva
      // del CAD, non una vista da disegnare. Se lo si tratta come le altre,
      // nello spazio modello compare una cornice che nel disegno non esiste.
      if (!ctx.inCarta) break
      // Le viste si trattano dopo, quando lo spazio modello esiste.
      if (ent.width > 0 && ent.height > 0 && ent.viewHeight > 0) {
        ctx.primitive.push({
          tipo: 'vista',
          layer: comune.layer,
          colore: comune.colore,
          spessore: comune.spessore,
          centro: ent.viewportCenter,
          larghezza: ent.width,
          altezza: ent.height,
          vistaCentro: ent.displayCenter || ent.targetPoint || { x: 0, y: 0 },
          vistaAltezza: ent.viewHeight,
          torsione: ent.viewTwistAngle || 0,
          ingombro: [
            ent.viewportCenter.x - ent.width / 2,
            ent.viewportCenter.y - ent.height / 2,
            ent.viewportCenter.x + ent.width / 2,
            ent.viewportCenter.y + ent.height / 2,
          ],
        })
        ctx.rapporto.viste++
      }
      break

    default:
      break
  }

  // I tipi qui sotto non producono geometria propria per costruzione: o la
  // delegano a un blocco, o sono voci di servizio del formato.
  const DELEGANTI = new Set(['INSERT', 'DIMENSION', 'VIEWPORT', 'SEQEND', 'VERTEX'])
  if (ctx.primitive.length === primaDi && !DELEGANTI.has(tipo)) {
    const voce = `${tipo} (letta ma senza geometria)`
    ctx.rapporto.nonDisegnati[voce] = (ctx.rapporto.nonDisegnati[voce] || 0) + 1
  }
}

function disegnaBlocco(nome, ctx, m, coloreEreditato) {
  const blocco = ctx.fonte.blocchi[nome]
  if (!blocco) {
    ctx.rapporto.blocchiMancanti.add(nome)
    return
  }
  if (blocco.xref) {
    // Un riferimento esterno non è nel file: il disegno che manca va DETTO.
    if (!ctx.rapporto.xref.some((x) => x.nome === nome)) {
      ctx.rapporto.xref.push({ nome, percorso: blocco.percorso || '—' })
    }
    return
  }
  if (ctx.profondita >= PROFONDITA_MAX) return
  ctx.profondita++
  const base = blocco.base || { x: 0, y: 0 }
  const mm = g.componi(m, [1, 0, 0, 1, -base.x, -base.y])
  for (const ent of blocco.entita || []) disegnaEntita(ent, ctx, mm, coloreEreditato)
  ctx.profondita--
}

// ---------------------------------------------------------------------------
//  Primitive
// ---------------------------------------------------------------------------

function aggiungiSpezzata(ctx, m, comune, punti, chiusa) {
  if (!punti || punti.length < 4) return
  const p = m === IDENTITA ? punti.slice() : g.applica(punti.slice(), m)
  ctx.primitive.push({
    tipo: 'spezzata',
    punti: p,
    chiusa,
    layer: comune.layer,
    colore: comune.colore,
    spessore: comune.spessore,
    origine: comune.origine,
    handle: comune.handle,
    centro: comune.centro,
    raggio: comune.raggio,
    pieno: comune.pieno === true,
    punto: comune.punto === true,
    infinita: comune.infinita === true,
    ingombro: g.ingombro(p),
  })
}

function aggiungiTesto(ctx, m, comune, t) {
  const [x, y] = [
    m[0] * t.x + m[2] * t.y + m[4],
    m[1] * t.x + m[3] * t.y + m[5],
  ]
  const scala = g.scalaDi(m)
  const altezza = t.altezza * scala
  const rotazione = t.rotazione + g.rotazioneDi(m)
  // Ingombro stimato: 0,6 di larghezza media per carattere. Serve solo a
  // scartare i testi fuori schermo, non a impaginare.
  const larghezza = t.testo.length * altezza * 0.6
  ctx.primitive.push({
    tipo: 'testo',
    testo: t.testo,
    x, y,
    altezza,
    rotazione,
    allineamento: t.allineamento,
    verticale: t.verticale,
    layer: comune.layer,
    colore: comune.colore,
    spessore: comune.spessore,
    origine: comune.origine,
    handle: comune.handle,
    ingombro: [
      x - larghezza, y - altezza * 1.5,
      x + larghezza, y + altezza * 1.5,
    ],
  })
}

// ---------------------------------------------------------------------------
//  Viste di modello dentro i layout
// ---------------------------------------------------------------------------

/**
 * Un layout senza il contenuto delle sue viste è una cornice vuota: è proprio
 * la tavola col cartiglio che l'utente vuole stampare. Qui il modello viene
 * portato dentro il rettangolo della vista, ritagliato ai suoi bordi.
 */
function riempiViste(spazio, modello, rapporto) {
  const viste = spazio.primitive.filter((p) => p.tipo === 'vista')
  if (!viste.length) return
  const aggiunte = []
  for (const v of viste) {
    const scala = v.altezza / v.vistaAltezza
    const m = g.componi(
      g.matrice(scala, scala, -(v.torsione || 0), v.centro.x, v.centro.y),
      [1, 0, 0, 1, -v.vistaCentro.x, -v.vistaCentro.y]
    )
    const rett = v.ingombro
    for (const p of modello.primitive) {
      if (p.tipo === 'spezzata') {
        const punti = g.applica(p.punti.slice(), m)
        for (const pezzo of ritaglia(punti, rett)) {
          aggiunte.push({ ...p, punti: pezzo, ingombro: g.ingombro(pezzo), inVista: true })
        }
      } else if (p.tipo === 'testo') {
        const x = m[0] * p.x + m[2] * p.y + m[4]
        const y = m[1] * p.x + m[3] * p.y + m[5]
        if (x < rett[0] || x > rett[2] || y < rett[1] || y > rett[3]) continue
        aggiunte.push({
          ...p, x, y,
          altezza: p.altezza * scala,
          ingombro: [x - 1, y - 1, x + 1, y + 1],
          inVista: true,
        })
      }
    }
  }
  spazio.primitive.push(...aggiunte)
  spazio.estensione = calcolaEstensione(spazio.primitive)
  void rapporto
}

/**
 * Ritaglio di una spezzata dentro un rettangolo (Liang-Barsky, segmento per
 * segmento). Restituisce i tratti sopravvissuti.
 */
function ritaglia(punti, r) {
  const fuori = []
  let corrente = null
  for (let i = 0; i < punti.length - 2; i += 2) {
    const t = clipSegmento(punti[i], punti[i + 1], punti[i + 2], punti[i + 3], r)
    if (!t) {
      corrente = null
      continue
    }
    if (corrente && vicini(corrente[corrente.length - 2], corrente[corrente.length - 1], t[0], t[1])) {
      corrente.push(t[2], t[3])
    } else {
      corrente = [t[0], t[1], t[2], t[3]]
      fuori.push(corrente)
    }
  }
  return fuori
}

const vicini = (ax, ay, bx, by) => Math.abs(ax - bx) < 1e-9 && Math.abs(ay - by) < 1e-9

function clipSegmento(x0, y0, x1, y1, r) {
  let t0 = 0
  let t1 = 1
  const dx = x1 - x0
  const dy = y1 - y0
  const prove = [
    [-dx, x0 - r[0]], [dx, r[2] - x0],
    [-dy, y0 - r[1]], [dy, r[3] - y0],
  ]
  for (const [p, q] of prove) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return null
      if (t > t0) t0 = t
    } else {
      if (t < t0) return null
      if (t < t1) t1 = t
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy]
}

// ---------------------------------------------------------------------------
//  Utilità
// ---------------------------------------------------------------------------

/**
 * 🔴 L'estensione si calcola sulla geometria vera, ESCLUSE le rette infinite.
 * Nei file reali EXTMIN/EXTMAX dell'intestazione sono spesso sporchi — nel file
 * di prova example_2018 valgono ±2,6 milioni per via di un XLINE — e fidarsene
 * significa aprire il disegno inquadrato sul nulla.
 */
export function calcolaEstensione(primitive) {
  let e = null
  for (const p of primitive) {
    if (p.infinita) continue
    e = g.unisci(e, p.ingombro)
  }
  if (!e || !isFinite(e[0])) return [0, 0, 100, 100]
  if (e[2] - e[0] < 1e-9) { e[0] -= 1; e[2] += 1 }
  if (e[3] - e[1] < 1e-9) { e[1] -= 1; e[3] += 1 }
  return e
}

/** Spessore in millimetri: il DWG lo esprime in centesimi. */
function spessoreDi(ent, layer) {
  let lw = ent.lineweight
  if (lw == null || lw < 0) lw = layer ? layer.spessore : -1
  if (lw == null || lw < 0) return 0 // «sottile»: si disegna al minimo
  return lw / 100
}

/** Contorno di un tratteggio: percorsi a polilinea o a spigoli. */
function puntiContorno(perc) {
  const punti = []
  if (perc.vertices) {
    const v = perc.vertices
    for (let i = 0; i < v.length; i++) {
      const p = v[i]
      if (i === 0) punti.push(p.x, p.y)
      const succ = v[i + 1] || (perc.isClosed ? v[0] : null)
      if (!succ) break
      if (p.bulge) punti.push(...g.bulge(p.x, p.y, succ.x, succ.y, p.bulge))
      else punti.push(succ.x, succ.y)
    }
    return punti
  }
  for (const e of perc.edges || []) {
    if (e.start && e.end) punti.push(e.start.x, e.start.y, e.end.x, e.end.y)
    else if (e.center && e.radius != null) {
      punti.push(...g.arco(e.center.x, e.center.y, e.radius,
        e.startAngle || 0, e.endAngle ?? Math.PI * 2))
    }
  }
  return punti
}

/**
 * Toglie dai testi i codici di formattazione MTEXT, che altrimenti compaiono
 * a schermo come spazzatura: `\P` è un a capo, `%%d` un grado, e le graffe
 * racchiudono cambi di font che qui non sappiamo applicare.
 */
export function pulisciTesto(t) {
  if (!t) return ''
  return String(t)
    .replace(/\\P/g, '\n')
    .replace(/\\[A-Za-z]\d*(\.\d+)?[;]?/g, '')
    .replace(/[{}]/g, '')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[pP]/g, '±')
    .replace(/%%%/g, '%')
    .trim()
}

const allineamentoMTesto = (a) => (a ? [0, 0, 1, 2, 0, 1, 2, 0, 1, 2][a] ?? 0 : 0)
const verticaleMTesto = (a) => (a ? [0, 3, 3, 3, 2, 2, 2, 1, 1, 1][a] ?? 0 : 0)

/** Riepilogo leggibile del rapporto, pronto per l'interfaccia. */
export function rapportoLeggibile(modello) {
  const r = modello.rapporto
  const voci = []
  const totale = Object.values(r.conteggi).reduce((a, b) => a + b, 0)

  voci.push({ chiave: 'Formato', valore: `${modello.formato} ${modello.versione || ''}`.trim() })
  voci.push({
    chiave: 'Unità del disegno',
    valore: modello.unita.dichiarate
      ? modello.unita.nome
      : '⚠ non dichiarate — la scala di stampa va confermata a mano',
    avviso: !modello.unita.dichiarate,
  })
  voci.push({ chiave: 'Entità lette', valore: String(totale) })
  voci.push({ chiave: 'Layer', valore: String(modello.layer.length) })
  voci.push({ chiave: 'Spazi', valore: modello.spazi.map((s) => s.nome).join(', ') })
  if (r.viste) voci.push({ chiave: 'Viste di modello nei layout', valore: String(r.viste) })

  const nd = Object.entries(r.nonDisegnati)
  if (nd.length) {
    voci.push({
      chiave: 'Non disegnate',
      valore: nd.map(([t, n]) => `${n}× ${MOTIVI[t] ? `${t} (${MOTIVI[t]})` : t}`).join(' · '),
      avviso: true,
    })
  }
  if (r.xref.length) {
    voci.push({
      chiave: 'Riferimenti esterni non risolti',
      valore: r.xref.map((x) => x.nome).join(', ') + ' — il file collegato non è dentro il disegno',
      avviso: true,
    })
  }
  if (r.blocchiMancanti.size) {
    voci.push({
      chiave: 'Blocchi mancanti',
      valore: [...r.blocchiMancanti].join(', '),
      avviso: true,
    })
  }
  if (r.fontShx.size) {
    voci.push({
      chiave: 'Font SHX sostituiti',
      valore: [...r.fontShx].join(', ') + ' — i caratteri non sono quelli del CAD',
      avviso: true,
    })
  }
  if (r.troncature.length) {
    voci.push({
      chiave: 'Disegno troncato',
      valore: `${r.troncature.join(', ')}: superato il tetto di ${TETTO_PRIMITIVE.toLocaleString('it-IT')} elementi`,
      avviso: true,
    })
  }
  for (const a of r.avvisi) voci.push({ chiave: 'Avviso del lettore', valore: a, avviso: true })

  return voci
}

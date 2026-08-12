// ============================================================================
//  Lettura DXF.
//
//  Il DXF è testo: non serve WebAssembly, si legge con una libreria minuscola.
//  Chi apre un DXF non scarica mai i 9,5 MB di LibreDWG.
//
//  🔴 Qui sta l'unica differenza pericolosa fra i due lettori: dxf-parser
//  restituisce le rotazioni di TEXT, MTEXT e INSERT in GRADI, mentre LibreDWG
//  le dà in radianti. Se la conversione non avvenisse qui, ogni testo del DXF
//  uscirebbe ruotato di un fattore 57. La differenza si assorbe in questo file
//  e da qui in poi il resto del programma conosce solo i radianti.
// ============================================================================

const GRADI = Math.PI / 180

export async function leggiDxf(testo, nomeFile) {
  const { default: DxfParser } = await import('dxf-parser')
  const parser = new DxfParser()
  let dxf
  try {
    dxf = parser.parseSync(testo)
  } catch (e) {
    throw new Error('Questo DXF non è leggibile: ' + e.message)
  }
  if (!dxf) throw new Error('Questo DXF non è leggibile.')

  const layerGrezzi = dxf.tables?.layer?.layers || {}
  const layer = Object.values(layerGrezzi).map((l) => ({
    nome: l.name,
    indiceColore: l.colorIndex,
    colore: l.color,
    spento: l.visible === false,
    congelato: !!l.frozen,
    spessore: l.lineweight,
    visibile: l.visible !== false && !l.frozen,
  }))
  if (!layer.length) layer.push({ nome: '0', indiceColore: 7, visibile: true })

  const blocchi = {}
  for (const [nome, b] of Object.entries(dxf.blocks || {})) {
    blocchi[nome] = {
      entita: (b.entities || []).map(adatta),
      base: b.position,
      xref: !!b.xrefPath,
      percorso: b.xrefPath,
    }
  }

  // dxf-parser non distingue i layout: le entità di carta portano un flag.
  const tutte = (dxf.entities || []).map(adatta)
  const modello = tutte.filter((e) => !e.isInPaperSpace)
  const carta = tutte.filter((e) => e.isInPaperSpace)

  const spazi = [{ id: 'modello', nome: 'Modello', carta: false, entita: modello }]
  if (carta.length) {
    spazi.push({ id: 'carta', nome: 'Layout', carta: true, entita: carta })
  }

  const avvisi = []
  if (!dxf.tables?.layer) avvisi.push('il file non contiene la tabella dei layer')

  return {
    nomeFile,
    formato: 'DXF',
    versione: dxf.header?.$ACADVER || '',
    intestazione: {
      INSUNITS: dxf.header?.$INSUNITS,
      ...dxf.header,
    },
    layer,
    stili: [],
    blocchi,
    spazi,
    avvisi,
  }
}

/**
 * Porta un'entità di dxf-parser alla stessa forma di LibreDWG.
 * Si tocca solo ciò che è davvero diverso: nomi di campo e unità degli angoli.
 */
function adatta(e) {
  const a = { ...e }
  a.isInPaperSpace = !!e.inPaperSpace

  switch (e.type) {
    case 'LINE':
      a.startPoint = e.vertices?.[0]
      a.endPoint = e.vertices?.[1]
      break

    case 'LWPOLYLINE':
    case 'POLYLINE':
      a.flag = e.shape ? 1 : 0
      a.chiusa = !!e.shape
      break

    case 'TEXT':
    case 'ATTDEF':
    case 'ATTRIB':
      a.rotation = (e.rotation || 0) * GRADI
      break

    case 'MTEXT':
      a.insertionPoint = e.position
      a.textHeight = e.height
      a.rotation = (e.rotation || 0) * GRADI
      break

    case 'INSERT':
      a.insertionPoint = e.position
      a.rotation = (e.rotation || 0) * GRADI
      a.xScale = e.xScale ?? 1
      a.yScale = e.yScale ?? 1
      break

    case 'SPLINE':
      a.degree = e.degreeOfSplineCurve
      a.knots = e.knotValues
      break

    case 'DIMENSION':
      a.name = e.block
      break

    case 'SOLID':
    case '3DFACE':
      a.vertices = e.points || e.vertices
      break

    default:
      break
  }
  return a
}

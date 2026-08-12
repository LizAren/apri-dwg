// ============================================================================
//  Lettura DWG: LibreDWG compilato in WebAssembly.
//
//  🔴 Il modulo pesa 9,5 MB (2,3 MB compressi) e viene caricato SOLO quando si
//  apre davvero un DWG: chi arriva sulla pagina, o apre un DXF, non lo scarica.
//  Per questo l'import è dinamico e non in cima al file.
//
//  🔴 LibreDWG restituisce un codice di errore a bit: sotto 128 sono AVVISI e
//  il disegno si legge lo stesso (nel file di prova example_2018 vale 68, cioè
//  «classe non gestita» + «valore fuori scala», e il disegno è corretto).
//  Trattarlo come un fallimento vorrebbe dire rifiutare file perfettamente
//  leggibili; ignorarlo del tutto vorrebbe dire non dire all'utente che una
//  parte del suo disegno potrebbe mancare. Si legge, e si scrive nel rapporto.
// ============================================================================

/** Bit di errore di LibreDWG, con la traduzione che finisce nel rapporto. */
const AVVISI = [
  [1, 'controllo di integrità (CRC) fallito su una parte del file'],
  [2, 'il file usa funzioni non ancora supportate dal lettore'],
  [4, 'una o più classi di oggetti non sono gestite'],
  [8, 'tipo di dato non valido incontrato nel file'],
  [16, 'riferimento interno non valido'],
  [32, 'dati estesi (EED) non validi'],
  [64, 'valore numerico fuori dai limiti attesi'],
]
const CRITICI = [
  [128, 'tabella delle classi non trovata'],
  [256, 'sezione del file non trovata'],
  [512, 'pagina del file non trovata'],
  [1024, 'errore interno del lettore'],
  [2048, 'file DWG non valido'],
  [4096, 'errore di lettura'],
  [8192, 'memoria esaurita'],
]

let modulo = null

/**
 * Carica LibreDWG una volta sola. Restituisce l'istanza.
 *
 * ⚠️ Non si passa nessun percorso di proposito. Il codice di collegamento del
 * modulo cerca il file con `new URL('libredwg-web.wasm', import.meta.url)`, che
 * il compilatore riscrive nell'indirizzo definitivo con l'impronta nel nome —
 * quindi la cache del browser lo può tenere per sempre. Passando un percorso a
 * mano si finisce per pubblicarne DUE copie, e sono 9,5 MB l'una su un hosting
 * che ne ha 200 in tutto: è successo, ed è per questo che c'è scritto.
 */
async function carica(seProgresso) {
  if (modulo) return modulo
  seProgresso?.('Carico il lettore DWG (2,3 MB, solo la prima volta)…')
  const { LibreDwg } = await import('@mlightcad/libredwg-web')
  modulo = await LibreDwg.create()
  return modulo
}

/** Come sopra, ma per l'uso da riga di comando (verifica), dove non c'è DOM. */
export async function caricaConPercorso(percorso) {
  if (modulo) return modulo
  const { LibreDwg } = await import('@mlightcad/libredwg-web')
  modulo = await LibreDwg.create(percorso)
  return modulo
}

/**
 * @param {ArrayBuffer} contenuto
 * @returns {object} struttura intermedia comune ai due lettori
 */
export async function leggiDwg(contenuto, nomeFile, seProgresso) {
  const lib = await carica(seProgresso)
  seProgresso?.('Interpreto il disegno…')

  // ⚠️ La versione si legge dalla SIGLA del file, non dall'intestazione:
  // l'intestazione convertita non porta `ACADVER`, e il risultato era che
  // l'utente vedeva scritto «DWG» e basta, senza sapere di che anno fosse il
  // formato che stava aprendo.
  const sigla = String.fromCharCode(...new Uint8Array(contenuto.slice(0, 6)))

  const bytes = new Uint8Array(contenuto)
  const nomeTmp = 'apri.dwg'
  const fs = lib.wasmInstance.FS
  let puntatore = null
  let codice = 0
  try {
    fs.writeFile(nomeTmp, bytes)
    const esito = lib.wasmInstance.dwg_read_file(nomeTmp)
    codice = esito.error || 0
    puntatore = esito.data
  } finally {
    try {
      if (fs.analyzePath(nomeTmp, false).exists) fs.unlink(nomeTmp)
    } catch {
      /* il file temporaneo può già non esserci */
    }
  }

  const critico = CRITICI.filter(([bit]) => codice & bit)
  if (critico.length || !puntatore) {
    if (puntatore) lib.dwg_free(puntatore)
    throw new Error(
      'Questo DWG non è leggibile: ' + (critico.map(([, t]) => t).join('; ') || 'file non riconosciuto') + '.'
    )
  }

  const { database: db, stats } = lib.convertEx(puntatore)
  lib.dwg_free(puntatore)

  const avvisi = AVVISI.filter(([bit]) => codice & bit).map(([, t]) => t)
  if (stats?.unknownEntityCount) {
    avvisi.push(`${stats.unknownEntityCount} entità non riconosciute dal lettore`)
  }

  return componi(db, nomeFile, avvisi, sigla)
}

/** Da DwgDatabase alla struttura intermedia. */
function componi(db, nomeFile, avvisi, sigla) {
  const layer = (db.tables?.LAYER?.entries || []).map((l) => ({
    nome: l.name,
    indiceColore: l.colorIndex,
    colore: l.color,
    spento: !!l.off,
    congelato: !!l.frozen,
    bloccato: !!l.locked,
    spessore: l.lineweight,
    visibile: !l.off && !l.frozen,
  }))
  if (!layer.length) layer.push({ nome: '0', indiceColore: 7, visibile: true })

  const blocchi = {}
  const perHandle = new Map()
  for (const b of db.tables?.BLOCK_RECORD?.entries || []) {
    perHandle.set(b.handle, b)
    blocchi[b.name] = {
      entita: b.entities || [],
      base: b.basePoint,
      // bit 4 = riferimento esterno, bit 16 = dipendente da un esterno
      xref: !!(b.flags & 4) || !!(b.flags & 16),
      percorso: b.xrefPath,
    }
  }

  // Spazio modello + un layout per ogni tavola di carta.
  const spazi = [{ id: 'modello', nome: 'Modello', carta: false, entita: db.entities || [] }]
  for (const l of db.objects?.LAYOUT || []) {
    if (/^model$/i.test(l.layoutName)) continue
    const br = perHandle.get(l.paperSpaceTableId)
    const entita = br?.entities || []
    spazi.push({
      id: l.handle || l.layoutName,
      nome: l.layoutName,
      carta: true,
      entita,
    })
  }

  const stili = (db.tables?.STYLE?.entries || []).map((s) => ({
    nome: s.name,
    font: s.fontFileName || s.font || s.bigFontFileName || '',
  }))

  return {
    nomeFile,
    formato: 'DWG',
    versione: versioneLeggibile(sigla, db.header),
    intestazione: db.header || {},
    layer,
    stili,
    blocchi,
    spazi,
    avvisi,
    miniatura: db.thumbnailImage,
  }
}

function versioneLeggibile(sigla, header) {
  const codice = sigla || header?.ACADVER || header?.VERSION
  const mappa = {
    AC1012: 'r13', AC1014: 'r14', AC1015: 'r2000', AC1018: 'r2004',
    AC1021: 'r2007', AC1024: 'r2010', AC1027: 'r2013', AC1032: 'r2018',
  }
  return mappa[codice] || (codice ? String(codice) : '')
}

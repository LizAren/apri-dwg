// ============================================================================
//  Apertura: riconosce il formato e instrada al lettore giusto.
//
//  Il formato NON si decide dall'estensione del nome — che chiunque può
//  scrivere sbagliata — ma dai primi byte: un DWG comincia sempre con la sigla
//  "AC" seguita da quattro cifre di versione. Tutto il resto viene provato
//  come DXF.
//
//  🔴 Il file non viene caricato da nessuna parte: `File` → `ArrayBuffer` →
//  lettore, tutto dentro il browser. È il motivo per cui questa sezione può
//  stare su un hosting gratuito, ed è anche l'unica cosa che i concorrenti
//  gratuiti non offrono.
// ============================================================================

import { normalizza } from '../modello/normalizza.js'

const VERSIONI_DWG = new Set([
  'AC1006', 'AC1009', 'AC1012', 'AC1014', 'AC1015',
  'AC1018', 'AC1021', 'AC1024', 'AC1027', 'AC1032',
])

export function riconosci(contenuto) {
  const testa = new Uint8Array(contenuto.slice(0, 6))
  const sigla = String.fromCharCode(...testa)
  if (/^AC\d{4}$/.test(sigla)) {
    return { formato: 'DWG', sigla, supportato: VERSIONI_DWG.has(sigla) }
  }
  return { formato: 'DXF', sigla: null, supportato: true }
}

/**
 * @param {File} file
 * @param {(messaggio: string) => void} seProgresso
 * @returns {Promise<object>} modello normalizzato
 */
export async function apriFile(file, seProgresso) {
  const contenuto = await file.arrayBuffer()
  const tipo = riconosci(contenuto)

  let fonte
  if (tipo.formato === 'DWG') {
    if (!tipo.supportato) {
      throw new Error(
        `Questo DWG dichiara la versione ${tipo.sigla}, che il lettore non conosce. ` +
        'Si leggono le versioni da r13 (1994) a r2018.'
      )
    }
    const { leggiDwg } = await import('./dwg.js')
    fonte = await leggiDwg(contenuto, file.name, seProgresso)
  } else {
    seProgresso?.('Interpreto il disegno…')
    const testo = new TextDecoder('utf-8', { fatal: false }).decode(contenuto)
    if (!/\bSECTION\b/.test(testo.slice(0, 4096)) && !/^\s*0\s/.test(testo)) {
      throw new Error(
        'Questo file non sembra né un DWG né un DXF. ' +
        'Si aprono disegni DWG (r13-r2018) e DXF.'
      )
    }
    const { leggiDxf } = await import('./dxf.js')
    fonte = await leggiDxf(testo, file.name)
  }

  seProgresso?.('Preparo il disegno…')
  const modello = normalizza(fonte)

  // I font SHX si scoprono qui, dove si conoscono gli stili usati.
  for (const s of fonte.stili || []) {
    if (s.font && /\.shx$/i.test(s.font)) modello.rapporto.fontShx.add(s.font)
  }
  return modello
}

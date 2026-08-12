// ============================================================================
//  Prepara la copia compressa del .wasm.
//
//  🔴 Perché serve: Altervista comprime il JavaScript ma NON il WebAssembly, e
//  non basta chiederglielo — misurato sul sito vero, con
//  `AddOutputFilterByType DEFLATE application/wasm` in `.htaccess` il file
//  continuava ad arrivare da 9.960.337 byte, mentre la regola di cache dello
//  stesso file veniva applicata (quindi `.htaccess` era letto: è mod_deflate a
//  non toccarlo).
//
//  Allora la compressione la si fa qui, una volta sola, in fase di
//  pubblicazione: si carica anche `nome.wasm.gz` e `.htaccess` lo serve al
//  posto dell'originale a chi accetta gzip. Costo per il server: zero.
//  Se la regola non scattasse, il browser riceve il `.wasm` normale e funziona
//  lo stesso — solo più lento.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { gzipSync, constants } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '../dist')

function* tutti(cartella) {
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, voce.name)
    if (voce.isDirectory()) yield* tutti(percorso)
    else yield percorso
  }
}

let fatti = 0
for (const file of tutti(DIST)) {
  if (!file.endsWith('.wasm')) continue
  const dati = readFileSync(file)
  const compresso = gzipSync(dati, { level: constants.Z_BEST_COMPRESSION })
  writeFileSync(file + '.gz', compresso)
  fatti++
  const prima = statSync(file).size
  console.log(
    `  ${file.replace(DIST + '/', '')}: ` +
    `${(prima / 1048576).toFixed(1)} MB → ${(compresso.length / 1048576).toFixed(2)} MB ` +
    `(${((1 - compresso.length / prima) * 100).toFixed(0)}% in meno)`
  )
}
if (!fatti) console.log('  nessun .wasm da comprimere')

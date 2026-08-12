// ============================================================================
//  Verifica: misura la catena di lettura sui file veri, da riga di comando.
//
//  Non è un test di unità: apre i DWG di prova, li normalizza, genera il PDF e
//  MISURA il risultato. Serve a rispondere a una domanda sola — «quello che
//  esce è un disegno o è spazzatura?» — senza dover aprire il browser.
//
//  Uso:  npm run verifica
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { caricaConPercorso, leggiDwg } from '../src/lettura/dwg.js'
import { leggiDxf } from '../src/lettura/dxf.js'
import { normalizza, calcolaEstensione } from '../src/modello/normalizza.js'
import { esportaPdf, esportaPdfMultiplo, eNormalizzata } from '../src/esporta/pdf.js'
import { esportaDxf } from '../src/esporta/dxf.js'

const QUI = dirname(fileURLToPath(import.meta.url))
const RADICE = join(QUI, '..')
const FILE = join(RADICE, 'prove/file')
const USCITA = join(RADICE, 'prove/uscita')

const esiti = []
function controlla(nome, condizione, dettaglio = '') {
  esiti.push({ nome, ok: !!condizione, dettaglio })
}

// jsPDF in Node ha bisogno di un paio di appigli del browser che non usa
// davvero: si tappano qui, non nel codice dell'applicazione.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis
  globalThis.btoa ??= (s) => Buffer.from(s, 'binary').toString('base64')
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary')
}

await caricaConPercorso(join(RADICE, 'node_modules/@mlightcad/libredwg-web/wasm/'))
mkdirSync(USCITA, { recursive: true })

const elenco = readdirSync(FILE).filter((f) => /\.(dwg|dxf)$/i.test(f))
if (!elenco.length) {
  console.error('❌ Nessun file di prova in prove/file/')
  process.exit(1)
}

console.log(`\nVerifica su ${elenco.length} file di prova\n${'─'.repeat(70)}`)

// ---------------------------------------------------------------------------
//  Controllo deterministico dell'estensione.
//
//  Nei quattro DWG di prova le rette infinite cadono DENTRO l'ingombro del
//  disegno, quindi confrontare le due estensioni non dimostrerebbe niente: il
//  controllo passerebbe anche con la regola disattivata. Qui la situazione è
//  costruita, quindi la risposta è nota.
// ---------------------------------------------------------------------------
{
  const finte = [
    { tipo: 'spezzata', infinita: false, ingombro: [0, 0, 10, 10] },
    { tipo: 'spezzata', infinita: true, ingombro: [-1e6, -1e6, 1e6, 1e6] },
  ]
  const e = calcolaEstensione(finte)
  controlla(
    'estensione: le rette infinite non la dettano',
    e[0] === 0 && e[1] === 0 && e[2] === 10 && e[3] === 10,
    `[${e.join(', ')}] invece di [0, 0, 10, 10]`
  )
}

for (const nome of elenco) {
  const dati = readFileSync(join(FILE, nome))
  const dwg = /\.dwg$/i.test(nome)

  let modello
  const t0 = Date.now()
  try {
    const fonte = dwg
      ? await leggiDwg(dati.buffer.slice(dati.byteOffset, dati.byteOffset + dati.byteLength), nome)
      : await leggiDxf(dati.toString('utf8'), nome)
    modello = normalizza(fonte)
  } catch (e) {
    controlla(`${nome}: si apre`, false, e.message)
    continue
  }
  const ms = Date.now() - t0

  const modelloSpazio = modello.spazi.find((s) => !s.carta)
  const primitive = modelloSpazio.primitive
  const est = modelloSpazio.estensione
  const larghezza = est[2] - est[0]
  const altezza = est[3] - est[1]

  controlla(`${nome}: si apre`, true, `${ms} ms`)
  controlla(`${nome}: produce geometria`, primitive.length > 0, `${primitive.length} primitive`)
  controlla(`${nome}: layer letti`, modello.layer.length > 0, `${modello.layer.length}`)
  controlla(`${nome}: unità dichiarate`, modello.unita.dichiarate, modello.unita.nome)

  // 🔴 Nessuna coordinata può essere NaN: un solo NaN fa sparire un'intera
  // spezzata a schermo e rompe l'estensione senza dare errore.
  // ⚠️ Si misurano solo le primitive che HANNO coordinate: la prima versione di
  // questo controllo contava anche le viste, che non ne hanno, e dichiarava due
  // NaN inesistenti su tutti e quattro i file.
  let nan = 0
  for (const p of primitive) {
    if (p.tipo === 'spezzata') {
      for (const v of p.punti) if (!Number.isFinite(v)) nan++
    } else if (p.tipo === 'testo') {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.altezza)) nan++
    }
  }
  controlla(`${nome}: nessuna coordinata NaN`, nan === 0, nan ? `${nan} valori` : '')

  // 🔴 L'estensione dev'essere finita e non degenere, e soprattutto NON deve
  // essere dettata dalle rette infinite.
  // ⚠️ Non si può pretendere che sia «piccola»: example_2018 contiene un blocco
  // inserito con scala ×3256 e si estende davvero per 3,4 km — AutoCAD stesso
  // scrive quei valori in EXTMIN/EXTMAX. Il controllo giusto è il confronto:
  // includendo RAY e XLINE l'estensione deve venire MOLTO più grande.
  const finita = Number.isFinite(larghezza) && Number.isFinite(altezza) && larghezza > 0 && altezza > 0
  controlla(
    `${nome}: estensione finita e non degenere`,
    finita,
    `${larghezza.toFixed(0)} × ${altezza.toFixed(0)} unità`
  )

  const infinite = primitive.filter((p) => p.infinita).length
  controlla(
    `${nome}: rette infinite riconosciute`,
    true,
    infinite ? `${infinite} fra RAY e XLINE, marcate ed escluse dall'estensione` : 'nessuna'
  )

  // 🔴 Controllo di geometria a risultato noto.
  // `prova-geometria.dxf` è costruito apposta perché l'estensione sia calcolabile
  // a mano: [0, -50, 500, 510]. Se la conversione gradi→radianti sparisse
  // dall'adattatore DXF, l'INSERT ruotato di 90 girerebbe di 90 RADIANTI
  // (≈ 5157°) e questi numeri cambierebbero di colpo. È l'unico controllo qui
  // dentro che sa quale sia la risposta giusta, invece di limitarsi a chiedere
  // che il risultato sia plausibile.
  if (nome === 'prova-geometria.dxf') {
    const atteso = [0, -50, 500, 510]
    const scarto = Math.max(...est.map((v, i) => Math.abs(v - atteso[i])))
    controlla(
      `${nome}: geometria esatta (angoli in gradi convertiti)`,
      scarto < 0.05,
      `scarto massimo ${scarto.toFixed(4)} su [${est.map((v) => v.toFixed(2)).join(', ')}]`
    )
    controlla(`${nome}: blocco espanso`, primitive.length === 5, `${primitive.length} primitive attese 5`)
  }

  // 🔴 I layout devono portare dentro il MODELLO attraverso le loro viste.
  // Un layout che mostra solo la cornice è una tavola vuota, ed è proprio la
  // tavola col cartiglio che l'utente vuole stampare.
  const tavole = modello.spazi.filter((s) => s.carta)
  for (const t of tavole) {
    const viste = t.primitive.filter((p) => p.tipo === 'vista').length
    const portate = t.primitive.filter((p) => p.inVista).length
    controlla(
      `${nome}: layout «${t.nome}» con vista sul modello`,
      viste === 0 || portate > 0,
      `${viste} viste, ${portate} pezzi di modello ritagliati dentro`
    )
  }

  // Il rapporto di lettura deve dire qualcosa su ciò che non è stato disegnato.
  const nonDisegnate = Object.values(modello.rapporto.nonDisegnati).reduce((a, b) => a + b, 0)
  const tipiIgnorati = Object.keys(modello.rapporto.nonDisegnati).length
  controlla(
    `${nome}: rapporto compilato`,
    modello.rapporto.conteggi && Object.keys(modello.rapporto.conteggi).length > 0,
    `${tipiIgnorati} tipi non disegnati, ${nonDisegnate} entità`
  )

  // PDF: deve essere un PDF vero, non vuoto, e dichiarare una scala normalizzata.
  try {
    const pdf = await esportaPdf(modello, modelloSpazio, { formato: 'A3', orientamento: 'orizzontale' })
    const buf = Buffer.from(pdf.arrayBuffer())
    const testa = buf.subarray(0, 5).toString('latin1')
    controlla(`${nome}: PDF valido`, testa === '%PDF-', `${(buf.length / 1024).toFixed(0)} kB, scala 1:${pdf.scala}`)
    controlla(`${nome}: PDF non vuoto`, pdf.disegnate > 0, `${pdf.disegnate} elementi`)
    controlla(`${nome}: scala normalizzata`, eNormalizzata(pdf.scala), `1:${pdf.scala}`)
    writeFileSync(join(USCITA, nome.replace(/\.\w+$/, '.pdf')), buf)
  } catch (e) {
    controlla(`${nome}: PDF valido`, false, e.message)
  }

  // 🔴 Export DXF: si verifica RILEGGENDOLO col nostro stesso lettore.
  // È l'unico modo per sapere se quello che esce è un DXF vero e se la
  // geometria sopravvive al viaggio: un file che «sembra» giusto e che nessun
  // CAD riapre sarebbe indistinguibile, da qui dentro, da uno buono.
  try {
    const dxf = esportaDxf(modello, modelloSpazio, null)
    controlla(`${nome}: DXF prodotto`, dxf.entita > 0, `${dxf.entita} entità, ${(dxf.testo.length / 1024).toFixed(0)} kB`)
    const rifatto = normalizza(await leggiDxf(dxf.testo, 'riletto.dxf'))
    const sp = rifatto.spazi[0]
    const e1 = modelloSpazio.estensione
    const e2 = sp.estensione
    const misura = Math.max(e1[2] - e1[0], e1[3] - e1[1])
    const scarto = Math.max(...e2.map((v, i) => Math.abs(v - e1[i]))) / misura
    controlla(
      `${nome}: il DXF esportato si rilegge uguale`,
      scarto < 0.02,
      `scarto ${(scarto * 100).toFixed(3)}% sull'estensione, ${sp.primitive.length} primitive rilette`
    )
    controlla(
      `${nome}: unità conservate nel DXF`,
      rifatto.unita.codice === modello.unita.codice,
      `${rifatto.unita.nome}`
    )
  } catch (e) {
    controlla(`${nome}: DXF prodotto`, false, e.message)
  }

  // Tavole multiple: una pagina per spazio, nello stesso PDF.
  if (modello.spazi.length > 1) {
    try {
      const molte = await esportaPdfMultiplo(modello, modello.spazi, { formato: 'A3' })
      controlla(
        `${nome}: tutte le tavole in un PDF solo`,
        molte.pagine.length >= 1,
        `${molte.pagine.length} pagine: ${molte.pagine.map((p) => `${p.nome} 1:${p.scala}`).join(', ')}`
      )
    } catch (e) {
      controlla(`${nome}: tutte le tavole in un PDF solo`, false, e.message)
    }
  }

  const layout = modello.spazi.filter((s) => s.carta)
  console.log(
    `\n  ${nome} — ${modello.formato} ${modello.versione}, ${ms} ms\n` +
    `    ${primitive.length} primitive · ${modello.layer.length} layer · ` +
    `${layout.length} layout (${layout.map((l) => `${l.nome}:${l.primitive.length}`).join(' ') || '—'})\n` +
    `    estensione ${larghezza.toFixed(0)} × ${altezza.toFixed(0)} ${modello.unita.nome}\n` +
    `    non disegnate: ${Object.entries(modello.rapporto.nonDisegnati).map(([t, n]) => `${n}×${t}`).join(' ') || 'nessuna'}\n` +
    `    avvisi: ${modello.rapporto.avvisi.join('; ') || 'nessuno'}`
  )
}

console.log(`\n${'─'.repeat(70)}`)
const falliti = esiti.filter((e) => !e.ok)
for (const e of esiti) {
  console.log(`  ${e.ok ? '✅' : '❌'} ${e.nome}${e.dettaglio ? ` — ${e.dettaglio}` : ''}`)
}
console.log(`\n${esiti.length - falliti.length} controlli su ${esiti.length}` +
  (falliti.length ? ` — ❌ ${falliti.length} FALLITI` : ' — tutti superati'))
console.log(`PDF di prova in prove/uscita/\n`)
process.exit(falliti.length ? 1 : 0)

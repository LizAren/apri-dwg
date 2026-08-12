// ============================================================================
//  Guarda la pagina, non solo il codice.
//
//  Apre l'applicazione COMPILATA in un browser vero, ci carica dentro i file di
//  prova come farebbe una persona, e salva le schermate. Serve a scoprire i
//  difetti che nel sorgente non si vedono: un disegno che esce vuoto, un
//  pannello che deborda, un comando che sul telefono è più basso di 44px.
//
//  Uso:  node strumenti/schermate.mjs
// ============================================================================

import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, dirname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const QUI = dirname(fileURLToPath(import.meta.url))
const RADICE = join(QUI, '..')
const DIST = join(RADICE, 'dist')
const USCITA = join(RADICE, 'prove/schermate')

if (!existsSync(DIST)) {
  console.error('❌ Manca dist/: lancia prima `npm run build`.')
  process.exit(1)
}

const TIPI = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json',
}

const server = createServer(async (req, res) => {
  try {
    const percorso = decodeURIComponent(req.url.split('?')[0])
    const dentro = normalize(join(DIST, percorso === '/' ? 'index.html' : percorso))
    if (!dentro.startsWith(DIST)) {
      res.writeHead(403).end()
      return
    }
    const dati = await readFile(dentro)
    res.writeHead(200, { 'Content-Type': TIPI[extname(dentro)] || 'application/octet-stream' })
    res.end(dati)
  } catch {
    res.writeHead(404).end('non trovato')
  }
})
await new Promise((r) => server.listen(0, r))
const porta = server.address().port
const indirizzo = `http://localhost:${porta}/`

await mkdir(USCITA, { recursive: true })
const browser = await chromium.launch()
const problemi = []

async function schermata(nome, opzioni, azione) {
  const contesto = await browser.newContext(opzioni)
  const pagina = await contesto.newPage()
  const errori = []
  pagina.on('pageerror', (e) => errori.push(String(e)))
  pagina.on('console', (m) => {
    if (m.type() === 'error') errori.push(m.text())
  })
  await pagina.goto(indirizzo, { waitUntil: 'networkidle' })
  const esito = (await azione?.(pagina)) || {}
  await pagina.screenshot({ path: join(USCITA, `${nome}.png`) })
  if (errori.length) problemi.push(`${nome}: ${errori.join(' | ')}`)
  console.log(
    `  ${errori.length ? '❌' : '✅'} ${nome}` +
    (esito.nota ? ` — ${esito.nota}` : '') +
    (errori.length ? `\n      ${errori.join('\n      ')}` : '')
  )
  await contesto.close()
  return esito
}

const SCRIVANIA = { viewport: { width: 1440, height: 900 } }
const TELEFONO = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }

console.log('\nSchermate\n' + '─'.repeat(70))

await schermata('01-avvio', SCRIVANIA)

async function apri(pagina, file) {
  await pagina.setInputFiles('#file', join(RADICE, 'prove/file', file))
  // Si aspetta che il pannello d'ingresso sia DAVVERO fuori dallo schermo.
  // (Aspettarlo «visibile con l'attributo hidden» non finiva mai, ed è stato il
  // primo segnale che l'attributo ora funziona.)
  await pagina.waitForFunction(
    () => document.getElementById('benvenuto').offsetParent === null,
    { timeout: 30000 }
  )
  await pagina.waitForTimeout(400)
  return pagina.evaluate(() => ({
    stato: document.querySelector('#stato .dato')?.textContent,
    layer: document.querySelectorAll('#layer label').length,
    spazi: [...document.querySelectorAll('#spazi .spazio')].map((b) => b.textContent),
    rapporto: [...document.querySelectorAll('#rapporto dt')].map((d) => d.textContent),
    // Quanto disegno c'è davvero sulla tela: si contano i pixel non di fondo.
    inchiostro: (() => {
      const c = document.getElementById('tela')
      const ctx = c.getContext('2d')
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let n = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 40 || d[i + 1] > 40 || d[i + 2] > 60) n++
      }
      return { pixel: n, totale: c.width * c.height }
    })(),
  }))
}

const esito = await schermata('02-dwg-2018', SCRIVANIA, async (p) => {
  const r = await apri(p, 'example_2018.dwg')
  const percentuale = ((r.inchiostro.pixel / r.inchiostro.totale) * 100).toFixed(2)
  if (r.inchiostro.pixel < 500) problemi.push(`02: la tela è quasi vuota (${r.inchiostro.pixel} pixel)`)
  return {
    nota: `${r.stato} · ${r.layer} layer · spazi [${r.spazi.join(' ')}] · disegno su ${percentuale}% della tela`,
  }
})

await schermata('03-dxf', SCRIVANIA, async (p) => {
  const r = await apri(p, 'prova-geometria.dxf')
  if (r.inchiostro.pixel < 200) problemi.push(`03: la tela è quasi vuota (${r.inchiostro.pixel} pixel)`)
  return { nota: `${r.stato} · ${r.inchiostro.pixel} pixel di disegno` }
})

await schermata('04-fondo-bianco', SCRIVANIA, async (p) => {
  await apri(p, 'example_2018.dwg')
  await p.click('#btn-fondo')
  await p.waitForTimeout(300)
})

await schermata('05-layout', SCRIVANIA, async (p) => {
  await apri(p, 'example_2018.dwg')
  const bottoni = await p.$$('#spazi .spazio')
  if (bottoni.length > 1) {
    await bottoni[1].click()
    await p.waitForTimeout(400)
  }
  return { nota: `${bottoni.length} spazi disponibili` }
})

await schermata('06-stampa', SCRIVANIA, async (p) => {
  await apri(p, 'example_2018.dwg')
  await p.click('#btn-pdf')
  await p.waitForTimeout(250)
})

await schermata('09-info-chiuso', SCRIVANIA, async (p) => {
  await apri(p, 'example_2018.dwg')
  const r = await p.evaluate(() => {
    const i = document.getElementById('info').getBoundingClientRect()
    return {
      l: Math.round(i.width), a: Math.round(i.height),
      testo: getComputedStyle(document.getElementById('info-testo')).visibility,
    }
  })
  // Chiuso dev'essere un cerchio: se si allarga, il testo sta trapelando.
  if (r.l !== r.a) problemi.push(`09: il pallino chiuso non e' tondo (${r.l}x${r.a})`)
  if (r.l > 40) problemi.push(`09: il pallino chiuso e' grande ${r.l}px, atteso 34`)
  if (r.testo !== 'hidden') problemi.push('09: il testo informazioni e\' leggibile a pallino chiuso')
  return { nota: `pallino ${r.l}x${r.a}, testo ${r.testo}` }
})

await schermata('10-info-aperto', SCRIVANIA, async (p) => {
  await apri(p, 'example_2018.dwg')
  await p.click('#info-tasto')
  await p.waitForTimeout(700)
  const r = await p.evaluate(() => {
    const c = document.getElementById('info').getBoundingClientRect()
    const t = document.getElementById('info-testo')
    return {
      w: Math.round(c.width), h: Math.round(c.height),
      contenuto: Math.round(t.scrollHeight),
      espanso: document.getElementById('info-tasto').getAttribute('aria-expanded'),
      raggio: getComputedStyle(document.getElementById('info')).borderRadius,
    }
  })
  // 🔴 L'altezza e' misurata, non scritta a mano: se il pannello e' piu' basso
  // del contenuto, l'ultima riga (che e' la licenza) sparisce in silenzio.
  if (r.h < r.contenuto - 2) problemi.push(`10: pannello alto ${r.h} ma testo ${r.contenuto}: ultima riga tagliata`)
  if (r.espanso !== 'true') problemi.push('10: aria-expanded non aggiornato')
  if (parseFloat(r.raggio) < 8) problemi.push(`10: i bordi non sono smussati (${r.raggio})`)
  // Cliccando fuori deve tornare pallino.
  await p.mouse.click(760, 420)
  await p.waitForTimeout(700)
  const dopo = await p.evaluate(() => Math.round(document.getElementById('info').getBoundingClientRect().width))
  if (dopo > 40) problemi.push(`10: cliccando fuori non si richiude (largo ${dopo})`)
  return { nota: `aperto ${r.w}x${r.h} (testo ${r.contenuto}, raggio ${r.raggio}), richiuso a ${dopo}` }
})

await schermata('07-accesso', SCRIVANIA, async (p) => {
  await p.click('#bloccate .voce')
  await p.waitForTimeout(250)
})

await schermata('08-telefono', TELEFONO, async (p) => {
  const r = await apri(p, 'example_2018.dwg')
  // 🔴 Sul telefono ogni comando dev'essere alto almeno 44px: è la regola del
  // repo, ed è già stata violata una volta con pastiglie da 37px.
  const piccoli = await p.evaluate(() =>
    [...document.querySelectorAll('button.comando, .spazio, .bloccate .voce, .info-tasto')]
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 44)
      .map((b) => `${b.textContent.trim().slice(0, 24)} (${Math.round(b.getBoundingClientRect().height)}px)`)
  )
  if (piccoli.length) problemi.push(`08: bersagli sotto i 44px → ${piccoli.join(', ')}`)
  // E la pagina non deve scorrere, né in orizzontale né in verticale: la barra
  // dei comandi deve restare sullo schermo. È già scivolata fuori una volta.
  const misure = await p.evaluate(() => {
    const b = document.querySelector('.barra').getBoundingClientRect()
    return {
      largo: document.documentElement.scrollWidth > window.innerWidth + 1,
      alto: document.documentElement.scrollHeight > window.innerHeight + 1,
      barraVisibile: b.top >= -1 && b.bottom <= window.innerHeight,
    }
  })
  if (misure.largo) problemi.push('08: la pagina scorre in orizzontale sul telefono')
  if (misure.alto) problemi.push('08: la pagina scorre in verticale sul telefono')
  if (!misure.barraVisibile) problemi.push('08: la barra dei comandi non è sullo schermo')
  return {
    nota: `${r.layer} layer · bersagli piccoli ${piccoli.length} · ` +
      `scorrimento ${misure.largo || misure.alto ? 'SÌ' : 'no'} · barra ${misure.barraVisibile ? 'visibile' : 'FUORI'}`,
  }
})

await browser.close()
server.close()

console.log('─'.repeat(70))
if (problemi.length) {
  console.log('\n❌ Problemi:\n' + problemi.map((p) => '   • ' + p).join('\n'))
} else {
  console.log('\n✅ Nessun problema rilevato.')
}
console.log(`Schermate in prove/schermate/\n`)
process.exit(problemi.length ? 1 : 0)

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

async function schermata(nome, opzioni, azione, query = '') {
  const contesto = await browser.newContext(opzioni)
  const pagina = await contesto.newPage()
  const errori = []
  pagina.on('pageerror', (e) => errori.push(String(e)))
  pagina.on('console', (m) => {
    if (m.type() === 'error') errori.push(m.text())
  })
  await pagina.goto(indirizzo + query, { waitUntil: 'networkidle' })
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
// Il telefono coricato: è la posizione con cui si guarda una planimetria larga.
const CORICATO = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }

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
  await p.click('#funzioni .voce:not(.accesa)')
  await p.waitForTimeout(250)
})

await schermata('08-telefono', TELEFONO, async (p) => {
  const r = await apri(p, 'example_2018.dwg')
  // 🔴 Sul telefono ogni comando dev'essere alto almeno 44px: è la regola del
  // repo, ed è già stata violata una volta con pastiglie da 37px.
  const piccoli = await p.evaluate(() =>
    [...document.querySelectorAll('button.comando, .spazio, .bloccate .voce, .info-tasto, .maniglia-foglio')]
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

  // 🔴 In campo lo schermo serve al DISEGNO. Prima il disegno prendeva meno di
  // un terzo dell'altezza — la cosa più importante era la più piccola — perché
  // barra e pannello si spartivano il resto. Questo controllo misura la quota
  // vera in pixel: se qualcuno rialza la barra o riapre il pannello di
  // default, si vede qui e non sul telefono di chi è sul posto.
  const quota = await p.evaluate(() => {
    const t = document.querySelector('.tela-cornice').getBoundingClientRect()
    return {
      disegno: t.height / window.innerHeight,
      chiuso: document.body.classList.contains('foglio-chiuso'),
      pannello: document.getElementById('pannello').getBoundingClientRect().height,
    }
  })
  if (!quota.chiuso) problemi.push('08: aperto un disegno, il foglio non si è abbassato')
  if (quota.disegno < 0.6) {
    problemi.push(`08: al disegno resta il ${Math.round(quota.disegno * 100)}% dell'altezza, atteso almeno 60%`)
  }

  // 🔴 I comandi devono starci tutti senza scorrere la barra: «Converti in
  // PDF» era finito fuori dallo schermo, ed è quello che serve in campo.
  const fuori = await p.evaluate(() =>
    [...document.querySelectorAll('.comandi .comando')]
      .filter((b) => b.getBoundingClientRect().right > window.innerWidth + 1)
      .map((b) => b.textContent.trim())
  )
  if (fuori.length) problemi.push(`08: comandi fuori dallo schermo → ${fuori.join(', ')}`)

  // Il foglio si alza e si abbassa, e le tre altezze devono essere davvero
  // diverse: una maniglia che non muove niente è peggio che non averla.
  const altezze = []
  for (let i = 0; i < 3; i++) {
    await p.click('#maniglia-foglio')
    await p.evaluate(() => new Promise((r) => setTimeout(r, 420)))
    altezze.push(await p.evaluate(() => Math.round(document.getElementById('pannello').getBoundingClientRect().height)))
  }
  if (new Set(altezze).size !== 3) {
    problemi.push(`08: il foglio non ha tre altezze distinte → ${altezze.join(' / ')}`)
  }

  return {
    nota: `${r.layer} layer · bersagli piccoli ${piccoli.length} · ` +
      `scorrimento ${misure.largo || misure.alto ? 'SÌ' : 'no'} · barra ${misure.barraVisibile ? 'visibile' : 'FUORI'} · ` +
      `disegno ${Math.round(quota.disegno * 100)}% · foglio ${altezze.join('/')}px · ` +
      `comandi fuori ${fuori.length}`,
  }
})

// 🔴 Coricato il foglio non serve: con 390px di altezza mangerebbe metà dello
// schermo. Il pannello torna di fianco, e il disegno resta alto quanto la
// finestra.
await schermata('12-telefono-coricato', CORICATO, async (p) => {
  const r = await apri(p, 'example_2018.dwg')
  const m = await p.evaluate(() => {
    const t = document.querySelector('.tela-cornice').getBoundingClientRect()
    const q = document.getElementById('pannello').getBoundingClientRect()
    return {
      fianco: q.right <= t.left + 1 || t.right <= q.left + 1,
      altezza: t.height / window.innerHeight,
      maniglia: document.getElementById('maniglia-foglio').offsetParent !== null,
      scorre: document.documentElement.scrollHeight > window.innerHeight + 1,
    }
  })
  if (!m.fianco) problemi.push('12: coricato il pannello non è di fianco al disegno')
  if (m.maniglia) problemi.push('12: coricato la maniglia del foglio si vede ancora')
  if (m.altezza < 0.75) problemi.push(`12: coricato al disegno resta il ${Math.round(m.altezza * 100)}% dell'altezza`)
  if (m.scorre) problemi.push('12: la pagina scorre in verticale col telefono coricato')
  return { nota: `${r.layer} layer · pannello di fianco · disegno ${Math.round(m.altezza * 100)}% dell'altezza` }
})

// ---------------------------------------------------------------------------
//  Gli strumenti, misurati su una geometria di cui si conosce la risposta.
//
//  `prova-geometria.dxf` ha una linea da (0,0) a (100,0) sul layer MURI: cento
//  millimetri, cioè 10 cm. Le coordinate sullo schermo si ricavano qui dalla
//  formula dell'inquadratura, quindi il controllo verifica ANCHE che la
//  trasformazione fra disegno e pixel sia giusta.
// ---------------------------------------------------------------------------

async function schermo(p, x, y) {
  const r = await p.evaluate(() => {
    const c = document.getElementById('tela').getBoundingClientRect()
    return { x: c.x, y: c.y, w: c.width, h: c.height }
  })
  // estensione di prova-geometria.dxf: [0, -50, 500, 510] → 500 x 560
  const zoom = Math.min(r.w / 500, r.h / 560) * 0.92
  return [r.x + r.w / 2 + (x - 250) * zoom, r.y + r.h / 2 - (y - 230) * zoom]
}

// ⚠️ Le prove degli strumenti (misura, proprietà, ricerca) NON stanno qui.
// Servono un account, e l'accesso vive nella parte riservata: si provano in
// `dwg-riservato/strumenti/prova-accesso.mjs`, con PHP e database veri. Qui si
// verifica solo il caso senza account, che è quello che vede il pubblico.
await schermata('11-senza-account', SCRIVANIA, async (p) => {
  // 🔴 L'elenco delle funzioni si vede SUBITO, prima ancora di aprire un
  // disegno: è lì che si capisce cosa offre la pagina. Senza account sono tutte
  // e nove col lucchetto.
  const prima = await p.evaluate(() => ({
    voci: document.querySelectorAll('#funzioni .voce').length,
    accese: document.querySelectorAll('#funzioni .voce.accesa').length,
    lucchetti: document.querySelectorAll('#funzioni .lucchetto').length,
    barra: !document.getElementById('sez-strumenti').hidden,
  }))
  if (prima.voci !== 11) problemi.push(`11: ${prima.voci} funzioni in elenco prima del disegno, attese 11`)
  if (prima.accese !== 0) problemi.push(`11: ${prima.accese} funzioni accese senza account`)
  if (prima.lucchetti !== 11) problemi.push(`11: ${prima.lucchetti} lucchetti, attesi 11`)
  if (prima.barra) problemi.push('11: la barra degli strumenti si vede senza disegno')

  await apri(p, 'prova-geometria.dxf')
  const dopo = await p.evaluate(() => ({
    voci: document.querySelectorAll('#funzioni .voce').length,
    accese: document.querySelectorAll('#funzioni .voce.accesa').length,
    barra: document.querySelectorAll('#strumenti .attrezzo-tasto').length,
  }))
  if (dopo.accese !== 0) problemi.push(`11: ${dopo.accese} funzioni accese senza account`)
  if (dopo.barra !== 0) problemi.push(`11: ${dopo.barra} strumenti nella barra senza account`)
  return { nota: `prima ${prima.voci} voci col lucchetto, barra nascosta; dopo ${dopo.voci} voci, ${dopo.barra} strumenti` }
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

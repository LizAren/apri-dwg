// Apri DWG — visualizzatore DWG/DXF e convertitore in PDF, tutto nel browser.
// Copyright (C) 2026  Stefano Fostinelli
//
// Questo programma è software libero: puoi ridistribuirlo e/o modificarlo
// secondo i termini della GNU General Public License come pubblicata dalla
// Free Software Foundation, versione 3 o (a tua scelta) successiva.
// È distribuito nella speranza che sia utile, ma SENZA ALCUNA GARANZIA.
// Vedi la GNU General Public License per i dettagli: file LICENSE.

// ============================================================================
//  Orchestrazione: mette insieme lettura, tela, pannelli e stampa.
//
//  Tutto quello che succede qui dentro succede nel browser di chi visita.
//  Non c'è una sola chiamata di rete oltre al caricamento della pagina e — solo
//  se si apre un DWG — del lettore WebAssembly.
// ============================================================================

import { apriFile } from './lettura/apri.js'
import { rapportoLeggibile } from './modello/normalizza.js'
import { coloreLayer, risolviInchiostro } from './modello/colori.js'
import { UNITA, SCELTE_UNITA } from './modello/unita.js'
import { Tela } from './vista/tela.js'
import { montaBloccate } from './interfaccia/blocco.js'
import { esportaPdf, SCALE } from './esporta/pdf.js'

const $ = (id) => document.getElementById(id)

const tela = new Tela($('tela'))
let modello = null
let spazioAttivo = null
let layerVisibili = new Set()

// ---------------------------------------------------------------------------
//  Apertura
// ---------------------------------------------------------------------------

$('btn-apri').addEventListener('click', () => $('file').click())
$('btn-apri-2').addEventListener('click', () => $('file').click())
$('file').addEventListener('change', (e) => {
  const f = e.target.files?.[0]
  if (f) apri(f)
  e.target.value = ''
})

const cornice = document.querySelector('.tela-cornice')
for (const evento of ['dragenter', 'dragover']) {
  cornice.addEventListener(evento, (e) => {
    e.preventDefault()
    cornice.classList.add('sopra')
  })
}
for (const evento of ['dragleave', 'drop']) {
  cornice.addEventListener(evento, (e) => {
    e.preventDefault()
    cornice.classList.remove('sopra')
  })
}
cornice.addEventListener('drop', (e) => {
  const f = e.dataTransfer?.files?.[0]
  if (f) apri(f)
})

async function apri(file) {
  mostraErrore(null)
  $('attesa').hidden = false
  $('attesa-testo').textContent = 'Leggo il file…'
  try {
    modello = await apriFile(file, (m) => {
      $('attesa-testo').textContent = m
    })
    layerVisibili = new Set(modello.layer.filter((l) => l.visibile).map((l) => l.nome))
    // Un layer che non compare nella tabella (capita) resta comunque visibile.
    for (const s of modello.spazi) {
      for (const p of s.primitive) {
        if (!modello.layer.some((l) => l.nome === p.layer)) layerVisibili.add(p.layer)
      }
    }
    tela.layerVisibili = layerVisibili
    scegliSpazio(modello.spazi[0])
    disegnaStato()
    disegnaSpazi()
    disegnaLayer()
    disegnaRapporto()
    $('benvenuto').hidden = true
    for (const b of ['btn-tutto', 'btn-fondo', 'btn-pdf']) $(b).disabled = false
  } catch (e) {
    console.error(e)
    mostraErrore(e.message || String(e))
    if (!modello) $('benvenuto').hidden = false
  } finally {
    $('attesa').hidden = true
  }
}

function mostraErrore(testo) {
  const el = $('errore')
  el.hidden = !testo
  el.textContent = testo || ''
}

// ---------------------------------------------------------------------------
//  Pannelli
// ---------------------------------------------------------------------------

function scegliSpazio(spazio) {
  spazioAttivo = spazio
  tela.mostra(spazio)
  for (const b of $('spazi').children) {
    b.setAttribute('aria-current', String(b.dataset.id === String(spazio.id)))
  }
  aggiornaScala()
}

function disegnaStato() {
  const u = modello.unita
  $('stato').innerHTML =
    `<span class="nome"></span>` +
    `<span class="dato"></span>`
  $('stato').querySelector('.nome').textContent = modello.nomeFile
  $('stato').querySelector('.dato').textContent =
    `${modello.formato}${modello.versione ? ' ' + modello.versione : ''} · ` +
    `${u.dichiarate ? u.nome : 'unità non dichiarate'} · ` +
    `${modello.layer.length} layer`
}

function disegnaSpazi() {
  const c = $('spazi')
  c.innerHTML = ''
  for (const s of modello.spazi) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'spazio'
    b.dataset.id = String(s.id)
    b.innerHTML =
      `<span>${escapa(s.nome)}</span><span class="quanti">${s.primitive.length}</span>`
    b.addEventListener('click', () => scegliSpazio(s))
    c.appendChild(b)
  }
  $('sez-spazi').hidden = modello.spazi.length < 2
  for (const b of c.children) b.setAttribute('aria-current', String(b.dataset.id === String(spazioAttivo.id)))
}

function disegnaLayer() {
  const c = $('layer')
  c.innerHTML = ''
  const ordinati = [...modello.layer].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'it', { numeric: true })
  )
  for (const l of ordinati) {
    const label = document.createElement('label')
    const spunta = document.createElement('input')
    spunta.type = 'checkbox'
    spunta.checked = layerVisibili.has(l.nome)
    spunta.addEventListener('change', () => {
      if (spunta.checked) layerVisibili.add(l.nome)
      else layerVisibili.delete(l.nome)
      tela.ridisegna()
    })
    const pastiglia = document.createElement('span')
    pastiglia.className = 'pastiglia'
    pastiglia.style.background = risolviInchiostro(coloreLayer(l), tela.fondoChiaro)
    const nome = document.createElement('span')
    nome.className = 'nome'
    nome.textContent = l.nome
    label.append(spunta, pastiglia, nome)
    if (l.spento || l.congelato) {
      const stato = document.createElement('span')
      stato.className = 'spento'
      stato.textContent = l.congelato ? 'congelato' : 'spento'
      label.append(stato)
    }
    c.appendChild(label)
  }
  $('sez-layer').hidden = false
}

$('btn-layer-tutti').addEventListener('click', () => {
  layerVisibili = new Set(modello.layer.map((l) => l.nome))
  tela.layerVisibili = layerVisibili
  disegnaLayer()
  tela.ridisegna()
})
$('btn-layer-nessuno').addEventListener('click', () => {
  layerVisibili.clear()
  disegnaLayer()
  tela.ridisegna()
})

function disegnaRapporto() {
  const dl = $('rapporto')
  dl.innerHTML = ''
  for (const v of rapportoLeggibile(modello)) {
    const dt = document.createElement('dt')
    dt.textContent = v.chiave
    const dd = document.createElement('dd')
    dd.textContent = v.valore
    if (v.avviso) {
      dt.classList.add('avviso')
      dd.style.color = 'var(--avviso)'
    }
    dl.append(dt, dd)
  }
  $('sez-rapporto').hidden = false
}

// ---------------------------------------------------------------------------
//  Comandi di vista
// ---------------------------------------------------------------------------

$('btn-tutto').addEventListener('click', () => tela.zoomTutto())

$('btn-fondo').addEventListener('click', () => {
  tela.fondoChiaro = !tela.fondoChiaro
  $('btn-fondo').setAttribute('aria-pressed', String(tela.fondoChiaro))
  $('btn-fondo').textContent = tela.fondoChiaro ? 'Fondo scuro' : 'Fondo bianco'
  document.querySelector('.tela-cornice').style.background = tela.fondoChiaro ? '#fff' : ''
  if (modello) disegnaLayer()
  tela.ridisegna()
})

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return
  if (e.key === 'z' || e.key === 'Z') tela.zoomTutto()
})

/**
 * La barra di scala mostra quanto vale a schermo una lunghezza tonda del
 * disegno. Non si anima di proposito: è uno strumento di misura.
 */
function aggiornaScala() {
  const el = $('scala-schermo')
  if (!modello || !spazioAttivo) {
    el.hidden = true
    return
  }
  el.hidden = false
  const disegna = () => {
    // Si sceglie il gradino tondo PIÙ GRANDE che sta entro i 120 pixel: salendo
    // al gradino successivo la barra usciva più lunga del suo spazio, e sul
    // telefono si prendeva più di metà schermo.
    const grezza = 120 / tela.zoom
    const esponente = Math.floor(Math.log10(grezza))
    const candidati = [1, 2, 5, 10].map((m) => m * 10 ** esponente)
    const passo = candidati.filter((c) => c <= grezza).pop() ?? candidati[0]
    const larghezza = passo * tela.zoom
    el.innerHTML =
      `${escapa(misura(passo))}<span class="riga" style="width:${larghezza.toFixed(0)}px"></span>`
  }
  tela.onDisegnato = disegna
  disegna()
}

/**
 * ⚠️ In italiano il punto separa le migliaia, quindi «500.000 millimetri» si
 * legge cinquecento. Su una barra di scala è un errore grave: la misura va
 * portata a un multiplo leggibile — 500 m — invece di essere formattata e
 * basta.
 */
function misura(quantita) {
  const mm = modello.unita.mm
  if (!mm) return `${arrotonda(quantita)} unità`
  const inMm = quantita * mm
  if (inMm >= 1000000) return `${arrotonda(inMm / 1000000)} km`
  if (inMm >= 1000) return `${arrotonda(inMm / 1000)} m`
  if (inMm >= 10) return `${arrotonda(inMm / 10)} cm`
  return `${arrotonda(inMm)} mm`
}

const arrotonda = (n) =>
  n >= 100 ? Math.round(n).toString() : Number(n.toPrecision(3)).toString().replace('.', ',')

// ---------------------------------------------------------------------------
//  Stampa in PDF
// ---------------------------------------------------------------------------

const finestraPdf = $('finestra-pdf')

for (const s of SCALE) {
  const o = document.createElement('option')
  o.value = String(s)
  o.textContent = `1:${s}`
  $('pdf-scala').appendChild(o)
}
for (const codice of SCELTE_UNITA) {
  const o = document.createElement('option')
  o.value = String(codice)
  o.textContent = UNITA[codice].nome
  $('pdf-unita').appendChild(o)
}

$('btn-pdf').addEventListener('click', () => {
  // Se il file non dichiara le unità, la scala non ha significato finché non
  // le si sceglie: si chiede, non si indovina.
  $('riga-unita').hidden = modello.unita.dichiarate
  $('pdf-nota').textContent = modello.unita.dichiarate
    ? `Il disegno è in ${modello.unita.nome}. La scala scelta viene scritta sul foglio.`
    : 'Questo file non dichiara le unità: scegli tu quelle giuste, altrimenti la scala stampata sarà falsa.'
  finestraPdf.showModal()
})

$('pdf-annulla').addEventListener('click', () => finestraPdf.close())

$('pdf-fai').addEventListener('click', async () => {
  const bottone = $('pdf-fai')
  bottone.disabled = true
  bottone.textContent = 'Genero…'
  try {
    const scelta = $('pdf-scala').value
    const esito = await esportaPdf(modello, spazioAttivo, {
      formato: $('pdf-formato').value,
      orientamento: $('pdf-orientamento').value,
      scala: scelta ? Number(scelta) : null,
      monocromatico: $('pdf-mono').checked,
      piede: $('pdf-piede').checked,
      layerVisibili,
      mmPerUnitaSupposto: modello.unita.dichiarate
        ? null
        : UNITA[Number($('pdf-unita').value)].mm,
    })
    scarica(esito.blob, modello.nomeFile.replace(/\.\w+$/, '') + `-${spazioAttivo.nome}-1_${esito.scala}.pdf`)
    finestraPdf.close()
    if (esito.avvisi.length) mostraErrore(esito.avvisi.join(' '))
  } catch (e) {
    console.error(e)
    $('pdf-nota').textContent = 'Non è riuscito: ' + (e.message || e)
  } finally {
    bottone.disabled = false
    bottone.textContent = 'Genera il PDF'
  }
})

function scarica(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// ---------------------------------------------------------------------------
//  Pallino informazioni
//
//  Le cose che stavano scritte in fondo alla pagina — privacy, limiti, licenza —
//  non devono saltare all'occhio, ma devono restare raggiungibili: la GPL-3
//  chiede che la dichiarazione di licenza ci sia, e nasconderla non è
//  un'opzione. Sta a un clic, dentro un cerchio che si allunga.
//
//  L'altezza si MISURA invece di essere scritta a mano: un numero fisso qui
//  diventerebbe sbagliato al primo ritocco del testo, e il pannello taglierebbe
//  l'ultima riga senza che nessuno se ne accorga.
// ---------------------------------------------------------------------------

const info = $('info')
const infoTasto = $('info-tasto')
const infoTesto = $('info-testo')

function apriInfo(aperto) {
  info.dataset.aperto = String(aperto)
  infoTasto.setAttribute('aria-expanded', String(aperto))
  info.style.height = aperto ? `${infoTesto.scrollHeight}px` : ''
}

infoTasto.addEventListener('click', (e) => {
  e.stopPropagation()
  apriInfo(info.dataset.aperto !== 'true')
})

// Un clic fuori chiude. Dentro no, altrimenti non si potrebbero seguire i link.
document.addEventListener('click', (e) => {
  if (info.dataset.aperto === 'true' && !info.contains(e.target)) apriInfo(false)
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && info.dataset.aperto === 'true') {
    apriInfo(false)
    infoTasto.focus()
  }
})

// Se la finestra cambia misura mentre è aperto, il testo si reimpagina e
// l'altezza misurata prima non vale più.
new ResizeObserver(() => {
  if (info.dataset.aperto === 'true') info.style.height = `${infoTesto.scrollHeight}px`
}).observe(infoTesto)

// ---------------------------------------------------------------------------

montaBloccate($('bloccate'), $('finestra-accesso'))

const escapa = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

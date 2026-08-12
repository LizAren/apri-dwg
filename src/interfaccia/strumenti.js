// ============================================================================
//  I tre strumenti: misura, proprietà, ricerca testo.
//
//  Girano tutti nel browser, sui dati già in memoria: nessuna chiamata al
//  server, nessun disegno che esce dal computer di chi lo apre.
//
//  🔴 Sono le funzioni che oggi stanno dietro il lucchetto, e il lucchetto è
//  DICHIARATAMENTE una scena: il codice è pubblico sotto GPL-3 e chiunque può
//  riaccenderle. Non è una svista — è la scelta presa: chi sa farlo saprebbe
//  anche riscriversi il visualizzatore, e non è il cliente che stiamo
//  filtrando. Quello che il permesso protegge davvero arriverà solo con le
//  funzioni che usano il server (salvataggio, condivisione).
// ============================================================================

import { Indice, aggancia, colpisci, lunghezza, area, NOMI_AGGANCIO } from '../vista/aggancio.js'

/** Quanti pixel attorno al puntatore si guardano per agganciare. */
const RAGGIO_PX = 16
/** Quanti pixel di tolleranza per dire «ho cliccato QUESTO». */
const TOLLERANZA_PX = 8

export class Strumenti {
  /**
   * @param {object} opzioni  tela, contenitori del DOM, formattatore di misure
   */
  constructor({ tela, elenco, esito, cambiato, formato, formatoArea, visibile, esporta }) {
    this.tela = tela
    this.elenco = elenco
    this.esito = esito
    this.cambiato = cambiato || (() => {})
    this.formato = formato
    this.formatoArea = formatoArea
    this.visibile = visibile
    this.esporta = esporta || {}
    this.modello = null

    this.attivo = null
    this.indice = null
    this.spazio = null
    this.abilitate = new Set()

    this.punti = [] // misura
    this.agganciato = null
    this.selezionata = null
    this.evidenziata = null

    this.tela.sovrapposizione = (ctx) => this._disegnaSopra(ctx)
    this._collega()
  }

  /** Il modello serve a chi mostra dati che non stanno nella geometria. */
  perModello(modello) {
    this.modello = modello
  }

  /** Il disegno è cambiato: l'indice va rifatto, e le misure non valgono più. */
  perSpazio(spazio) {
    this.spazio = spazio
    this.indice = null
    this.punti = []
    this.selezionata = null
    this.evidenziata = null
    this.agganciato = null
    this._scriviEsito()
  }

  /**
   * L'indice si costruisce alla PRIMA richiesta, non all'apertura del file:
   * chi apre un disegno solo per guardarlo o stamparlo non deve pagarne il
   * costo.
   */
  _indice() {
    if (!this.indice && this.spazio) this.indice = new Indice(this.spazio)
    return this.indice
  }

  abilita(insieme) {
    this.abilitate = new Set(insieme)
    if (this.attivo && !this.abilitate.has(this.attivo)) this.attiva(null)
    this._disegnaElenco()
  }

  attiva(nome) {
    this.attivo = this.attivo === nome ? null : nome
    if (this.attivo !== 'misura') this.punti = []
    if (this.attivo !== 'proprieta') this.selezionata = null
    this.agganciato = null
    this.tela.canvas.style.cursor = this.attivo ? 'crosshair' : 'grab'
    this._disegnaElenco()
    this._scriviEsito()
    this.tela.ridisegna()
    this.cambiato(this.attivo)
  }

  // -------------------------------------------------------------------------
  //  Interazione
  // -------------------------------------------------------------------------

  _collega() {
    const c = this.tela.canvas
    let giu = null

    c.addEventListener('pointerdown', (e) => {
      giu = { x: e.clientX, y: e.clientY }
    })

    c.addEventListener('pointermove', (e) => {
      if (!this.attivo || this.attivo === 'cerca') return
      const [x, y] = this._punto(e)
      const raggio = RAGGIO_PX / this.tela.zoom
      if (this.attivo === 'misura') {
        this.agganciato = aggancia(this._indice(), x, y, raggio, this.visibile)
      } else if (this.attivo === 'proprieta') {
        this.evidenziata = colpisci(
          this._indice(), x, y, TOLLERANZA_PX / this.tela.zoom, this.visibile
        )
      }
      this.tela.ridisegna()
    })

    c.addEventListener('pointerup', (e) => {
      // 🔴 Un trascinamento è uno spostamento della vista, non un clic: senza
      // questa soglia ogni pan finirebbe per piazzare un punto di misura.
      const mosso = giu ? Math.hypot(e.clientX - giu.x, e.clientY - giu.y) : 99
      giu = null
      if (!this.attivo || mosso > 4) return
      const [x, y] = this._punto(e)
      if (this.attivo === 'misura') this._misura(x, y)
      else if (this.attivo === 'proprieta') this._proprieta(x, y)
    })

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.attivo) return
      if (this.punti.length) {
        this.punti = []
        this._scriviEsito()
        this.tela.ridisegna()
      } else {
        this.attiva(null)
      }
    })
  }

  _punto(e) {
    const r = this.tela.canvas.getBoundingClientRect()
    return this.tela.aDisegno(e.clientX - r.left, e.clientY - r.top)
  }

  _misura(x, y) {
    const p = aggancia(this._indice(), x, y, RAGGIO_PX / this.tela.zoom, this.visibile)
    if (this.punti.length >= 2) this.punti = []
    this.punti.push(p)
    this._scriviEsito()
    this.tela.ridisegna()
  }

  _proprieta(x, y) {
    this.selezionata = colpisci(
      this._indice(), x, y, TOLLERANZA_PX / this.tela.zoom, this.visibile
    )
    this._scriviEsito()
    this.tela.ridisegna()
  }

  /** Porta in vista un elemento trovato dalla ricerca. */
  vaiA(p) {
    const i = p.ingombro
    this.tela.cx = (i[0] + i[2]) / 2
    this.tela.cy = (i[1] + i[3]) / 2
    const larghezza = Math.max(i[2] - i[0], p.altezza * 8, 1e-6)
    this.tela.zoom = Math.min(
      this.tela.zoom * 40,
      (this.tela.canvas.clientWidth * 0.4) / larghezza
    )
    this.evidenziata = p
    this.tela.ridisegna()
  }

  // -------------------------------------------------------------------------
  //  Disegno sopra il disegno
  // -------------------------------------------------------------------------

  _disegnaSopra(ctx) {
    const blu = '#5a9fd6'
    const chiaro = this.tela.fondoChiaro

    if (this.evidenziata) this._contorna(ctx, this.evidenziata, chiaro ? '#0b5fa5' : blu)
    if (this.selezionata) this._contorna(ctx, this.selezionata, '#e8b93c')

    // Misura: i punti fissati, la linea, e la quota scritta a metà.
    if (this.punti.length) {
      ctx.save()
      ctx.strokeStyle = '#e8b93c'
      ctx.fillStyle = '#e8b93c'
      ctx.lineWidth = 1.4
      const schermo = this.punti.map((p) => this.tela.aSchermo(p.x, p.y))
      if (schermo.length === 2) {
        ctx.beginPath()
        ctx.moveTo(schermo[0][0], schermo[0][1])
        ctx.lineTo(schermo[1][0], schermo[1][1])
        ctx.stroke()
        this._etichetta(
          ctx,
          (schermo[0][0] + schermo[1][0]) / 2,
          (schermo[0][1] + schermo[1][1]) / 2,
          this.formato(this._distanza())
        )
      }
      for (const s of schermo) this._crocetta(ctx, s[0], s[1], '#e8b93c')
      ctx.restore()
    }

    // Il punto di aggancio, col nome di cosa ha agganciato: senza il nome non
    // si sa se si sta misurando dall'estremo o da un punto qualsiasi.
    if (this.attivo === 'misura' && this.agganciato && this.agganciato.tipo) {
      const [sx, sy] = this.tela.aSchermo(this.agganciato.x, this.agganciato.y)
      ctx.save()
      ctx.strokeStyle = '#7bd88f'
      ctx.fillStyle = '#7bd88f'
      ctx.lineWidth = 1.6
      ctx.strokeRect(sx - 5, sy - 5, 10, 10)
      this._etichetta(ctx, sx + 34, sy - 14, NOMI_AGGANCIO[this.agganciato.tipo], '#7bd88f')
      ctx.restore()
    }
  }

  _contorna(ctx, p, colore) {
    ctx.save()
    ctx.strokeStyle = colore
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.75
    if (p.tipo === 'testo') {
      const [x0, y0] = this.tela.aSchermo(p.ingombro[0], p.ingombro[3])
      const [x1, y1] = this.tela.aSchermo(p.ingombro[2], p.ingombro[1])
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
    } else {
      ctx.beginPath()
      const pt = p.punti
      const [x0, y0] = this.tela.aSchermo(pt[0], pt[1])
      ctx.moveTo(x0, y0)
      for (let k = 2; k < pt.length; k += 2) {
        const [x, y] = this.tela.aSchermo(pt[k], pt[k + 1])
        ctx.lineTo(x, y)
      }
      if (p.chiusa) ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
  }

  _crocetta(ctx, x, y, colore) {
    ctx.strokeStyle = colore
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x - 6, y)
    ctx.lineTo(x + 6, y)
    ctx.moveTo(x, y - 6)
    ctx.lineTo(x, y + 6)
    ctx.stroke()
  }

  _etichetta(ctx, x, y, testo, colore = '#e8b93c') {
    ctx.font = '600 12px "Public Sans", system-ui, sans-serif'
    const l = ctx.measureText(testo).width
    ctx.fillStyle = 'rgba(12,15,19,.88)'
    ctx.fillRect(x - l / 2 - 6, y - 18, l + 12, 18)
    ctx.fillStyle = colore
    ctx.textAlign = 'center'
    ctx.fillText(testo, x, y - 5)
    ctx.textAlign = 'left'
  }

  _distanza() {
    const [a, b] = this.punti
    return Math.hypot(b.x - a.x, b.y - a.y)
  }

  // -------------------------------------------------------------------------
  //  Pannello
  // -------------------------------------------------------------------------

  _disegnaElenco() {
    this.elenco.innerHTML = ''
    for (const s of ELENCO) {
      if (!this.abilitate.has(s.id)) continue
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'attrezzo-tasto'
      b.setAttribute('aria-pressed', String(this.attivo === s.id))
      b.innerHTML = `${s.icona}<span>${s.nome}</span>`
      b.addEventListener('click', () => this.attiva(s.id))
      this.elenco.appendChild(b)
    }
  }

  _scriviEsito() {
    const e = this.esito
    e.innerHTML = ''
    e.hidden = true

    if (this.attivo === 'misura') {
      e.hidden = false
      if (this.punti.length < 2) {
        e.innerHTML = `<p class="nota">${
          this.punti.length === 0
            ? 'Clicca il primo punto. Il quadratino verde dice a cosa si sta agganciando.'
            : 'Clicca il secondo punto. Esc annulla.'
        }</p>`
        return
      }
      const [a, b] = this.punti
      const dx = b.x - a.x
      const dy = b.y - a.y
      const angolo = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
      e.innerHTML = righe([
        ['distanza', this.formato(Math.hypot(dx, dy))],
        ['Δ orizzontale', this.formato(Math.abs(dx))],
        ['Δ verticale', this.formato(Math.abs(dy))],
        ['angolo', `${angolo.toFixed(2)}°`],
        ['agganci', `${etichettaAggancio(a)} → ${etichettaAggancio(b)}`],
      ])
      return
    }

    if (this.attivo === 'proprieta') {
      e.hidden = false
      const p = this.selezionata
      if (!p) {
        e.innerHTML = '<p class="nota">Clicca un elemento del disegno.</p>'
        return
      }
      const voci = [
        ['tipo', p.origine || '—'],
        ['layer', p.layer],
        ['colore', p.colore === 'INCHIOSTRO' ? 'come il layer' : p.colore],
        ['spessore', p.spessore ? `${p.spessore.toFixed(2)} mm` : 'sottile'],
      ]
      if (p.tipo === 'testo') {
        voci.push(['testo', p.testo], ['altezza', this.formato(p.altezza)])
      } else {
        voci.push(['lunghezza', this.formato(lunghezza(p))])
        if (p.chiusa) voci.push(['area', this.formatoArea(area(p))])
        if (p.raggio) voci.push(['raggio', this.formato(p.raggio)])
        if (p.centro) {
          voci.push(['centro', `${p.centro.x.toFixed(2)} · ${p.centro.y.toFixed(2)}`])
        }
        voci.push(['vertici', String(p.punti.length / 2)])
      }
      if (p.handle) voci.push(['handle', String(p.handle)])
      e.innerHTML = righe(voci)
      return
    }

    if (this.attivo === 'blocchi') {
      e.hidden = false
      const conteggi = Object.entries(this.modello?.rapporto?.blocchi || {})
        .sort((a, b) => b[1] - a[1])
      if (!conteggi.length) {
        e.innerHTML = '<p class="nota">Questo disegno non contiene blocchi inseriti.</p>'
        return
      }
      const totale = conteggi.reduce((n, [, q]) => n + q, 0)
      e.innerHTML =
        `<p class="nota">${conteggi.length} blocchi diversi, ${totale} inserimenti in tutto. ` +
        `⚠️ È un conteggio degli inserimenti, non un computo metrico: dice quante ` +
        `volte compare un blocco, non cosa contiene.</p>` +
        '<div class="cerca-esiti">' +
        conteggi
          .map(
            ([n, q]) =>
              `<div class="esito-riga" role="listitem"><span class="esito-testo">${sicuro(n)}</span>` +
              `<span class="esito-layer">${q}</span></div>`
          )
          .join('') +
        '</div>'
      return
    }

    if (this.attivo === 'tavole') {
      e.hidden = false
      const spazi = this.modello?.spazi || []
      e.innerHTML =
        `<p class="nota">Una pagina per spazio, ognuna con la sua scala: due tavole ` +
        `dello stesso file quasi mai stanno alla stessa.</p>` +
        '<div class="cerca-esiti">' +
        spazi
          .map(
            (sp, i) =>
              `<label class="esito-riga"><input type="checkbox" data-i="${i}" checked>` +
              `<span class="esito-testo">${sicuro(sp.nome)}</span>` +
              `<span class="esito-layer">${sp.primitive.length}</span></label>`
          )
          .join('') +
        '</div>' +
        '<button type="button" class="comando primario" id="tavole-fai">Genera il PDF</button>'
      e.querySelector('#tavole-fai').addEventListener('click', async (ev) => {
        const scelti = [...e.querySelectorAll('input:checked')].map((c) => spazi[+c.dataset.i])
        ev.target.disabled = true
        ev.target.textContent = 'Genero…'
        try {
          await this.esporta.pdfMultiplo?.(scelti)
        } finally {
          ev.target.disabled = false
          ev.target.textContent = 'Genera il PDF'
        }
      })
      return
    }

    if (this.attivo === 'dxf') {
      e.hidden = false
      e.innerHTML =
        `<p class="nota">🔴 È un'esportazione della <strong>geometria disegnata</strong>, ` +
        `non una copia del file: i blocchi sono già espansi, le quote sono diventate ` +
        `linee e testi, i tratteggi sono solo il contorno. Chi lo riapre trova lo ` +
        `stesso disegno, ma piatto.</p>` +
        '<div class="recapiti">' +
        '<button type="button" class="comando" id="esp-dxf">Scarica DXF</button>' +
        '<button type="button" class="comando" id="esp-png">Scarica PNG</button>' +
        '</div>'
      e.querySelector('#esp-dxf').addEventListener('click', () => this.esporta.dxf?.())
      e.querySelector('#esp-png').addEventListener('click', () => this.esporta.png?.())
      return
    }

    if (this.attivo === 'cerca') {
      e.hidden = false
      e.innerHTML =
        '<input type="search" id="cerca-campo" class="campo" placeholder="cerca una scritta…" ' +
        'autocomplete="off" aria-label="Cerca testo nel disegno">' +
        '<div class="cerca-esiti" id="cerca-esiti"></div>'
      const campo = e.querySelector('#cerca-campo')
      const esiti = e.querySelector('#cerca-esiti')
      const cerca = () => {
        const q = campo.value.trim().toLowerCase()
        esiti.innerHTML = ''
        if (q.length < 2) {
          esiti.innerHTML = '<p class="nota">Almeno due caratteri.</p>'
          return
        }
        const trovati = this.spazio.primitive.filter(
          (p) => p.tipo === 'testo' && (!this.visibile || this.visibile(p.layer)) &&
            p.testo.toLowerCase().includes(q)
        )
        if (!trovati.length) {
          esiti.innerHTML = '<p class="nota">Nessuna scritta con questo testo.</p>'
          return
        }
        esiti.innerHTML = `<p class="nota">${trovati.length} risultati${
          trovati.length > 60 ? ', mostrati i primi 60' : ''
        }</p>`
        for (const p of trovati.slice(0, 60)) {
          const b = document.createElement('button')
          b.type = 'button'
          b.className = 'esito-riga'
          b.innerHTML = `<span class="esito-testo"></span><span class="esito-layer"></span>`
          b.querySelector('.esito-testo').textContent = p.testo
          b.querySelector('.esito-layer').textContent = p.layer
          b.addEventListener('click', () => this.vaiA(p))
          esiti.appendChild(b)
        }
      }
      campo.addEventListener('input', cerca)
      campo.focus()
      cerca()
    }
  }
}

const etichettaAggancio = (p) => (p.tipo ? NOMI_AGGANCIO[p.tipo] : 'libero')

const righe = (voci) =>
  '<dl class="rapporto">' +
  voci
    .map(
      ([k, v]) =>
        `<dt>${k}</dt><dd>${String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</dd>`
    )
    .join('') +
  '</dl>'

const I = (d) =>
  `<svg class="attrezzo" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

const ELENCO = [
  {
    id: 'misura',
    nome: 'Misura',
    icona: I('<path d="M3 9h18v6H3z"/><path d="M7.5 9v3M12 9v4M16.5 9v3"/>'),
  },
  {
    id: 'proprieta',
    nome: 'Proprietà',
    icona: I(
      '<path d="M3 4.5h9v9H3z"/><path d="M15.5 7h5.5M15.5 11h5.5M15.5 15h3.5"/>' +
        '<path d="M12 13.5l4 6 1.2-2.6 2.6-1.2z" fill="currentColor"/>'
    ),
  },
  {
    id: 'cerca',
    nome: 'Cerca testo',
    icona: I(
      '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>' +
        '<path d="M7.8 9h5.4M7.8 12h3.4"/>'
    ),
  },
  {
    id: 'blocchi',
    nome: 'Blocchi',
    icona: I(
      '<path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7z"/>' +
        '<path d="M13.5 13.5h7v7h-7z" stroke-dasharray="2.4 2.2"/>'
    ),
  },
  {
    id: 'tavole',
    nome: 'Tutte le tavole',
    icona: I('<path d="M3.5 6.5v14h11"/><path d="M8 3.5h8.5l4 4v13H8z"/><path d="M16.5 3.5v4h4"/>'),
  },
  {
    id: 'dxf',
    nome: 'Esporta',
    icona: I(
      '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>' +
        '<path d="M12 10.5v6M9.4 14l2.6 2.6 2.6-2.6"/>'
    ),
  },
]

const sicuro = (t) =>
  String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])

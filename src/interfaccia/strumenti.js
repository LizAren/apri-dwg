// ============================================================================
//  Gli strumenti: misura, proprietà, ricerca testo, blocchi, tavole, esporta.
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
import { FUNZIONI, LUCCHETTO, iconaDi } from './blocco.js'
import { geometriaNota, COLORI_NOTA, TIPI_NOTA } from '../modello/note.js'
import { confronta, COLORI_CONFRONTO } from '../modello/confronto.js'
import { calcolaEstensione } from '../modello/normalizza.js'

/** Quanti pixel attorno al puntatore si guardano per agganciare. */
const RAGGIO_PX = 16
/** Quanti pixel di tolleranza per dire «ho cliccato QUESTO». */
const TOLLERANZA_PX = 8

export class Strumenti {
  /**
   * @param {object} opzioni  tela, contenitori del DOM, formattatore di misure
   */
  constructor({ tela, barra, sezioneBarra, elenco, sezioneElenco, esito, cambiato, formato, formatoArea, visibile, esporta, chiediAccesso }) {
    this.tela = tela
    this.barra = barra
    this.sezioneBarra = sezioneBarra
    this.elenco = elenco
    this.sezioneElenco = sezioneElenco
    this.esito = esito
    this.cambiato = cambiato || (() => {})
    this.formato = formato
    this.formatoArea = formatoArea
    this.visibile = visibile
    this.esporta = esporta || {}
    this.chiediAccesso = chiediAccesso || (() => {})
    this.modello = null

    this.attivo = null
    this.indice = null
    this.spazio = null
    this.abilitate = new Set()

    this.punti = [] // misura
    this.note = new Map() // annotazioni, per spazio
    this.notaInCorso = null
    this.spazioPrima = null
    this.tipoNota = 'nuvola'
    this.coloreNota = COLORI_NOTA.rosso
    this.agganciato = null
    this.selezionata = null
    this.evidenziata = null

    this.tela.sovrapposizione = (ctx) => this._disegnaSopra(ctx)
    this._collega()
  }

  /** Il modello serve a chi mostra dati che non stanno nella geometria. */
  perModello(modello) {
    this.modello = modello
    this._disegnaElenco()
  }

  /** Il disegno è cambiato: l'indice va rifatto, e le misure non valgono più. */
  perSpazio(spazio) {
    this.spazio = spazio
    this.notaInCorso = null
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
  /** Le annotazioni dello spazio che si sta guardando. */
  noteQui() {
    if (!this.spazio) return []
    if (!this.note.has(this.spazio.id)) this.note.set(this.spazio.id, [])
    return this.note.get(this.spazio.id)
  }

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
    // Uscendo dal confronto si rimette il disegno vero: lasciare a schermo la
    // sovrapposizione colorata farebbe credere che il file sia quello.
    if (this.attivo === 'confronto' && nome !== 'confronto' && this.spazioPrima) {
      this.spazio = this.spazioPrima
      this.spazioPrima = null
      this.indice = null
      this.tela.mostra(this.spazio)
    }
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
      if (this.attivo !== 'note') return
      const [x, y] = this._punto(e)
      if (this.tipoNota === 'testo') return
      // Nuvola e freccia si tirano: si tiene fermo il primo punto e si segue
      // il dito fino a quando si lascia.
      this.notaInCorso = {
        tipo: this.tipoNota,
        colore: this.coloreNota,
        punti: [x, y, x, y],
        scala: 1 / this.tela.zoom,
      }
    })

    c.addEventListener('pointermove', (e) => {
      if (this.attivo === 'note' && this.notaInCorso) {
        const [x, y] = this._punto(e)
        this.notaInCorso.punti[2] = x
        this.notaInCorso.punti[3] = y
        this.tela.ridisegna()
        return
      }
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

      if (this.attivo === 'note') {
        const [x, y] = this._punto(e)
        if (this.notaInCorso) {
          const n = this.notaInCorso
          this.notaInCorso = null
          // Un trascinamento troppo corto è un clic andato storto, non una nota.
          if (mosso > 6) {
            this.noteQui().push(n)
            this._scriviEsito()
          }
          this.tela.ridisegna()
        } else if (this.tipoNota === 'testo' && mosso <= 4) {
          const testo = prompt('Testo della nota:')
          if (testo) {
            this.noteQui().push({
              tipo: 'testo', colore: this.coloreNota, testo,
              punti: [x, y], scala: 1 / this.tela.zoom,
            })
            this._scriviEsito()
            this.tela.ridisegna()
          }
        }
        return
      }

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

  /** Lo stato da salvare: quello che hai FATTO, mai il disegno. */
  lavoroCorrente() {
    return {
      versione: 1,
      spazio: this.spazio?.nome,
      vista: { cx: this.tela.cx, cy: this.tela.cy, zoom: this.tela.zoom },
      fondoChiaro: this.tela.fondoChiaro,
      layer: [...(this.tela.layerVisibili || [])],
      note: Object.fromEntries([...this.note].map(([k, v]) => [k, v])),
    }
  }

  applicaLavoro(l) {
    if (!l) return
    if (l.vista) {
      this.tela.cx = l.vista.cx
      this.tela.cy = l.vista.cy
      this.tela.zoom = l.vista.zoom
    }
    if (l.note) {
      this.note = new Map(Object.entries(l.note))
    }
    this.tela.ridisegna()
    this._scriviEsito()
  }

  async _pannelloSalva(e) {
    const { chiama } = await import('./accesso.js')
    const impronta = this.modello?.impronta
    if (!impronta) {
      e.innerHTML = '<p class="nota">Questo disegno non ha un\'impronta: il salvataggio non è disponibile.</p>'
      return
    }
    let elenco = []
    let mio = null
    try {
      elenco = (await chiama('lavori.php?action=elenco')).lavori
      mio = elenco.find((l) => l.impronta === impronta) || null
    } catch (err) {
      e.innerHTML = ''
      const p = document.createElement('p')
      p.className = 'nota'
      p.textContent = err.message
      e.appendChild(p)
      return
    }

    e.innerHTML =
      `<p class="nota">🔴 Si salva il <strong>lavoro</strong>, non il disegno: vista, ` +
      `layer accesi e annotazioni, legati all'impronta del file. Il DWG non sale ` +
      `da nessuna parte. Riaprendo lo stesso disegno il lavoro torna.</p>` +
      '<div class="recapiti">' +
      '<button type="button" class="comando primario" id="lav-salva">Salva il lavoro</button>' +
      (mio ? '<button type="button" class="comando" id="lav-link">Link di condivisione</button>' : '') +
      '</div>' +
      (mio ? `<p class="nota">Salvato il ${sicuro(mio.aggiornato_il)}.</p>` : '') +
      '<div id="lav-esito"></div>'

    e.querySelector('#lav-salva').addEventListener('click', async (ev) => {
      ev.target.disabled = true
      try {
        await chiama('lavori.php?action=salva', {
          method: 'POST',
          body: JSON.stringify({
            impronta,
            nome_file: this.modello.nomeFile,
            lavoro: this.lavoroCorrente(),
          }),
        })
        this._scriviEsito()
      } catch (err) {
        e.querySelector('#lav-esito').textContent = err.message
      } finally {
        ev.target.disabled = false
      }
    })

    const tastoLink = e.querySelector('#lav-link')
    if (tastoLink) {
      tastoLink.addEventListener('click', async () => {
        try {
          const r = await chiama('lavori.php?action=condividi', {
            method: 'POST',
            body: JSON.stringify({ id: mio.id }),
          })
          const url = `${location.origin}${location.pathname}?l=${r.condiviso}`
          const dove = e.querySelector('#lav-esito')
          dove.innerHTML = ''
          const p = document.createElement('p')
          p.className = 'nota'
          p.textContent =
            'Chi apre questo link vede le tue annotazioni sulla SUA copia del ' +
            'disegno: il file non viaggia.'
          const cod = document.createElement('code')
          cod.className = 'password'
          cod.style.fontSize = '12px'
          cod.textContent = url
          dove.append(cod, p)
        } catch (err) {
          e.querySelector('#lav-esito').textContent = err.message
        }
      })
    }
  }

  /**
   * Carica la seconda versione e mostra la sovrapposizione colorata al posto
   * del disegno. Lo spazio vero si tiene da parte: si torna indietro spegnendo
   * lo strumento.
   */
  async _confronta(file) {
    const esito = this.esito
    esito.innerHTML = '<p class="nota">Leggo la seconda versione…</p>'
    try {
      const { apriFile } = await import('../lettura/apri.js')
      const altro = await apriFile(file)
      const stessoNome = altro.spazi.find((s) => s.nome === this.spazio.nome)
      const spazioB = stessoNome || altro.spazi[0]
      const r = confronta(this.spazio, spazioB)
      this.spazioPrima = this.spazioPrima || this.spazio
      this.spazio = {
        id: 'confronto',
        nome: `Confronto con ${altro.nomeFile}`,
        carta: false,
        primitive: r.primitive,
        estensione: calcolaEstensione(r.primitive),
      }
      this.indice = null
      this.ultimoConfronto = { ...r, nome: altro.nomeFile }
      this.tela.mostra(this.spazio)
      this._scriviEsito()
    } catch (e) {
      esito.innerHTML = ''
      const p = document.createElement('p')
      p.className = 'nota'
      p.textContent = 'Non riesco a leggere quel file: ' + e.message
      esito.appendChild(p)
    }
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

    // Le annotazioni si vedono sempre, non solo con lo strumento acceso: sono
    // parte del lavoro, non un'anteprima.
    for (const n of this.noteQui()) this._disegnaNota(ctx, n)
    if (this.notaInCorso) this._disegnaNota(ctx, this.notaInCorso)

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

  _disegnaNota(ctx, n) {
    const altezza = (n.scala || 1 / this.tela.zoom) * 14
    const { spezzate, testi } = geometriaNota(n, altezza)
    ctx.save()
    ctx.strokeStyle = n.colore
    ctx.fillStyle = n.colore
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    for (const punti of spezzate) {
      if (punti.length < 4) continue
      ctx.beginPath()
      const [x0, y0] = this.tela.aSchermo(punti[0], punti[1])
      ctx.moveTo(x0, y0)
      for (let k = 2; k < punti.length; k += 2) {
        const [x, y] = this.tela.aSchermo(punti[k], punti[k + 1])
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    for (const t of testi) {
      const [x, y] = this.tela.aSchermo(t.x, t.y)
      const h = Math.max(11, t.altezza * this.tela.zoom)
      ctx.font = `600 ${h.toFixed(1)}px "Public Sans", system-ui, sans-serif`
      ctx.fillText(t.testo, x, y)
    }
    ctx.restore()
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

  /**
   * Due posti, e la differenza è il disegno aperto.
   *
   * Prima di aprire un file l'elenco laterale mostra TUTTE e nove le funzioni —
   * le tue in azzurro, le altre grigie col lucchetto: è lì che si capisce cosa
   * offre la pagina. Appena c'è un disegno le tue se ne vanno dall'elenco e
   * compaiono nella barra degli strumenti, dove servono davvero; nell'elenco
   * restano solo quelle da chiedere.
   *
   * Sono due viste dello stesso stato, non due elenchi: una funzione non
   * compare mai in due posti insieme.
   */
  _disegnaElenco() {
    const conDisegno = !!this.modello

    // --- barra degli strumenti: solo con un disegno aperto -------------------
    this.barra.innerHTML = ''
    for (const f of FUNZIONI) {
      if (!this.abilitate.has(f.id)) continue
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'attrezzo-tasto'
      b.setAttribute('aria-pressed', String(this.attivo === f.id))
      b.innerHTML = `${iconaDi(f.id)}<span>${f.breve || f.nome}</span>`
      b.addEventListener('click', () => this.attiva(f.id))
      this.barra.appendChild(b)
    }
    if (this.sezioneBarra) {
      this.sezioneBarra.hidden = !conDisegno || this.barra.children.length === 0
    }

    // --- elenco laterale ----------------------------------------------------
    this.elenco.innerHTML = ''
    for (const f of FUNZIONI) {
      const accesa = this.abilitate.has(f.id)
      // Con un disegno aperto le tue stanno nella barra: qui sarebbero doppie.
      if (accesa && conDisegno) continue
      const b = document.createElement('button')
      b.type = 'button'
      if (accesa) {
        b.className = 'voce accesa'
        b.disabled = true
        b.title = 'Apri un disegno per usarla'
        b.innerHTML = `${iconaDi(f.id)}<span class="voce-nome">${f.nome}</span>`
      } else {
        b.className = 'voce'
        b.setAttribute('aria-label', `${f.nome} — funzione su richiesta`)
        b.innerHTML = `${iconaDi(f.id)}<span class="voce-nome">${f.nome}</span>${LUCCHETTO}`
        b.addEventListener('click', () => this.chiediAccesso(f.id))
      }
      this.elenco.appendChild(b)
    }
    if (this.sezioneElenco) this.sezioneElenco.hidden = this.elenco.children.length === 0
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

    if (this.attivo === 'salva') {
      e.hidden = false
      e.innerHTML = '<p class="nota">Carico…</p>'
      this._pannelloSalva(e)
      return
    }

    if (this.attivo === 'confronto') {
      e.hidden = false
      const c = this.ultimoConfronto
      e.innerHTML =
        `<p class="nota">Carica un'altra versione dello stesso disegno. ` +
        `Si confronta l'identità geometrica: <span style="color:${COLORI_CONFRONTO.uguale}">grigio</span> ` +
        `quello che non è cambiato, <span style="color:${COLORI_CONFRONTO.tolto}">rosso</span> ` +
        `quello che non c'è più, <span style="color:${COLORI_CONFRONTO.aggiunto}">verde</span> il nuovo.</p>` +
        '<input type="file" id="confronto-file" accept=".dwg,.dxf" hidden>' +
        '<button type="button" class="comando primario" id="confronto-apri">Carica la seconda versione</button>' +
        (c
          ? `<dl class="rapporto"><dt>invariate</dt><dd>${c.uguali}</dd>` +
            `<dt>tolte</dt><dd>${c.tolte}</dd><dt>aggiunte</dt><dd>${c.aggiunte}</dd>` +
            `<dt>confrontato con</dt><dd>${sicuro(c.nome)}</dd></dl>` +
            `<p class="nota">⚠️ Un oggetto spostato risulta uno tolto e uno aggiunto: ` +
            `riconoscere lo spostamento vorrebbe dire indovinare le intenzioni.</p>`
          : '')
      const campo = e.querySelector('#confronto-file')
      e.querySelector('#confronto-apri').addEventListener('click', () => campo.click())
      campo.addEventListener('change', async (ev) => {
        const f = ev.target.files?.[0]
        if (f) await this._confronta(f)
        ev.target.value = ''
      })
      return
    }

    if (this.attivo === 'note') {
      e.hidden = false
      const note = this.noteQui()
      e.innerHTML =
        '<div class="scelte" id="tipi-nota">' +
        Object.entries(TIPI_NOTA)
          .map(
            ([id, nome]) =>
              `<button type="button" class="mini" data-tipo="${id}" ` +
              `aria-pressed="${this.tipoNota === id}">${nome}</button>`
          )
          .join('') +
        '</div>' +
        '<div class="scelte" id="colori-nota">' +
        Object.entries(COLORI_NOTA)
          .map(
            ([nome, col]) =>
              `<button type="button" class="pastiglia-colore" data-colore="${col}" ` +
              `title="${nome}" aria-pressed="${this.coloreNota === col}" ` +
              `style="background:${col}"></button>`
          )
          .join('') +
        '</div>' +
        `<p class="nota">🔴 Le annotazioni non toccano il disegno: restano ` +
        `accanto e finiscono nel PDF e nel PNG. Il DWG di partenza resta quello ` +
        `che era.</p>` +
        (note.length
          ? '<div class="cerca-esiti">' +
            note
              .map(
                (n, i) =>
                  `<div class="esito-riga"><span class="esito-testo">${
                    sicuro(n.tipo === 'testo' ? n.testo : TIPI_NOTA[n.tipo])
                  }</span><button type="button" class="mini" data-togli="${i}">togli</button></div>`
              )
              .join('') +
            '</div>'
          : '<p class="nota">Nessuna annotazione su questo spazio.</p>')

      for (const b of e.querySelectorAll('[data-tipo]')) {
        b.addEventListener('click', () => {
          this.tipoNota = b.dataset.tipo
          this._scriviEsito()
        })
      }
      for (const b of e.querySelectorAll('[data-colore]')) {
        b.addEventListener('click', () => {
          this.coloreNota = b.dataset.colore
          this._scriviEsito()
        })
      }
      for (const b of e.querySelectorAll('[data-togli]')) {
        b.addEventListener('click', () => {
          note.splice(+b.dataset.togli, 1)
          this._scriviEsito()
          this.tela.ridisegna()
        })
      }
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

const sicuro = (t) =>
  String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])

// ============================================================================
//  Accesso e amministrazione, lato interfaccia.
//
//  🔴 Quello che si vede qui NON è un permesso: è disegno. Il permesso lo
//  verifica il server a ogni chiamata (`richiediAdmin()` in api/admin.php).
//  Se qualcuno si mette in tasca un `ruolo: admin` nel browser ottiene di
//  vedere un pannello vuoto che riceve 403 su ogni pulsante.
//
//  🔴 Non esiste registrazione. Non c'è nessun modulo, in nessuna schermata,
//  che permetta di crearsi un account: li crea l'amministratore. Chi vuole
//  entrare scrive, e la richiesta parte dalle funzioni col lucchetto.
// ============================================================================

/**
 * Le funzioni che si possono assegnare a un account: quelle che ESISTONO
 * davvero. Sta scritto qui una volta sola — e lo stesso elenco è ripetuto in
 * `api/bootstrap.php`, che è l'unico posto dove conta davvero, perché il
 * server scarta quello che non riconosce.
 */
export const ASSEGNABILI = ['misura', 'proprieta', 'cerca', 'blocchi', 'tavole', 'dxf', 'note', 'confronto', 'salva']

const BASE = './api'
const CHIAVE_TOKEN = 'dwg-token'

export async function chiama(percorso, opzioni = {}) {
  const token = localStorage.getItem(CHIAVE_TOKEN)
  const risposta = await fetch(`${BASE}/${percorso}`, {
    ...opzioni,
    headers: {
      ...(opzioni.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opzioni.headers || {}),
    },
  })
  let dati = {}
  try {
    dati = await risposta.json()
  } catch {
    throw new Error('Il server ha risposto in un modo che non capisco.')
  }
  if (!risposta.ok || dati.ok === false) {
    throw new Error(dati.errore || `Errore ${risposta.status}.`)
  }
  return dati
}

export class Accesso {
  constructor({ tasto, finestra, finestraAdmin, cambiato }) {
    this.tasto = tasto
    this.finestra = finestra
    this.finestraAdmin = finestraAdmin
    this.cambiato = cambiato || (() => {})
    this.utente = null
    this._collega()
  }

  /**
   * All'avvio si chiede al server chi siamo. Se non c'è rete, o l'API non è
   * ancora stata caricata sul server, si prosegue senza account: il
   * visualizzatore deve funzionare comunque, perché non dipende dal server.
   */
  async riprendi() {
    if (!localStorage.getItem(CHIAVE_TOKEN)) {
      this._disegnaTasto()
      return
    }
    try {
      const r = await chiama('auth.php?action=me')
      this.utente = r.utente
    } catch {
      localStorage.removeItem(CHIAVE_TOKEN)
      this.utente = null
    }
    this._disegnaTasto()
    this.cambiato(this.utente)
  }

  get funzioni() {
    return this.utente?.funzioni || []
  }

  async entra(nome, password) {
    const r = await chiama('auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ nome_utente: nome, password }),
    })
    localStorage.setItem(CHIAVE_TOKEN, r.token)
    this.utente = r.utente
    this._disegnaTasto()
    this.cambiato(this.utente)
  }

  async esci() {
    try {
      await chiama('auth.php?action=logout', { method: 'POST' })
    } catch {
      /* se il server non risponde si esce lo stesso, da questa parte */
    }
    localStorage.removeItem(CHIAVE_TOKEN)
    this.utente = null
    this._disegnaTasto()
    this.cambiato(null)
  }

  // -------------------------------------------------------------------------

  _disegnaTasto() {
    if (!this.utente) {
      this.tasto.textContent = 'Accedi'
      this.tasto.classList.remove('acceso')
      return
    }
    this.tasto.textContent = this.utente.nome
    this.tasto.classList.add('acceso')
  }

  _collega() {
    this.tasto.addEventListener('click', () => this._apri())

    this.finestra.querySelector('#accedi-chiudi').addEventListener('click', () =>
      this.finestra.close()
    )
    this.finestra.querySelector('#accedi-fai').addEventListener('click', () => this._entra())
    this.finestra.querySelector('#accedi-esci').addEventListener('click', async () => {
      await this.esci()
      this.finestra.close()
    })
    this.finestra.querySelector('#accedi-admin').addEventListener('click', () => {
      this.finestra.close()
      this._apriAdmin()
    })
    this.finestra.querySelector('#accedi-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._entra()
    })

    this.finestraAdmin.querySelector('#admin-chiudi').addEventListener('click', () =>
      this.finestraAdmin.close()
    )
    this.finestraAdmin.querySelector('#admin-crea').addEventListener('click', () => this._crea())
    this.finestra.querySelector('#pw-fai').addEventListener('click', () => this._cambiaPassword())
  }

  _apri() {
    const entrato = !!this.utente
    this.finestra.querySelector('#accedi-modulo').hidden = entrato
    this.finestra.querySelector('#accedi-dentro').hidden = !entrato
    this.finestra.querySelector('#accedi-admin').hidden = this.utente?.ruolo !== 'admin'
    this.finestra.querySelector('#accedi-errore').hidden = true
    this.finestra.querySelector('#accedi-titolo').textContent = entrato
      ? `Ciao, ${this.utente.nome}`
      : 'Accedi'
    if (entrato) {
      const f = this.utente.funzioni
      this.finestra.querySelector('#accedi-funzioni').textContent = f.length
        ? `Funzioni abilitate: ${f.join(', ')}.`
        : 'Nessuna funzione abilitata su questo account.'
    }
    this.finestra.showModal()
    if (!entrato) this.finestra.querySelector('#accedi-nome').focus()
  }

  /**
   * Cambio della propria password. Il controllo vero — che quella vecchia sia
   * giusta e la nuova abbastanza lunga — lo fa il server: qui si mostra solo
   * quello che risponde.
   */
  async _cambiaPassword() {
    const esito = this.finestra.querySelector('#pw-esito')
    const vecchia = this.finestra.querySelector('#pw-vecchia')
    const nuova = this.finestra.querySelector('#pw-nuova')
    esito.hidden = true
    esito.classList.remove('riuscito')
    try {
      await chiama('auth.php?action=password', {
        method: 'POST',
        body: JSON.stringify({ vecchia: vecchia.value, nuova: nuova.value }),
      })
      vecchia.value = ''
      nuova.value = ''
      esito.textContent = 'Password cambiata. Le altre sessioni sono state chiuse.'
      esito.classList.add('riuscito')
      esito.hidden = false
    } catch (e) {
      esito.textContent = e.message
      esito.hidden = false
    }
  }

  async _entra() {
    const err = this.finestra.querySelector('#accedi-errore')
    const nome = this.finestra.querySelector('#accedi-nome').value.trim()
    const password = this.finestra.querySelector('#accedi-password').value
    err.hidden = true
    try {
      await this.entra(nome, password)
      this.finestra.querySelector('#accedi-password').value = ''
      this.finestra.close()
    } catch (e) {
      err.textContent = e.message
      err.hidden = false
    }
  }

  // -------------------------------------------------------------------------
  //  Pannello amministratore
  // -------------------------------------------------------------------------

  async _apriAdmin() {
    this.finestraAdmin.showModal()
    await this._elenco()
  }

  async _elenco() {
    const dove = this.finestraAdmin.querySelector('#admin-elenco')
    dove.innerHTML = '<p class="nota">Carico…</p>'
    try {
      const r = await chiama('admin.php?action=elenco')
      dove.innerHTML = ''
      for (const u of r.utenti) {
        dove.appendChild(this._riga(u))
      }
    } catch (e) {
      dove.innerHTML = ''
      const p = document.createElement('p')
      p.className = 'nota'
      p.textContent = e.message
      dove.appendChild(p)
    }
  }

  _riga(u) {
    const riga = document.createElement('div')
    riga.className = 'conto'

    const testa = document.createElement('div')
    testa.className = 'conto-testa'
    const nome = document.createElement('strong')
    nome.textContent = u.nome
    const ruolo = document.createElement('span')
    ruolo.className = 'conto-ruolo'
    ruolo.textContent = u.ruolo === 'admin' ? 'amministratore' : u.attivo ? 'attivo' : 'disattivato'
    testa.append(nome, ruolo)

    const funzioni = document.createElement('div')
    funzioni.className = 'conto-funzioni'
    for (const f of ASSEGNABILI) {
      const et = document.createElement('label')
      const casella = document.createElement('input')
      casella.type = 'checkbox'
      casella.checked = u.funzioni.includes(f)
      casella.disabled = u.ruolo === 'admin'
      casella.addEventListener('change', async () => {
        const scelte = [...funzioni.querySelectorAll('input')]
          .map((c, i) => (c.checked ? ASSEGNABILI[i] : null))
          .filter(Boolean)
        await this._azione('funzioni', { id: u.id, funzioni: scelte })
      })
      et.append(casella, document.createTextNode(f))
      funzioni.appendChild(et)
    }

    const comandi = document.createElement('div')
    comandi.className = 'conto-comandi'
    if (u.ruolo !== 'admin') {
      comandi.append(
        this._mini(u.attivo ? 'disattiva' : 'riattiva', () =>
          this._azione('stato', { id: u.id, attivo: !u.attivo })
        ),
        this._mini('nuova password', async () => {
          const r = await this._azione('azzera-password', { id: u.id }, false)
          if (r) this._mostraPassword(u.nome, r.password)
        }),
        this._mini('elimina', () => {
          if (confirm(`Eliminare l'account «${u.nome}»? Non si torna indietro.`)) {
            this._azione('elimina', { id: u.id })
          }
        })
      )
    }

    const quando = document.createElement('p')
    quando.className = 'nota'
    quando.textContent = u.ultimo_accesso
      ? `ultimo accesso ${u.ultimo_accesso}`
      : 'non è mai entrato'

    riga.append(testa, funzioni, comandi, quando)
    return riga
  }

  _mini(testo, azione) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'mini'
    b.textContent = testo
    b.addEventListener('click', azione)
    return b
  }

  async _azione(azione, corpo, ricarica = true) {
    try {
      const r = await chiama(`admin.php?action=${azione}`, {
        method: 'POST',
        body: JSON.stringify(corpo),
      })
      if (ricarica) await this._elenco()
      return r
    } catch (e) {
      alert(e.message)
      return null
    }
  }

  async _crea() {
    const campo = this.finestraAdmin.querySelector('#admin-nuovo')
    const nome = campo.value.trim()
    if (!nome) return
    try {
      const r = await chiama('admin.php?action=crea', {
        method: 'POST',
        // Un account nuovo nasce con tutto acceso: togliere una casella è più
        // rapido che spuntarne sei, e chi crea l'account sa già a chi lo dà.
        body: JSON.stringify({ nome_utente: nome, funzioni: ASSEGNABILI }),
      })
      campo.value = ''
      this._mostraPassword(r.nome, r.password)
      await this._elenco()
    } catch (e) {
      alert(e.message)
    }
  }

  /**
   * 🔴 La password si vede UNA volta sola: nel database c'è solo l'impronta e
   * nessuno potrà rileggerla, nemmeno l'amministratore. Meglio dirlo che farlo
   * scoprire.
   */
  _mostraPassword(nome, password) {
    const dove = this.finestraAdmin.querySelector('#admin-password')
    dove.hidden = false
    dove.innerHTML = ''
    const t = document.createElement('p')
    t.innerHTML = `Account <strong></strong> — password:`
    t.querySelector('strong').textContent = nome
    const c = document.createElement('code')
    c.className = 'password'
    c.textContent = password
    const n = document.createElement('p')
    n.className = 'nota'
    n.textContent =
      'Si vede solo adesso: nel database resta solo l\'impronta. Copiarla e comunicarla all\'interessato.'
    dove.append(t, c, n)
  }
}

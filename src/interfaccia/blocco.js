// ============================================================================
//  Le funzioni bloccate.
//
//  Non c'è registrazione automatica e non c'è pagamento automatico: chi vuole
//  una di queste funzioni scrive o telefona, e l'account lo crea
//  l'amministratore a mano.
//
//  Non è un ripiego tecnico, è la forma giusta per questo sito: il portfolio
//  esiste per un solo evento — che il visitatore scriva o telefoni. Una
//  funzione bloccata con recapiti già compilati È l'invito al contatto, e non
//  una pagina di iscrizione da mantenere.
//
//  🔴 Il lucchetto non è colorato con l'accento: è uno stato, non un invito
//  luminoso. Le voci si vedono, si capisce cosa fanno, e non fingono di essere
//  disponibili.
// ============================================================================

const MAIL = 'fostinellistefano@gmail.com'

export const FUNZIONI = [
  {
    id: 'misura',
    nome: 'Misura con aggancio',
    che: 'distanze, angoli e aree prese sul disegno, con aggancio a estremi, centri e intersezioni',
  },
  {
    id: 'proprieta',
    nome: 'Proprietà al clic',
    che: 'layer, tipo, lunghezza e coordinate dell\'elemento che tocchi',
  },
  {
    id: 'cerca',
    nome: 'Ricerca testo',
    che: 'trova una scritta nel disegno e ti ci porta',
  },
  {
    id: 'dxf',
    nome: 'Export in DXF e PNG',
    che: 'per riaprire il disegno in un altro CAD, o per infilarlo in un preventivo',
  },
  {
    id: 'note',
    nome: 'Annotazioni',
    che: 'nuvole di revisione, frecce e note sopra il disegno — l\'originale resta intatto',
  },
  {
    id: 'blocchi',
    nome: 'Elenco blocchi con conteggio',
    che: 'quante volte compare ogni blocco: un computo grezzo, gratis',
  },
  {
    id: 'tavole',
    nome: 'Tutti i layout in un PDF solo',
    che: 'invece di una tavola per volta',
  },
  {
    id: 'salva',
    nome: 'Salvataggio e condivisione',
    che: 'ritrovi il disegno la volta dopo e mandi un link con vista, layer e misure',
  },
  {
    id: 'confronto',
    nome: 'Confronto fra due versioni',
    che: 'le due revisioni affiancate, con le differenze evidenziate',
  },
]

const LUCCHETTO = `<svg class="lucchetto" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">
  <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
  <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
</svg>`

/**
 * Riempie l'elenco delle funzioni bloccate e collega il pannello di richiesta.
 */
export function montaBloccate(contenitore, finestra) {
  const titolo = finestra.querySelector('#accesso-titolo')
  const testo = finestra.querySelector('#accesso-testo')
  const mail = finestra.querySelector('#accesso-mail')

  for (const f of FUNZIONI) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'voce'
    b.innerHTML = `${LUCCHETTO}<span>${f.nome}</span>`
    b.setAttribute('aria-label', `${f.nome} — funzione su richiesta`)
    b.addEventListener('click', () => {
      titolo.textContent = f.nome
      testo.textContent = `${maiuscola(f.che)}.`
      const oggetto = encodeURIComponent(`Accesso alla funzione «${f.nome}» del visualizzatore DWG`)
      const corpo = encodeURIComponent(
        `Ciao Stefano,\n\nvorrei l'accesso alla funzione «${f.nome}» del visualizzatore DWG.\n\n` +
        `Ti scrivo da:\nNome:\nAttività:\nA cosa mi serve:\n\nGrazie.`
      )
      mail.href = `mailto:${MAIL}?subject=${oggetto}&body=${corpo}`
      finestra.showModal()
    })
    contenitore.appendChild(b)
  }

  finestra.querySelector('#accesso-chiudi').addEventListener('click', () => finestra.close())
}

const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1)

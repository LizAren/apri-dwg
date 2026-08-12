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

/**
 * Le icone sono DISEGNATE qui, non prese da una libreria: una sola griglia
 * (24), un solo tratto (1,6), estremi arrotondati. Una raccolta pronta —
 * Lucide, Heroicons — si riconosce a colpo d'occhio ed è uno dei segnali che
 * `docs/contesto/estetica.md` elenca fra quelli da evitare: fa sembrare il sito
 * montato in mezz'ora. Queste invece dicono *quale* strumento è: il righello ha
 * le tacche, la quota ha le frecce, il confronto ha due tavole sovrapposte.
 */
const D = {
  misura:
    '<path d="M3 9h18v6H3z"/><path d="M7.5 9v3M12 9v4M16.5 9v3"/>',
  proprieta:
    '<path d="M3 4.5h9v9H3z"/><path d="M15.5 7h5.5M15.5 11h5.5M15.5 15h3.5"/>' +
    '<path d="M12 13.5l4 6 1.2-2.6 2.6-1.2z" fill="currentColor"/>',
  cerca:
    '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>' +
    '<path d="M7.8 9h5.4M7.8 12h3.4"/>',
  dxf:
    '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>' +
    '<path d="M12 10.5v6M9.4 14l2.6 2.6 2.6-2.6"/>',
  note:
    '<path d="M4 20l1-3.6L15.6 5.8a1.7 1.7 0 0 1 2.4 0l1.2 1.2a1.7 1.7 0 0 1 0 2.4L8.6 20z"/>' +
    '<path d="M14.4 7l2.6 2.6"/>',
  blocchi:
    '<path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7z"/>' +
    '<path d="M13.5 13.5h7v7h-7z" stroke-dasharray="2.4 2.2"/>',
  tavole:
    '<path d="M3.5 6.5v14h11"/><path d="M8 3.5h8.5l4 4v13H8z"/><path d="M16.5 3.5v4h4"/>',
  salva:
    '<path d="M7.2 17.5a4 4 0 0 1 .6-8 5 5 0 0 1 9.2-1.3 3.8 3.8 0 1 1 .5 9.3z"/>' +
    '<path d="M12 20.5v-7M9.4 16l2.6-2.6 2.6 2.6"/>',
  confronto:
    '<path d="M3.5 4.5h17v15h-17z"/><path d="M12 4.5v15"/>' +
    '<path d="M14.6 9h3.8M14.6 12h3.8M14.6 15h2.4"/>',
}

const icona = (id) =>
  `<svg class="attrezzo" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `${D[id] || ''}</svg>`

export const FUNZIONI = [
  {
    id: 'misura',
    breve: 'Misura',
    nome: 'Misura con aggancio',
    che: 'distanze, angoli e aree prese sul disegno, con aggancio a estremi, centri e intersezioni',
  },
  {
    id: 'proprieta',
    breve: 'Proprietà',
    nome: 'Proprietà al clic',
    che: 'layer, tipo, lunghezza e coordinate dell\'elemento che tocchi',
  },
  {
    id: 'cerca',
    breve: 'Cerca testo',
    nome: 'Ricerca testo',
    che: 'trova una scritta nel disegno e ti ci porta',
  },
  {
    id: 'dxf',
    breve: 'Esporta',
    nome: 'Export in DXF e PNG',
    che: 'per riaprire il disegno in un altro CAD, o per infilarlo in un preventivo',
  },
  {
    id: 'note',
    breve: 'Annota',
    nome: 'Annotazioni',
    che: 'nuvole di revisione, frecce e note sopra il disegno — l\'originale resta intatto',
  },
  {
    id: 'blocchi',
    breve: 'Blocchi',
    nome: 'Elenco blocchi con conteggio',
    che: 'quante volte compare ogni blocco: un computo grezzo, gratis',
  },
  {
    id: 'tavole',
    breve: 'Tavole',
    nome: 'Tutti i layout in un PDF solo',
    che: 'invece di una tavola per volta',
  },
  {
    id: 'salva',
    breve: 'Salva',
    nome: 'Salvataggio e condivisione',
    che: 'ritrovi il disegno la volta dopo e mandi un link con vista, layer e misure',
  },
  {
    id: 'confronto',
    breve: 'Confronta',
    nome: 'Confronto fra due versioni',
    che: 'le due revisioni affiancate, con le differenze evidenziate',
  },
]

export const LUCCHETTO = `<svg class="lucchetto" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">
  <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
  <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
</svg>`

export const iconaDi = icona

/**
 * Collega il pannello «accesso su richiesta» e restituisce la funzione da
 * chiamare quando si clicca una voce col lucchetto.
 *
 * ⚠️ Prima questo modulo disegnava anche l'elenco. Ora l'elenco è UNO SOLO —
 * accese e bloccate insieme, con due aspetti diversi — e lo disegna chi
 * conosce lo stato degli strumenti. Due elenchi facevano comparire due volte
 * la stessa funzione appena veniva accesa.
 */
export function collegaRichiesta(finestra) {
  const titolo = finestra.querySelector('#accesso-titolo')
  const testo = finestra.querySelector('#accesso-testo')
  const mail = finestra.querySelector('#accesso-mail')
  finestra.querySelector('#accesso-chiudi').addEventListener('click', () => finestra.close())

  return (id) => {
    const f = FUNZIONI.find((x) => x.id === id)
    if (!f) return
    titolo.textContent = f.nome
    testo.textContent = `${maiuscola(f.che)}.`
    const oggetto = encodeURIComponent(`Accesso alla funzione «${f.nome}» del visualizzatore DWG`)
    const corpo = encodeURIComponent(
      `Ciao Stefano,\n\nvorrei l'accesso alla funzione «${f.nome}» del visualizzatore DWG.\n\n` +
      `Ti scrivo da:\nNome:\nAttività:\nA cosa mi serve:\n\nGrazie.`
    )
    mail.href = `mailto:${MAIL}?subject=${oggetto}&body=${corpo}`
    finestra.showModal()
  }
}

const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1)

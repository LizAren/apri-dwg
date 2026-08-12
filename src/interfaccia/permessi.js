// ============================================================================
//  Chi ha cosa.
//
//  🔴 PROVVISORIO, e dichiarato tale. Oggi le funzioni si accendono da qui, cioè
//  dal browser: non c'è ancora nessun account. Quando arriverà l'accesso, questo
//  file cambierà una riga sola — l'elenco arriverà dal server invece che da
//  `localStorage` — e tutto il resto del programma non se ne accorgerà, perché
//  chiede solo `funzioniAbilitate()`.
//
//  ⚠️ E resterà comunque una scena, anche col server: il codice è pubblico sotto
//  GPL-3 e gira nel browser di chi visita. Chi sa riaccendere un interruttore
//  saprebbe anche riscriversi il visualizzatore. Il permesso serve a dire cosa
//  offriamo e a far scrivere chi è interessato, non a difendere un segreto —
//  quello arriverà solo con le funzioni che stanno sul server (salvataggio,
//  condivisione), dove il controllo lo fa il server e non si aggira.
// ============================================================================

const CHIAVE = 'dwg-funzioni'

/** Tutte le funzioni che esistono davvero, oggi. */
export const ESISTENTI = ['misura', 'proprieta', 'cerca']

/**
 * Elenco delle funzioni accese per chi sta guardando.
 *
 * Si può accendere in due modi, entrambi pensati per le dimostrazioni:
 *   …/DWG/?f=misura,cerca   accende quelle e le ricorda
 *   …/DWG/?f=tutte          accende tutto ciò che esiste
 *   …/DWG/?f=               spegne
 */
export function funzioniAbilitate() {
  const url = new URLSearchParams(location.search)
  if (url.has('f')) {
    const grezzo = url.get('f').trim()
    const elenco = !grezzo
      ? []
      : grezzo === 'tutte'
        ? ESISTENTI.slice()
        : grezzo.split(',').map((s) => s.trim()).filter((s) => ESISTENTI.includes(s))
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(elenco))
    } catch {
      /* navigazione privata: pazienza, vale per questa visita */
    }
    return elenco
  }
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE) || '[]')
    return Array.isArray(salvato) ? salvato.filter((s) => ESISTENTI.includes(s)) : []
  } catch {
    return []
  }
}

# DWG — visualizzatore e convertitore in PDF

Apre disegni **DWG e DXF nel browser** e li converte in **PDF vettoriale in
scala**. Tutto lato utente: il file **non viene caricato da nessuna parte**.

**Stato: online dal 12/08/2026** su
[www.fostinellistefano.it/DWG/](https://www.fostinellistefano.it/DWG/), sorgente
pubblico su [github.com/LizAren/apri-dwg](https://github.com/LizAren/apri-dwg).
Si apre, si guarda, si stampa; le funzioni avanzate si vedono bloccate e portano
al contatto.
Lo studio completo è in [`docs/contesto/dwg.md`](../docs/contesto/dwg.md).

## Come si usa

```bash
npm install
npm run dev        # sviluppo, apre su localhost
npm run build      # produce dist/ (~13 MB: il lettore DWG intero più la sua copia compressa)
npm run verifica   # 85 controlli misurati sui file di prova
node strumenti/schermate.mjs      # apre l'app in un browser vero e la fotografa
node strumenti/prova-accesso.mjs  # accesso e account con PHP e MySQL veri
./deploy-dwg.sh --build        # compila e pubblica su Altervista
```

## Cosa c'è

| Cartella | Cosa |
|---|---|
| `src/lettura/` | riconosce il formato e legge: `dwg.js` (LibreDWG in WebAssembly), `dxf.js` (testo) |
| `src/modello/` | da entità del file a **due sole primitive**: spezzate e testi. Colori ACI, unità, geometria |
| `src/vista/` | la tela: Canvas 2D, spostamento, ingrandimento, layer |
| `src/esporta/` | PDF vettoriale in millimetri con la scala dichiarata, DXF e PNG |
| `src/interfaccia/` | le funzioni bloccate e la richiesta di accesso |
| `src/vista/aggancio.js` | indice spaziale, selezione e aggancio (estremo, centro, intersezione, medio) |
| `api/` | PHP: accesso e account. 🔴 `config.php` non è qui e non si carica mai |
| `strumenti/` | `verifica.mjs` (dati), `schermate.mjs` (pixel), `prova-accesso.mjs` (PHP e database veri), `prepara-avvio.mjs` (script usa e getta) |
| `prove/file/` | quattro DWG veri (r2000, r2004, r2007, r2018) più un DXF a geometria nota |

## Le regole non negoziabili di questa cartella

1. 🔴 **Progetto a sé: non si riusa nulla.** Né l'autenticazione di
   `allenamento/`, né i CSS del portfolio, né gli script di deploy degli altri.
   L'unica cosa fisicamente condivisa sarà il database di Altervista, per cui
   **tutte le tabelle avranno il prefisso `dwg_`**.
2. 🔴 **GPL-3.** Si usa LibreDWG, quindi il browser del visitatore riceve una
   copia del `.wasm`: è distribuzione. Il codice di questa cartella va sotto
   **GPL-3** in un **repository pubblico separato**. La dichiarazione di licenza
   sta **nella pagina**, e `deploy-dwg.sh` **si rifiuta di pubblicare** se
   sparisce.
3. 🔴 **Tutto nel browser.** Su Altervista non gira nessuna conversione: 10 MB
   per upload, 30 secondi di esecuzione, nessun binario.
4. 🔴 **Il PDF si genera dalle entità, non dallo schermo**, in millimetri, con
   la **scala dichiarata** e leggendo le **unità del disegno** (`$INSUNITS`) dal
   file. E la scala automatica sale sempre al gradino **normalizzato** (1-2-5 ×
   10ⁿ): «1:10822» non è una scala che qualcuno possa usare per misurare.
5. 🔴 **Il DWG si legge, non si riscrive.** «Modificare» qui significa
   annotazioni salvate a parte, export DXF o PDF. Detto in pagina.
6. 🔴 **`api/config.php` non si carica MAI** sul server, e non compare in
   nessuno script di deploy.
7. **Niente registrazione automatica.** Non esiste nessun percorso, in nessun
   verso, che permetta a chi passa di crearsi un account: li crea
   l'amministratore. E **il `ruolo` non si accetta mai dal client** — un account
   creato dall'API è sempre `utente`. Il primo amministratore nasce dallo
   script usa e getta (`strumenti/prepara-avvio.mjs`), che si cancella da solo
   e rifiuta di rifarlo se esiste già.
8. 🔴 **Quello che si vede nell'interfaccia non è un permesso.** Il permesso lo
   verifica il server a ogni chiamata. Chi si mette in tasca un `ruolo: admin`
   nel browser ottiene un pannello vuoto che prende 403 su ogni pulsante —
   verificato in `prova-accesso.mjs`.
9. ⚠️ **Il blocco delle funzioni che girano nel browser è una scena, per
   scelta.** Il codice è GPL-3 e sta sul computer di chi visita: chi sa
   riaccendere un interruttore saprebbe riscriversi il visualizzatore. Serve a
   dire cosa c'è e a far scrivere chi è interessato. Quello che il permesso
   protegge davvero arriverà con le funzioni che stanno sul server.
10. 🔴 **Quello che non si sa disegnare finisce nel rapporto di lettura**, non
    sparisce. C'è una rete di sicurezza: se un tipo che dichiariamo di saper
    disegnare non produce niente, viene contato lo stesso.

## Cose imparate qui, che non si indovinano

- **Gli angoli.** LibreDWG li dà in **radianti**, `dxf-parser` dà le rotazioni
  di testi e blocchi in **gradi**. La conversione sta tutta nell'adattatore DXF:
  `prove/file/prova-geometria.dxf` ha un'estensione calcolabile a mano
  (`[0, -50, 500, 510]`) proprio per accorgersene se sparisce.
- **L'estensione non si legge dall'intestazione.** In `example_2018.dwg`
  EXTMIN/EXTMAX valgono ±2,6 milioni per via di una retta infinita. Si calcola
  sulla geometria, escludendo `RAY` e `XLINE`.
- **Il colore del layer sta nell'INDICE, non nel colore a 24 bit.** LibreDWG
  riempie il campo del colore vero con `0xFFFFFF` su ogni layer: dandogli la
  precedenza, il disegno usciva tutto bianco.
- **Le quote non si ridisegnano**: ogni `DIMENSION` porta il nome di un blocco
  anonimo che contiene già linee, frecce e testo come li ha messi il CAD.
- **Anche lo spazio modello contiene un `VIEWPORT`** — è la finestra attiva del
  CAD. Disegnarlo mette una cornice che nel disegno non esiste.
- **Negli `ATTRIB` il testo è annidato** sotto `text`, nei `TEXT` no. Trattarli
  uguale scrive `[object Object]` sul disegno.
- **Il codice di errore di LibreDWG sotto 128 è un avviso**, non un fallimento:
  tutti e quattro i file di prova lo restituiscono e si leggono benissimo.
- **`hidden` perde contro qualsiasi `display` dichiarato nel foglio di stile.**
  Il pannello d'ingresso restava sopra il disegno e sembrava che il disegno non
  ci fosse: si è visto solo guardando una schermata.

## Numeri veri, misurati online

| | Valore |
|---|---|
| Pagina che si apre | ~1,1 s |
| Primo DWG aperto (compreso lo scaricamento del lettore) | **5,5 s** |
| Peso del lettore trasferito | **2,16 MB** compressi (9,5 MB il file) |
| Aperture di DWG dentro i 10 GB/mese | ~4.600 |

🔴 **Altervista non comprime il `.wasm`.** Comprime il JavaScript, ma il
WebAssembly lo serve intero e non basta chiederglielo in `.htaccess`: la copia
compressa la prepara `strumenti/comprimi.mjs` alla pubblicazione, e `.htaccess`
la serve al posto dell'originale. Senza, sono 9,5 MB e 14 secondi per ogni
apertura. Il numero misurato in locale non era quello che riceveva la gente.

## Le funzioni, e cosa sono davvero

Sei esistono e si accendono da un account; tre no, e non è una dimenticanza.

| Funzione | Stato |
|---|---|
| Misura con aggancio | ✅ estremo, centro, intersezione, punto medio, sulla linea |
| Proprietà al clic | ✅ tipo, layer, colore, spessore, lunghezza, area, raggio, handle |
| Ricerca testo | ✅ trova e porta in vista |
| Elenco blocchi | ✅ conteggio degli inserimenti (⚠️ non è un computo metrico) |
| Tutte le tavole in un PDF | ✅ una pagina per spazio, ognuna con la sua scala |
| Export DXF e PNG | ✅ 🔴 esporta la GEOMETRIA, non il file: blocchi espansi, quote diventate linee |
| Annotazioni | ❌ da fare |
| Salvataggio e condivisione | ❌ serve spazio sul server: quota, scadenza, dati di clienti |
| Confronto fra versioni | ❌ da fare |

🔴 **L'export DXF si verifica rileggendolo con il nostro stesso lettore**: è
l'unico modo per sapere se quello che esce è un DXF vero. Scarto misurato
sull'estensione: **0,000%**.

🔴 **L'amministratore ha tutte le funzioni per definizione**, non riga per riga:
senza quella regola, aggiungendone una nuova sarebbe l'unico a non averla e non
potrebbe nemmeno accendersela.

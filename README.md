# Cianotipo

Visualizzatore **DWG/DXF** e convertitore in **PDF vettoriale in scala** che
gira **interamente nel browser**. Nessun server, nessun caricamento: il disegno
non lascia il computer di chi lo apre.

Online su **[www.fostinellistefano.it/DWG/](https://www.fostinellistefano.it/DWG/)**.

> *An in-browser DWG/DXF viewer and vector-PDF converter. Everything runs
> client-side — drawings are never uploaded. Source in Italian; licensed
> GPL-3.0-or-later because it links GNU LibreDWG.*

## Cosa fa

- apre **DWG dalla r13 (1994) alla r2018** e **DXF**, riconoscendo il formato
  dai byte del file e non dall'estensione;
- disegna spazio modello e **layout**, portando dentro le viste il contenuto del
  modello, ritagliato ai bordi della finestra;
- pannello **layer** con i colori veri, accendi/spegni, fondo bianco o scuro;
- **converte in PDF vettoriale**: formato da A4 ad A0, orientamento, scala
  normalizzata, tutto in nero, piè di pagina con scala e unità;
- **rapporto di lettura**: dice cosa non è stato disegnato — riferimenti esterni
  non risolti, entità proxy, font SHX sostituiti — invece di nasconderlo.

Non modifica i DWG e non li riscrive: LibreDWG scrive solo r13-r2000 e nella
build WebAssembly la scrittura è disattivata. Qui il DWG **si legge**.

## Come si costruisce

```bash
npm install
npm run dev        # sviluppo
npm run build      # produce dist/
npm run verifica   # 66 controlli misurati sui file di prova
node strumenti/schermate.mjs   # apre l'app in un browser vero e la misura
```

`dist/` pesa ~11 MB, di cui 9,5 sono il `.wasm` di LibreDWG (2,26 MB
compressi). Viene scaricato **solo aprendo un DWG**: chi arriva sulla pagina o
apre un DXF non lo tocca.

## Licenza

**GPL-3.0-or-later.** Vedi [LICENSE](LICENSE).

Questo programma usa **[GNU LibreDWG](https://www.gnu.org/software/libredwg/)**
(GPL-3) tramite [`@mlightcad/libredwg-web`](https://github.com/mlightcad/libredwg-web),
il cui `.wasm` viene distribuito al browser di chi visita la pagina: è a tutti
gli effetti distribuzione, quindi anche questo codice è GPL-3 e il suo sorgente
è disponibile qui.

Le altre dipendenze — [jsPDF](https://github.com/parallax/jsPDF) e
[dxf-parser](https://github.com/gdsestimating/dxf-parser) — sono MIT.

I file in [`prove/file/`](prove/file/) hanno provenienza dichiarata in
[`prove/LEGGIMI.md`](prove/LEGGIMI.md).

## Documentazione

- [`LEGGIMI.md`](LEGGIMI.md) — com'è fatto dentro, e **le trappole del formato
  già pagate**: angoli in radianti o in gradi a seconda del lettore, estensione
  che non si legge dall'intestazione, colore del layer che sta nell'indice, quote
  che si disegnano dal loro blocco anonimo.

## Autore

Stefano Fostinelli — [fostinellistefano.it](https://www.fostinellistefano.it)

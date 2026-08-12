# File di prova — provenienza e licenza

Servono a rispondere a una domanda sola: **quello che esce è un disegno o è
spazzatura?** Sono misurati da `npm run verifica` e aperti in un browser vero da
`node strumenti/schermate.mjs`.

| File | Da dove viene | Licenza |
|---|---|---|
| `example_2000.dwg`, `example_2004.dwg`, `example_2007.dwg`, `example_2018.dwg` | suite di test di [GNU LibreDWG](https://github.com/LibreDWG/libredwg), cartella `test/test-data/` | GPL-3, come il progetto da cui provengono |
| `prova-geometria.dxf` | costruito qui, con uno script | stessa licenza di questo repository |

## Perché quattro versioni dello stesso disegno

Sono lo stesso contenuto salvato in quattro formati diversi (2000, 2004, 2007,
2018). Servono a verificare che il lettore non si comporti diversamente da una
versione all'altra — ed è utile che siano file **scomodi**: contengono un
`3DSOLID`, una `ACAD_TABLE`, un `MULTILEADER`, due `WIPEOUT` e una `TOLERANCE`
che il visualizzatore non sa disegnare, ed è giusto che finiscano nel rapporto
di lettura invece di sparire.

⚠️ Contengono anche un `INSERT` con **scala ×3256**: il disegno si estende
davvero per 3,4 km, e AutoCAD stesso scrive quei numeri in EXTMIN/EXTMAX. Non è
un difetto del lettore — è stato scambiato per tale al primo giro di verifica.

## `prova-geometria.dxf`: il file che sa la risposta

È l'unico con un risultato **calcolabile a mano**. Contiene:

- una linea da (0,0) a (100,0) sul layer `MURI` (rosso);
- un cerchio di raggio 50 centrato in (200,0);
- un arco di raggio 100 centrato in (0,100), **da 0° a 90°**;
- il testo `PROVA` in (200,200), **ruotato di 90°**;
- un blocco quadrato 10×10 inserito in (500,500), **ruotato di 90°**.

Estensione attesa: **`[0, −50, 500, 510]`**.

🔴 Serve a sorvegliare una cosa sola: `dxf-parser` restituisce le rotazioni di
testi e blocchi in **gradi**, LibreDWG le dà in **radianti**. Se quella
conversione sparisse dall'adattatore DXF, l'inserimento girerebbe di 90
**radianti** (≈ 5157°) e questi numeri cambierebbero di colpo. Scarto misurato
oggi: **0,0000**.

## Cosa manca ancora

I file qui dentro sono **sani per costruzione**. Quelli veri dei clienti no:
hanno riferimenti esterni non risolti, font SHX, oggetti proxy di Civil 3D o
Revit, e a volte sono grandi. Prima di dire che il visualizzatore funziona
davvero servono due o tre disegni **di lavoro**.

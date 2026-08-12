#!/usr/bin/env bash
# ============================================================================
#  Pubblicazione della sezione DWG su Altervista.
#
#  Script PROPRIO di questa cartella: non è copiato da quelli delle altre app,
#  e non ne condivide niente se non la tecnica di trasporto, che su questo host
#  è l'unica che funziona.
#
#  ⚠️  Carica SOLO il contenuto di dist/. Rifiuta per costruzione qualsiasi
#      config.php e qualsiasi cartella api/: sul server quella è la
#      configurazione di produzione e sovrascriverla fa cadere l'applicazione.
#      (Qui api/ non esiste ancora — esisterà con gli account — e il divieto
#      c'è già, perché il momento in cui servirà è il momento in cui nessuno
#      si ricorderà di aggiungerlo.)
#
#  Trasporto: FTP SEMPLICE, una connessione nuova per file. L'FTPS di questo
#  host dà 451 casuali sul canale dati, e riusare una connessione sola fa
#  fallire l'intero caricamento.
#
#  Il .wasm di LibreDWG pesa 9,5 MB: il primo caricamento è lento, ma il nome
#  contiene l'impronta del contenuto, quindi finché non cambia la libreria non
#  viene ricaricato.
#
#  Uso:
#     ./deploy-dwg.sh --build     compila e poi carica
#     ./deploy-dwg.sh             carica dist/ così com'è
# ============================================================================
set -euo pipefail

QUI="$(cd "$(dirname "$0")" && pwd)"
RADICE="$(cd "$QUI/.." && pwd)"
CRED="$RADICE/docs/ALTERVISTA.html"
REMOTA="DWG"
SLEEP="${SLEEP:-1}"
TRIES="${TRIES:-4}"

if [ "${1:-}" = "--build" ]; then
  echo "▸ Compilo…"
  ( cd "$QUI" && npm run build )
fi

[ -d "$QUI/dist" ] || { echo "❌ Manca dist/: lancia ./deploy-dwg.sh --build"; exit 1; }
[ -f "$CRED" ]     || { echo "❌ Credenziali non trovate: $CRED"; exit 1; }

# --- Verifiche prima di toccare il server -----------------------------------
if ! grep -q "GNU LibreDWG" "$QUI/dist/index.html"; then
  echo "❌ dist/index.html non cita LibreDWG: la GPL-3 richiede che la"
  echo "   dichiarazione di licenza sia nella pagina pubblicata. Non carico."
  exit 1
fi

# La licenza va pubblicata insieme al programma, non solo tenuta nel repo.
cp -f "$QUI/LICENSE" "$QUI/dist/LICENSE"

ELENCO=()
while IFS= read -r f; do ELENCO+=("$f"); done < <(cd "$QUI/dist" && find . -type f | sed 's|^\./||' | sort)

for f in "${ELENCO[@]}"; do
  case "$f" in
    */api/*|api/*) echo "❌ RIFIUTO: $f sta in api/."; exit 1;;
    *config.php)   echo "❌ RIFIUTO: config.php non si carica MAI."; exit 1;;
  esac
done

eval "$(perl -0777 -ne '
  my $t=$_; $t=~s/<[^>]+>/ /g; $t=~s/&nbsp;/ /g;
  for my $k (qw(FTP_HOST FTP_USER FTP_PASS)) {
    if ($t =~ /\b$k\b\s*[:=]\s*(\S+)/) { print "$k=\x27$1\x27\n"; }
  }
' "$CRED")"
: "${FTP_HOST:?manca FTP_HOST}" "${FTP_USER:?manca FTP_USER}" "${FTP_PASS:?manca FTP_PASS}"

TOTALE=${#ELENCO[@]}
echo "▸ ${TOTALE} file da caricare in /${REMOTA}/ ($(du -sh "$QUI/dist" | cut -f1))"

# 🔴 Ordine: prima le risorse, per ultimo index.html. Se qualcosa fallisce a
# metà, chi visita continua a vedere la versione vecchia e completa invece di
# una pagina nuova che chiede file che non ci sono ancora.
ORDINATI=()
for f in "${ELENCO[@]}"; do [ "$f" = "index.html" ] || ORDINATI+=("$f"); done
ORDINATI+=("index.html")

n=0; OK=0; FALLITI=()
for f in "${ORDINATI[@]}"; do
  n=$((n+1))
  ok=0
  for try in $(seq 1 "$TRIES"); do
    if curl --silent --show-error --fail --connect-timeout 30 --ftp-create-dirs \
         --user "$FTP_USER:$FTP_PASS" \
         --upload-file "$QUI/dist/$f" "ftp://$FTP_HOST/$REMOTA/$f"; then
      ok=1; break
    fi
    sleep "$SLEEP"
  done
  if [ "$ok" = 1 ]; then
    OK=$((OK+1)); printf '  ✅ %2d/%d %s\n' "$n" "$TOTALE" "$f"
  else
    FALLITI+=("$f"); printf '  ❌ %2d/%d %s\n' "$n" "$TOTALE" "$f"
  fi
done

echo "▸ Esito: $OK/$TOTALE"
if [ ${#FALLITI[@]} -gt 0 ]; then
  printf '   non caricati: %s\n' "${FALLITI[*]}"
  exit 1
fi

echo "▸ Verifica (solo HTTP, su www — il dominio nudo redirige):"
BASE="https://www.fostinellistefano.it/$REMOTA"
for u in "/" "/LICENSE"; do
  codice=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$u")
  echo "   $BASE$u → $codice"
done
echo "   ricordati di controllare che la pagina apra davvero un DWG."

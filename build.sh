#!/bin/sh
# Packs src/* and audio/*.mp3 into a single self-contained index.html
cd "$(dirname "$0")"
{
  printf '%s\n' '<!doctype html>' '<html lang="en">' '<head>' \
    '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1">' \
    '<title>lowk.cooking</title>' \
    '<meta property="og:title" content="lowk.cooking"><meta property="og:type" content="website"><meta property="og:url" content="https://lowk.cooking/"><meta property="og:image" content="https://lowk.cooking/preview.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://lowk.cooking/preview.png">' \
    '<meta name="description" content="lowk.cooking — a studio that is lowkey cooking. Realtime shaders and real recorded sound, served hot.">' \
    '<link rel="preconnect" href="https://fonts.googleapis.com">' \
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' \
    '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@300..600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">' \
    '<style>'
  cat src/style.css src/style2.css src/style3.css src/style4.css
  printf '%s\n' '</style>' '</head>' '<body>'
  cat src/body.html src/body2.html src/body3.html
  # real recordings (see audio/CREDITS.md), inlined so the page stays one file and works from file://
  printf '<script>\nwindow.SND={\n'
  for f in audio/*.mp3; do printf '%s:"' "$(basename "$f" .mp3)"; base64 < "$f" | tr -d '\n'; printf '",\n'; done
  printf '};\n</script>\n'
  for f in gl audio shaderkit multi particles fluid fx1 fx2 bento globe sections scroll; do printf '<script>\n'; cat "src/$f.js"; printf '</script>\n'; done
  printf '%s\n' '</body>' '</html>'
} > index.html
echo "built index.html ($(wc -c < index.html | tr -d ' ') bytes)"

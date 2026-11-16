#!/bin/sh
# Packs src/* into a single self-contained index.html
cd "$(dirname "$0")"
{
  printf '%s\n' '<!doctype html>' '<html lang="en">' '<head>' \
    '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1">' \
    '<title>lowk.cooking</title>' \
    '<meta name="description" content="lowk.cooking — a studio that is lowkey cooking. Realtime shaders, served hot.">' \
    '<link rel="preconnect" href="https://fonts.googleapis.com">' \
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' \
    '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@300..600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">' \
    '<style>'
  cat src/style.css src/style2.css src/style3.css
  printf '%s\n' '</style>' '</head>' '<body>'
  cat src/body.html src/body2.html
  for f in gl shaderkit multi particles fx1 fx2 bento globe scroll; do printf '<script>\n'; cat "src/$f.js"; printf '</script>\n'; done
  printf '%s\n' '</body>' '</html>'
} > index.html
echo "built index.html ($(wc -c < index.html | tr -d ' ') bytes)"

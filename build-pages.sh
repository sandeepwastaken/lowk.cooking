#!/bin/sh
# For every file in images/: writes p/<name>.html (title, favicon and link-preview image
# set to that image) and refreshes the IMAGES list in loader.html. name = file minus extension.
# Link previews need absolute URLs, so set SITE to where this folder is hosted.
SITE="https://lowk.cooking"

cd "$(dirname "$0")"
mkdir -p p
rm -f p/*.html
list=""
for f in images/*; do
  [ -f "$f" ] || continue
  file=$(basename "$f"); name="${file%.*}"
  list="$list  $name: \"$file\",
"
  cat > "p/$name.html" <<EOF
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>$name</title>
<link rel="icon" href="../images/$file">
<meta property="og:title" content="$name">
<meta property="og:type" content="website">
<meta property="og:url" content="$SITE/p/$name.html">
<meta property="og:image" content="$SITE/images/$file">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="$SITE/images/$file">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}img{display:block;width:100vw;height:100vh}</style>
<img src="../images/$file" alt="$name">
EOF
done

# swap the lines between "var IMAGES = {" and "};" in loader.html
printf '%s' "$list" > p/.list
awk 'FNR==NR{l=l $0 "\n"; next} /^var IMAGES = \{/{print; printf "%s", l; skip=1; next} skip&&/^\};/{skip=0} !skip' p/.list loader.html > loader.tmp && mv loader.tmp loader.html
rm p/.list
echo "built $(ls p | wc -l | tr -d ' ') pages in p/"

#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [[ ! -f "$DIR/javy" ]]; then
    echo "javy not found, downloading..."
    cd $DIR
    VERSION=v4.0.0
    wget https://github.com/bytecodealliance/javy/releases/download/$VERSION/javy-x86_64-linux-$VERSION.gz
    gunzip javy-x86_64-linux-$VERSION.gz
    chmod +x javy-x86_64-linux-$VERSION
    mv javy-x86_64-linux-$VERSION javy
    rm javy-x86_64-linux-$VERSION.gz
fi

if [[ ! -d "$DIR/node_modules" ]]; then
    echo "node_modules not found, installing..."
    cd $DIR
    npm install
fi


cd $DIR && make out.js
cd $DIR && make examples/plugin.wasm
SUM=$(sha256sum "$DIR/examples/plugin.wasm" | cut -d ' ' -f 1)

cd $DIR/examples && sqlc -f sqlc.libsql.yaml generate
cd $DIR/examples/node-libsql && npm install && npx tsc && node src/main.js



echo -e "
plugins:
- name: ts
  wasm:
    url: file://$DIR/examples/plugin.wasm
    sha256: $SUM
"
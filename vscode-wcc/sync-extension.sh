#!/bin/bash
# Syncs the built extension to ~/.kiro/extensions/wcc-language/
# Run this after any change to the extension source code

set -e

DEST="$HOME/.kiro/extensions/wcc-language"

echo "Building..."
npm run build

echo "Syncing to $DEST..."
rm -rf "$DEST"
mkdir -p "$DEST"

# Copy root package.json (extension manifest)
cp package.json "$DEST/"

# Copy client package
mkdir -p "$DEST/packages/client"
cp -r packages/client/dist "$DEST/packages/client/"
cp -r packages/client/syntaxes "$DEST/packages/client/"
cp -r packages/client/icons "$DEST/packages/client/"
cp packages/client/language-configuration.json "$DEST/packages/client/"
cp packages/client/package.json "$DEST/packages/client/"

# Copy server package
mkdir -p "$DEST/packages/server/bin" "$DEST/packages/server/dist"
cp packages/server/bin/server.js "$DEST/packages/server/bin/"
cp packages/server/dist/index.js "$DEST/packages/server/dist/"
cp packages/server/dist/languagePlugin.js "$DEST/packages/server/dist/"
cp packages/server/dist/wccParser.js "$DEST/packages/server/dist/"
cp packages/server/package.json "$DEST/packages/server/"

# Copy node_modules (follow symlinks)
cp -rL node_modules "$DEST/"

echo "Done! Reload Kiro window to see changes."

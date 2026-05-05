#!/usr/bin/env node

import { readdirSync, writeFileSync, mkdirSync, existsSync, watch, copyFileSync } from 'node:fs';
import { resolve, relative, extname, basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.js';
import { compile } from '../lib/compiler.js';
import { startDevServer } from '../lib/dev-server.js';

const command = process.argv[2];

async function build(config, cwd) {
  const inputDir = resolve(cwd, config.input);
  const outputDir = resolve(cwd, config.output);

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  // Discover source files
  const files = discoverFiles(inputDir);
  let errors = 0;

  for (const file of files) {
    try {
      const output = await compile(file);
      const relPath = relative(inputDir, file);
      const outPath = resolve(outputDir, relPath.replace(/\.wcc$/, '.js'));
      const outDir = dirname(outPath);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(outPath, output);
    } catch (err) {
      console.error(`Error compiling ${file}: ${err.message}`);
      errors++;
    }
  }

  // Copy wcc-runtime.js to output directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const runtimeSrc = resolve(__dirname, '../lib/wcc-runtime.js');
  const runtimeDest = join(outputDir, 'wcc-runtime.js');
  copyFileSync(runtimeSrc, runtimeDest);

  return errors;
}

function discoverFiles(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name);
    if (ext !== '.wcc') continue;
    if (entry.name.includes('.test.')) continue;
    const fullPath = resolve(dir, entry.parentPath ? relative(dir, entry.parentPath) : '', entry.name);
    results.push(fullPath);
  }
  return results;
}

async function main() {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  if (command === 'build') {
    const errors = await build(config, cwd);
    if (errors > 0) process.exit(1);
  } else if (command === 'dev') {
    await build(config, cwd);
    const outputDir = resolve(cwd, config.output);
    startDevServer({ port: config.port, root: cwd, outputDir });
    const inputDir = resolve(cwd, config.input);
    console.log(`Watching ${inputDir} for changes...`);
    watch(inputDir, { recursive: true }, async (eventType, filename) => {
      if (!filename) return;
      const ext = extname(filename);
      if (ext !== '.ts' && ext !== '.js' && ext !== '.wcc') return;
      if (filename.includes('.test.')) return;
      const filePath = resolve(inputDir, filename);
      try {
        const output = await compile(filePath);
        const outPath = resolve(outputDir, filename.replace(/\.ts$/, '.js').replace(/\.wcc$/, '.js'));
        const outDir = dirname(outPath);
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
        writeFileSync(outPath, output);
        console.log(`Compiled: ${filename}`);
      } catch (err) {
        console.error(`Error compiling ${filename}: ${err.message}`);
      }
    });
  } else {
    console.error('Usage: wcc <build|dev>');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});

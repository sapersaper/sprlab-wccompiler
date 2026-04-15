#!/usr/bin/env node

/**
 * wcc CLI — entry point for the wcCompiler.
 *
 * Commands:
 *   wcc build  — Compile all .html files from input/ to .js in output/
 *   wcc dev    — Build + watch input/ for changes + start dev server
 */

import { readdir, writeFile, mkdir, watch, copyFile } from 'node:fs/promises';
import { existsSync, watchFile } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.js';
import { compile } from '../lib/compiler.js';
import { startDevServer } from '../lib/dev-server.js';

const projectRoot = process.cwd();

/**
 * Compile a single file and write the output.
 * Returns true on success, false on error.
 */
async function compileFile(filePath, outputDir) {
  const fileName = basename(filePath, '.html');
  try {
    const code = compile(filePath);
    const outPath = join(outputDir, `${fileName}.js`);
    await writeFile(outPath, code, 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error compilando '${basename(filePath)}': ${err.message}`);
    return false;
  }
}

/**
 * Compile all .html files from inputDir to outputDir.
 * Returns { success, errors } counts.
 */
async function buildAll(inputDir, outputDir) {
  // Create output dir if needed
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Find all .html files
  let files;
  try {
    const entries = await readdir(inputDir);
    files = entries.filter(f => f.endsWith('.html'));
  } catch {
    console.error(`Error: la carpeta de entrada '${inputDir}' no existe`);
    process.exit(1);
  }

  let success = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = join(inputDir, file);
    const ok = await compileFile(filePath, outputDir);
    if (ok) success++;
    else errors++;
  }

  // Copy optional wcc-runtime.js to output
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const runtimeSrc = resolve(__dirname, '../lib/wcc-runtime.js');
  const runtimeDest = join(outputDir, 'wcc-runtime.js');
  await copyFile(runtimeSrc, runtimeDest);

  return { success, errors };
}

// ── Main ──

async function main() {
  const command = process.argv[2];

  if (!command || (command !== 'build' && command !== 'dev')) {
    console.log('Usage: wcc <command>');
    console.log('');
    console.log('Commands:');
    console.log('  build   Compile all .html files');
    console.log('  dev     Build + watch + dev server');
    process.exit(0);
  }

  const config = await loadConfig(projectRoot);
  const inputDir = resolve(projectRoot, config.input);
  const outputDir = resolve(projectRoot, config.output);

  if (command === 'build') {
    const { success, errors } = await buildAll(inputDir, outputDir);
    console.log(`Build complete: ${success} compiled, ${errors} error(s)`);
    process.exit(errors > 0 ? 1 : 0);
  }

  if (command === 'dev') {
    // Initial build
    const { success, errors } = await buildAll(inputDir, outputDir);
    console.log(`Initial build: ${success} compiled, ${errors} error(s)`);

    // Watch input/ for changes
    console.log(`Watching ${config.input}/ for changes...`);
    const watcher = watch(inputDir, { recursive: true });
    (async () => {
      for await (const event of watcher) {
        if (event.filename && event.filename.endsWith('.html')) {
          const filePath = join(inputDir, event.filename);
          if (existsSync(filePath)) {
            console.log(`Change detected: ${event.filename}`);
            const ok = await compileFile(filePath, outputDir);
            if (ok) console.log(`Recompiled: ${event.filename}`);
          }
        }
      }
    })();

    // Start dev server
    startDevServer({
      port: config.port,
      root: projectRoot,
      outputDir,
    });
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});

#!/usr/bin/env node

import { readdirSync, writeFileSync, mkdirSync, existsSync, watch, copyFileSync } from 'node:fs';
import { resolve, relative, extname, basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.js';
import { compile } from '../lib/compiler.js';
import { startDevServer } from '../lib/dev-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const command = process.argv[2];

async function build(config, cwd) {
  const inputDir = resolve(cwd, config.input);
  const outputDir = resolve(cwd, config.output);

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const files = discoverFiles(inputDir);
  let errors = 0;
  let needsSharedRuntime = false;

  for (const file of files) {
    try {
      const relPath = relative(inputDir, file);
      const outPath = resolve(outputDir, relPath.replace(/\.wcc$/, '.js'));
      const outDir = dirname(outPath);

      // Calculate runtimeImportPath (always calculate it — the compiler decides whether to use it)
      const signalsDest = join(outputDir, '__wcc-signals.js');
      const runtimeRelPath = relative(outDir, signalsDest).replace(/\\/g, '/');
      const runtimeImportPath = runtimeRelPath.startsWith('.') ? runtimeRelPath : './' + runtimeRelPath;

      const { code, usesSharedRuntime } = await compile(file, {
        standalone: config.standalone,
        runtimeImportPath,
      });

      if (usesSharedRuntime) needsSharedRuntime = true;

      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(outPath, code);
    } catch (err) {
      console.error(`Error compiling ${file}: ${err.message}`);
      errors++;
    }
  }

  // Generate shared runtime ONLY if needed
  if (needsSharedRuntime) {
    const { reactiveRuntime } = await import('../lib/reactive-runtime.js');
    const signalsContent = reactiveRuntime.trim() + '\nexport { __signal, __computed, __effect, __batch, __untrack };\n';
    const signalsDest = join(outputDir, '__wcc-signals.js');
    writeFileSync(signalsDest, signalsContent);
  }

  // Copy wcc-runtime.js to output directory
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
    const devServer = startDevServer({ port: config.port, root: cwd, outputDir });
    const inputDir = resolve(cwd, config.input);
    console.log(`Watching ${inputDir} for changes...`);
    watch(inputDir, { recursive: true }, async (eventType, filename) => {
      if (!filename) return;
      const ext = extname(filename);
      if (ext !== '.ts' && ext !== '.js' && ext !== '.wcc') return;
      if (filename.includes('.test.')) return;
      const filePath = resolve(inputDir, filename);
      try {
        const relPath = filename;
        const outPath = resolve(outputDir, relPath.replace(/\.ts$/, '.js').replace(/\.wcc$/, '.js'));
        const outDir = dirname(outPath);

        // Calculate runtimeImportPath for this file
        const signalsDest = join(outputDir, '__wcc-signals.js');
        const runtimeRelPath = relative(outDir, signalsDest).replace(/\\/g, '/');
        const runtimeImportPath = runtimeRelPath.startsWith('.') ? runtimeRelPath : './' + runtimeRelPath;

        const { code, usesSharedRuntime } = await compile(filePath, {
          standalone: config.standalone,
          runtimeImportPath,
        });

        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
        writeFileSync(outPath, code);

        // If this component uses shared runtime and the file doesn't exist yet, generate it
        if (usesSharedRuntime && !existsSync(signalsDest)) {
          const { reactiveRuntime } = await import('../lib/reactive-runtime.js');
          const signalsContent = reactiveRuntime.trim() + '\nexport { __signal, __computed, __effect, __batch, __untrack };\n';
          writeFileSync(signalsDest, signalsContent);
        }

        console.log(`Compiled: ${filename}`);
      } catch (err) {
        console.error(`Error compiling ${filename}: ${err.message}`);
        devServer.notifyError(`${filename}\n\n${err.message}`);
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

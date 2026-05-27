/**
 * Build script for WCC framework-testing components.
 *
 * Compiles all .wcc files from src/ into dist/, then copies
 * the compiled .js files + framework integration plugins to each project.
 *
 * Usage:
 *   node build.js              → compile to dist/ only
 *   node build.js --target=vue → compile + copy to vue
 *   node build.js --target=all → compile + copy to all frameworks
 */

import { readdirSync, mkdirSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../lib/compiler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, 'src');
const DIST_DIR = join(__dirname, 'dist');
const ROOT = join(__dirname, '../..');

const TARGETS = {
  vue: join(__dirname, '../vue/src/wcc'),
  react: join(__dirname, '../react/src/wcc'),
  angular: join(__dirname, '../angular/src/wcc'),
};

// Integration plugins to copy per framework
const INTEGRATIONS = {
  vue: [
    { src: join(ROOT, 'integrations/vue.js'), dest: 'vue-plugin.js' },
  ],
  react: [
    { src: join(ROOT, 'integrations/react.js'), dest: 'react-plugin.js' },
  ],
  angular: [
    { src: join(ROOT, 'adapters/angular-compiled/angular.mjs'), dest: 'angular-adapter.mjs' },
    { src: join(ROOT, 'adapters/angular-compiled/angular.d.ts'), dest: 'angular-adapter.d.ts' },
  ],
};

// Parse args
const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : null;

async function main() {
  // 1. Discover .wcc files
  const wccFiles = readdirSync(SRC_DIR).filter(f => f.endsWith('.wcc'));

  if (wccFiles.length === 0) {
    console.log('No .wcc files found in src/');
    return;
  }

  // 2. Compile each to dist/
  mkdirSync(DIST_DIR, { recursive: true });

  console.log(`Compiling ${wccFiles.length} components...`);
  for (const file of wccFiles) {
    const srcPath = join(SRC_DIR, file);
    const outName = file.replace(/\.wcc$/, '.js');
    const outPath = join(DIST_DIR, outName);

    const { code } = await compile(srcPath, { standalone: true });
    writeFileSync(outPath, code);
    console.log(`  ✓ ${file} → dist/${outName}`);
  }

  // 3. Copy to framework targets
  if (!target) {
    console.log('\nDone. Use --target=vue|react|angular|all to copy to frameworks.');
    return;
  }

  const targets = target === 'all' ? Object.keys(TARGETS) : [target];

  for (const t of targets) {
    const destDir = TARGETS[t];
    if (!destDir) {
      console.error(`Unknown target: ${t}`);
      continue;
    }

    mkdirSync(destDir, { recursive: true });

    // Copy compiled components
    const jsFiles = readdirSync(DIST_DIR).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      cpSync(join(DIST_DIR, file), join(destDir, file));
    }

    // Copy integration plugins
    const integrations = INTEGRATIONS[t] || [];
    for (const { src, dest } of integrations) {
      if (existsSync(src)) {
        cpSync(src, join(destDir, dest));
        console.log(`  ✓ ${dest} → ${t}/src/wcc/`);
      } else {
        console.warn(`  ⚠ Missing: ${src}`);
      }
    }

    console.log(`  → Copied ${jsFiles.length} components + ${integrations.length} integrations to ${t}/src/wcc/`);
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

const esbuild = require('esbuild');
const path = require('path');
const glob = require('glob');

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const testMode = args.includes('--test');

const shared = {
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: false,
  format: 'cjs',
  bundle: true,
  external: ['vscode'],
};

const configs = [
  {
    ...shared,
    entryPoints: [path.resolve(__dirname, 'src', 'extension.ts')],
    outfile: path.resolve(__dirname, 'dist', 'extension.js'),
  },
  {
    ...shared,
    entryPoints: [path.resolve(__dirname, 'src', 'engine', 'wasmWorker.ts')],
    outfile: path.resolve(__dirname, 'dist', 'wasmWorker.js'),
  },
];

if (testMode) {
  const testDir = path.resolve(__dirname, 'test');
  const testFiles = glob.sync('**/*.ts', { cwd: testDir });
  for (const f of testFiles) {
    configs.push({
      platform: 'node',
      target: 'node20',
      sourcemap: true,
      minify: false,
      format: 'cjs',
      bundle: true,
      external: ['vscode', 'mocha', 'glob', 'rimraf', '@vscode/test-electron', 'tar', 'adm-zip'],
      entryPoints: [path.resolve(testDir, f)],
      outdir: path.resolve(__dirname, 'dist', 'test'),
      outbase: 'test',
    });
  }
}

async function main() {
  if (watch) {
    for (const cfg of configs) {
      const ctx = await esbuild.context(cfg);
      await ctx.watch();
    }
    console.log('[esbuild] Watching for changes...');
  } else {
    for (const cfg of configs) {
      await esbuild.build(cfg);
    }
    console.log('[esbuild] Build complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import * as Path from 'node:path';
import * as Fs from 'node:fs';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import { rimrafSync } from 'rimraf';

const projectRoot = Path.resolve(__dirname, '..', '..');

async function main(): Promise<void> {
  const tmpDir = Fs.mkdtempSync(Path.join(projectRoot, '.test-tmp-'));
  try {
    const userDataDir = Path.join(tmpDir, 'user');
    const extensionsDir = Path.join(tmpDir, 'extensions');
    const workspaceDir = Path.join(tmpDir, 'workspace');
    Fs.mkdirSync(workspaceDir, { recursive: true });

    console.log('Downloading VS Code...');
    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

    const extensionTestsPath = Path.join(projectRoot, 'dist', 'test', 'index.js');
    if (!Fs.existsSync(extensionTestsPath)) {
      throw new Error(
        `Test entry not found at ${extensionTestsPath}. Run 'npm run compile-test' first.`
      );
    }

    console.log('Running tests inside VS Code...');
    const exitCode = await runTests({
      vscodeExecutablePath,
      launchArgs: [
        '--user-data-dir', userDataDir,
        '--extensions-dir', extensionsDir,
        workspaceDir,
      ],
      extensionDevelopmentPath: projectRoot,
      extensionTestsPath,
    });

    if (exitCode !== 0) {
      throw new Error(`Tests failed with exit code ${exitCode}.`);
    }

    console.log('All tests passed.');
  } finally {
    if (Fs.existsSync(tmpDir)) {
      rimrafSync(tmpDir);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

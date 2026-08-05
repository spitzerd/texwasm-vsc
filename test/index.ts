import * as Path from 'node:path';
import { globSync } from 'glob';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    timeout: 30000,
    color: true,
  });

  const testsRoot = Path.resolve(__dirname, '.');
  const files = globSync('**/*.test.js', { cwd: testsRoot }).sort();
  for (const f of files) {
    mocha.addFile(Path.resolve(testsRoot, f));
  }

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

import { describe, it } from 'mocha';
import assert from 'node:assert';
import { scanForPackageRefs, collectPackageNames } from '../../src/engine/packageScanner';

describe('packageScanner', () => {
  describe('scanForPackageRefs', () => {
    it('finds \\usepackage{foo}', () => {
      const refs = scanForPackageRefs('\\usepackage{foo}');
      assert.strictEqual(refs.length, 1);
      assert.deepStrictEqual(refs[0], { name: 'foo', type: 'package' });
    });

    it('finds multiple \\usepackage commands', () => {
      const refs = scanForPackageRefs('\\usepackage{foo}\\usepackage{bar}');
      assert.strictEqual(refs.length, 2);
      assert.deepStrictEqual(refs.map((r: { name: string }) => r.name).sort(), ['bar', 'foo']);
    });

    it('finds \\usepackage with options', () => {
      const refs = scanForPackageRefs('\\usepackage[utf8]{inputenc}');
      assert.strictEqual(refs.length, 1);
      assert.deepStrictEqual(refs[0], { name: 'inputenc', type: 'package' });
    });

    it('finds \\RequirePackage', () => {
      const refs = scanForPackageRefs('\\RequirePackage{foo}');
      assert.strictEqual(refs.length, 1);
      assert.deepStrictEqual(refs[0], { name: 'foo', type: 'package' });
    });

    it('finds \\documentclass', () => {
      const refs = scanForPackageRefs('\\documentclass{article}');
      assert.strictEqual(refs.length, 1);
      assert.deepStrictEqual(refs[0], { name: 'article', type: 'class' });
    });

    it('finds \\documentclass with options', () => {
      const refs = scanForPackageRefs('\\documentclass[12pt,a4paper]{article}');
      assert.strictEqual(refs.length, 1);
      assert.deepStrictEqual(refs[0], { name: 'article', type: 'class' });
    });

    it('deduplicates repeated packages', () => {
      const refs = scanForPackageRefs('\\usepackage{foo}\\usepackage{foo}');
      assert.strictEqual(refs.length, 1);
    });

    it('handles comma-separated packages', () => {
      const refs = scanForPackageRefs('\\usepackage{foo,bar,baz}');
      assert.strictEqual(refs.length, 3);
      assert.deepStrictEqual(refs.map((r: { name: string }) => r.name).sort(), ['bar', 'baz', 'foo']);
    });

    it('returns empty for content with no packages', () => {
      const refs = scanForPackageRefs('Hello world');
      assert.strictEqual(refs.length, 0);
    });
  });

  describe('collectPackageNames', () => {
    it('collects from source and project files', () => {
      const names = collectPackageNames(
        '\\usepackage{foo}',
        [{ path: 'inc.tex', content: '\\usepackage{bar}' }]
      );
      assert.deepStrictEqual(names.sort(), ['bar', 'foo']);
    });

    it('deduplicates across source and project files', () => {
      const names = collectPackageNames(
        '\\usepackage{foo}',
        [{ path: 'inc.tex', content: '\\usepackage{foo}' }]
      );
      assert.deepStrictEqual(names, ['foo']);
    });

    it('returns empty when no packages found', () => {
      const names = collectPackageNames('Hello', []);
      assert.deepStrictEqual(names, []);
    });
  });
});

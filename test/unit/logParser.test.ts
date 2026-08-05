import { describe, it } from 'mocha';
import assert from 'node:assert';
import { parseLog, hasFatalError } from '../../src/output/logParser';

describe('parseLog', () => {
  it('parses LaTeX error', () => {
    const log = `! LaTeX Error: File \`missing.sty' not found.
l.5 \\usepackage{missing}`;
    const entries = parseLog(log);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].level, 'error');
    assert.ok(entries[0].message.includes('File'));
    assert.strictEqual(entries[0].line, 5);
  });

  it('parses undefined control sequence', () => {
    const log = `! Undefined control sequence.
l.10 \\nonexistent`;
    const entries = parseLog(log);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].level, 'error');
  });

  it('parses LaTeX warning', () => {
    const log = 'LaTeX Warning: Citation `foo99\' on page 1 undefined on input line 20.';
    const entries = parseLog(log);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].level, 'warning');
    assert.ok(entries[0].message.includes('Citation'));
  });

  it('parses overfull hbox warning', () => {
    const log = 'Overfull \\hbox (12.345pt too wide) in paragraph at lines 30--31';
    const entries = parseLog(log);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].level, 'warning');
    assert.ok(entries[0].message.includes('Overfull'));
  });

  it('parses package warning', () => {
    const log = 'Package biblatex Warning: Using fall-back bibtex backend.';
    const entries = parseLog(log);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].level, 'warning');
  });

  it('handles empty log', () => {
    assert.deepStrictEqual(parseLog(''), []);
  });

  it('handles log with no errors or warnings', () => {
    const log = 'This is pdfTeX, Version 3.141592653\nentering extended mode\n';
    assert.deepStrictEqual(parseLog(log), []);
  });
});

describe('hasFatalError', () => {
  it('detects fatal error', () => {
    assert.strictEqual(hasFatalError('Fatal error occurred'), true);
  });

  it('detects bang error', () => {
    assert.strictEqual(hasFatalError('! LaTeX Error: Something'), true);
  });

  it('returns false for clean log', () => {
    assert.strictEqual(hasFatalError('This is pdfTeX'), false);
  });
});

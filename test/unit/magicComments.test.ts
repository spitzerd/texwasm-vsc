import { describe, it } from 'mocha';
import assert from 'node:assert';
import { parseMagicComments, resolveEngine } from '../../src/engine/magicComments';

describe('parseMagicComments', () => {
  it('parses % !TEX program = xelatex', () => {
    const src = `% !TEX program = xelatex
\\documentclass{article}
\\begin{document}
Hello
\\end{document}`;
    const result = parseMagicComments(src);
    assert.strictEqual(result.program, 'xelatex');
  });

  it('parses % !TEX program = lualatex', () => {
    const src = `% !TEX program = lualatex
\\documentclass{article}`;
    const result = parseMagicComments(src);
    assert.strictEqual(result.program, 'lualatex');
  });

  it('handles case-insensitive engine alias', () => {
    const src = '% !TEX program = XeLaTeX';
    const result = parseMagicComments(src);
    assert.strictEqual(result.program, 'xelatex');
  });

  it('maps pdftex alias to pdflatex', () => {
    const src = '% !TEX program = pdftex';
    const result = parseMagicComments(src);
    assert.strictEqual(result.program, 'pdflatex');
  });

  it('returns no program when no magic comment', () => {
    const src = '\\documentclass{article}';
    const result = parseMagicComments(src);
    assert.strictEqual(result.program, undefined);
  });

  it('parses % !TEX root = main.tex', () => {
    const src = `% !TEX root = main.tex
\\documentclass{article}
\\begin{document}
Hello
\\end{document}`;
    const result = parseMagicComments(src);
    assert.strictEqual(result.root, 'main.tex');
  });

  it('parses % !TEX root with relative path', () => {
    const src = '% !TEX root = ../main.tex\n\\documentclass{article}';
    const result = parseMagicComments(src);
    assert.strictEqual(result.root, '../main.tex');
  });

  it('parses % !TEX root without .tex extension', () => {
    const src = '% !TEX root = main\n\\documentclass{article}';
    const result = parseMagicComments(src);
    assert.strictEqual(result.root, 'main');
  });

  it('returns undefined root when no magic root comment', () => {
    const src = '\\documentclass{article}';
    const result = parseMagicComments(src);
    assert.strictEqual(result.root, undefined);
  });

  it('parses both program and root together', () => {
    const src = `% !TEX program = xelatex
% !TEX root = main.tex
\\documentclass{article}`;
    const result = parseMagicComments(src);
    assert.strictEqual(result.program, 'xelatex');
    assert.strictEqual(result.root, 'main.tex');
  });
});

describe('resolveEngine', () => {
  it('uses magic comment when present', () => {
    const src = '% !TEX program = xelatex\n\\documentclass{article}';
    assert.strictEqual(resolveEngine('pdflatex', src), 'xelatex');
  });

  it('falls back to settings engine when no magic comment', () => {
    const src = '\\documentclass{article}';
    assert.strictEqual(resolveEngine('lualatex', src), 'lualatex');
  });
});

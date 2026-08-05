import { describe, it } from 'mocha';
import assert from 'node:assert';
import { hasDocumentClass } from '../../src/engine/magicComments';

describe('hasDocumentClass', () => {
  it('detects \\documentclass{article}', () => {
    const src = '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}';
    assert.strictEqual(hasDocumentClass(src), true);
  });

  it('detects \\documentclass[options]{report}', () => {
    const src = '\\documentclass[12pt,a4paper]{report}';
    assert.strictEqual(hasDocumentClass(src), true);
  });

  it('detects \\documentclass{beamer}', () => {
    const src = '\\documentclass{beamer}';
    assert.strictEqual(hasDocumentClass(src), true);
  });

  it('returns false for input fragment with \\input but no documentclass', () => {
    const src = '\\section{Introduction}\nSome content.\n\\input{table}';
    assert.strictEqual(hasDocumentClass(src), false);
  });

  it('returns false for empty content', () => {
    assert.strictEqual(hasDocumentClass(''), false);
  });

  it('returns false for content with \\documentclass inside a comment', () => {
    const src = '% \\documentclass{article}\n\\input{main}';
    assert.strictEqual(hasDocumentClass(src), false);
  });

  it('detects \\documentclass with multi-line preamble', () => {
    const src = `% !TEX program = pdflatex
% !TEX root = main.tex
\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
Test
\\end{document}`;
    assert.strictEqual(hasDocumentClass(src), true);
  });
});

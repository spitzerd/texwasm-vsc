import { describe, it } from 'mocha';
import assert from 'node:assert';
import { SyncTexParser } from '../../src/synctex/synctexParser';

function makeSynctex(inputs: string[], nodes: string[]): string {
  return [
    'SyncTeX version:1',
    ...inputs,
    ...nodes,
  ].join('\n');
}

function input(tag: number, name: string): string {
  return `I ${tag} ${name}`;
}

function node(tag: number, line: number, col: number, page: number, x = 0, y = 0, w = 0, h = 0, z = 0): string {
  return `N ${tag} ${line} ${col} ${page} ${x} ${y} ${w} ${h} ${z}`;
}

describe('SyncTexParser', () => {
  it('parses empty content', () => {
    const parser = new SyncTexParser();
    assert.strictEqual(parser.parseContent(''), false);
  });

  it('parses header and returns false on bad header', () => {
    const parser = new SyncTexParser();
    assert.strictEqual(parser.parseContent('Not SyncTeX'), false);
  });

  it('parses basic input and node records', () => {
    const content = makeSynctex(
      [input(1, '/home/user/doc.tex')],
      [node(1, 10, 0, 1)]
    );
    const parser = new SyncTexParser();
    assert.strictEqual(parser.parseContent(content), true);
  });

  it('maps source line to PDF page', () => {
    const docPath = '/home/user/doc.tex';
    const content = makeSynctex(
      [input(1, docPath)],
      [node(1, 10, 0, 1)]
    );
    const parser = new SyncTexParser();
    parser.parseContent(content);
    assert.strictEqual(parser.getPageForSourceLine(docPath, 10), 1);
  });

  it('handles multiple nodes on same line', () => {
    const docPath = '/home/user/doc.tex';
    const content = makeSynctex(
      [input(1, docPath)],
      [node(1, 10, 0, 2), node(1, 10, 5, 3)]
    );
    const parser = new SyncTexParser();
    parser.parseContent(content);
    assert.strictEqual(parser.getPageForSourceLine(docPath, 10), 2);
  });

  it('handles multiple input files', () => {
    const mainPath = '/home/user/main.tex';
    const incPath = '/home/user/chapter.tex';
    const content = makeSynctex(
      [input(1, mainPath), input(2, incPath)],
      [node(1, 1, 0, 1), node(2, 5, 0, 2)]
    );
    const parser = new SyncTexParser();
    parser.parseContent(content);
    assert.strictEqual(parser.getPageForSourceLine(mainPath, 1), 1);
    assert.strictEqual(parser.getPageForSourceLine(incPath, 5), 2);
  });

  it('normalizes path separators', () => {
    const content = makeSynctex(
      [input(1, '/home/user/doc.tex')],
      [node(1, 10, 0, 1)]
    );
    const parser = new SyncTexParser();
    parser.parseContent(content);
    assert.strictEqual(parser.getPageForSourceLine('/home/user/doc.tex', 10), 1);
  });

  it('returns undefined for unknown line', () => {
    const content = makeSynctex(
      [input(1, '/home/user/doc.tex')],
      [node(1, 10, 0, 1)]
    );
    const parser = new SyncTexParser();
    parser.parseContent(content);
    assert.strictEqual(parser.getPageForSourceLine('/home/user/doc.tex', 99), undefined);
  });

  it('returns undefined for unknown file', () => {
    const content = makeSynctex(
      [input(1, '/home/user/doc.tex')],
      [node(1, 10, 0, 1)]
    );
    const parser = new SyncTexParser();
    parser.parseContent(content);
    assert.strictEqual(parser.getPageForSourceLine('/other/file.tex', 1), undefined);
  });

  it('returns all pages for a line', () => {
    const docPath = '/home/user/doc.tex';
    const content = makeSynctex(
      [input(1, docPath)],
      [node(1, 10, 0, 1), node(1, 10, 5, 2), node(1, 10, 10, 3)]
    );
    const parser = new SyncTexParser();
    parser.parseContent(content);
    const pages = parser.getAllPagesForSourceLine(docPath, 10);
    assert.deepStrictEqual([...pages].sort(), [1, 2, 3]);
  });
});

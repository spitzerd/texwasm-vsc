import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { resolveProjectFiles } from '../../src/engine/fileResolver';

const testDir = path.resolve(__dirname, '../../.test_temp_resolver');

function writeTestFile(name: string, content: string | Uint8Array): string {
	const p = path.join(testDir, name);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, content);
	return p;
}

describe('resolveProjectFiles', () => {
	beforeEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true });
		fs.mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true });
	});

	it('includes .tex files in the project tree', () => {
		writeTestFile('main.tex', '\\section{Hello}');
		writeTestFile('chapter.tex', '\\section{Chapter}');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		const paths = result.map((f) => f.path);
		assert.ok(paths.includes(path.join(testDir, 'main.tex')));
		assert.ok(paths.includes(path.join(testDir, 'chapter.tex')));
	});

	it('includes .bib, .sty, .cls, .lua files', () => {
		writeTestFile('main.tex', 'Hello');
		writeTestFile('refs.bib', '@article{key, author={A}}');
		writeTestFile('style.sty', '\\ProvidesPackage{style}');
		writeTestFile('class.cls', '\\ProvidesClass{myclass}');
		writeTestFile('code.lua', 'print("hi")');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		assert.strictEqual(result.length, 5);
	});

	it('includes binary files (.png, .pdf, .jpg, .svg)', () => {
		writeTestFile('main.tex', 'Hello');
		writeTestFile('img.png', 'fake-png');
		writeTestFile('doc.pdf', 'fake-pdf');
		writeTestFile('pic.svg', '<svg/>');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		assert.strictEqual(result.length, 4);
	});

	it('skips irrelevant extensions', () => {
		writeTestFile('main.tex', 'Hello');
		writeTestFile('readme.md', '# hi');
		writeTestFile('script.py', 'print("x")');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		assert.strictEqual(result.length, 1);
	});

	it('skips hidden directories', () => {
		writeTestFile('main.tex', 'Hello');
		writeTestFile('.git/config.tex', 'not latex');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		assert.strictEqual(result.length, 1);
	});

	it('does not include duplicates', () => {
		writeTestFile('main.tex', 'Hello');
		writeTestFile('data.tex', 'Data');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		assert.strictEqual(result.length, 2);
	});

	it('reads text files as strings', () => {
		writeTestFile('main.tex', 'Hello world');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		assert.strictEqual(result.length, 1);
		assert.strictEqual(typeof result[0].content, 'string');
	});

	it('reads binary files as Uint8Array', () => {
		writeTestFile('main.tex', 'Hello');
		const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00, 0xfe]);
		writeTestFile('image.png', pngBytes);
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		const img = result.find((f) => f.path.endsWith('image.png'));
		assert.ok(img);
		assert.ok(img.content instanceof Uint8Array);
		assert.deepStrictEqual(Buffer.from(img.content as Uint8Array), pngBytes);
	});

	it('walks subdirectories recursively', () => {
		writeTestFile('main.tex', 'Hello');
		writeTestFile('text/chapter1.tex', '\\section{One}');
		writeTestFile('text/chapter2.tex', '\\section{Two}');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		assert.strictEqual(result.length, 3);
	});

	it('handles empty directory gracefully', () => {
		writeTestFile('main.tex', 'Hello');
		const result = resolveProjectFiles(path.join(testDir, 'main.tex'));
		assert.strictEqual(result.length, 1);
	});
});

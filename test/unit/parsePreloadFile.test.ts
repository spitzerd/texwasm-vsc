import * as fs from "node:fs";
import * as path from "node:path";
import { strict as assert } from "node:assert";
import { parsePreloadFile } from "../../src/cache/packageCache";

describe("parsePreloadFile", () => {
	const tmpDir = path.join(
		__dirname,
		"..",
		"..",
		"..",
		".vscode-test",
		"test-tmp",
		"preload-test",
	);

	beforeEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		fs.mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns empty sets when file does not exist", () => {
		const result = parsePreloadFile(path.join(tmpDir, "nonexistent.js"));
		assert.equal(result.packages.size, 0);
		assert.equal(result.defFiles.size, 0);
	});

	it("parses file array format", () => {
		const jsContent = `
loadPackage([{"filename": "texlive/texmf-dist/tex/latex/base/article.cls"},
             {"filename": "texlive/texmf-dist/tex/latex/amsmath/amsmath.sty"},
             {"filename": "texlive/texmf-dist/tex/latex/amsfonts/amsfonts.sty"}])
`;
		const jsPath = path.join(tmpDir, "test.js");
		fs.writeFileSync(jsPath, jsContent.trim(), "utf-8");

		const result = parsePreloadFile(jsPath);
		assert.equal(result.packages.size, 3);
		assert.ok(result.packages.has("article"));
		assert.ok(result.packages.has("amsmath"));
		assert.ok(result.packages.has("amsfonts"));
	});

	it("parses object with files array format", () => {
		const jsContent = `
loadPackage({"files": [{"filename": "texlive/texmf-dist/tex/latex/base/report.cls"},
                       {"filename": "texlive/texmf-dist/tex/latex/tools/array.sty"}]})
`;
		const jsPath = path.join(tmpDir, "test2.js");
		fs.writeFileSync(jsPath, jsContent.trim(), "utf-8");

		const result = parsePreloadFile(jsPath);
		assert.equal(result.packages.size, 2);
		assert.ok(result.packages.has("report"));
		assert.ok(result.packages.has("array"));
	});

	it("extracts .sty, .cls, and .def files, ignoring others", () => {
		const jsContent = `
loadPackage([{"filename": "texlive/texmf-dist/tex/latex/base/article.cls"},
             {"filename": "texlive/texmf-dist/doc/readme.txt"},
             {"filename": "texlive/texmf-dist/fonts/tfm/cmr10.tfm"},
             {"filename": "texlive/texmf-dist/tex/latex/tools/array.sty"},
             {"filename": "texlive/texmf-dist/tex/latex/logreq/logreq.sty"},
             {"filename": "texlive/texmf-dist/tex/latex/logreq/logreq.def"}])
`;
		const jsPath = path.join(tmpDir, "test3.js");
		fs.writeFileSync(jsPath, jsContent.trim(), "utf-8");

		const result = parsePreloadFile(jsPath);
		assert.equal(result.packages.size, 3);
		assert.ok(result.packages.has("article"));
		assert.ok(result.packages.has("array"));
		assert.ok(result.packages.has("logreq"));
		assert.equal(result.defFiles.size, 1);
		assert.ok(result.defFiles.has("logreq"));
	});

	it("handles files with no loadPackage marker", () => {
		const jsPath = path.join(tmpDir, "empty.js");
		fs.writeFileSync(jsPath, "var x = 1;", "utf-8");

		const result = parsePreloadFile(jsPath);
		assert.equal(result.packages.size, 0);
		assert.equal(result.defFiles.size, 0);
	});

	it("deduplicates same package name from multiple files", () => {
		const jsContent = `
loadPackage([{"filename": "texlive/texmf-dist/tex/latex/base/latex.sty"},
             {"filename": "texlive/texmf-dist/tex/latex/base/tex.sty"}])
`;
		const jsPath = path.join(tmpDir, "dedup.js");
		fs.writeFileSync(jsPath, jsContent.trim(), "utf-8");

		const result = parsePreloadFile(jsPath);
		assert.equal(result.packages.size, 2);
		assert.ok(result.packages.has("latex"));
		assert.ok(result.packages.has("tex"));
	});

	it("handles paths with extra whitespace", () => {
		const jsContent = `
  loadPackage([{ "filename": "texlive/texmf-dist/tex/latex/base/minimal.cls" }])
`;
		const jsPath = path.join(tmpDir, "whitespace.js");
		fs.writeFileSync(jsPath, jsContent.trim(), "utf-8");

		const result = parsePreloadFile(jsPath);
		assert.equal(result.packages.size, 1);
		assert.ok(result.packages.has("minimal"));
	});

	it("separates .def files from .sty packages", () => {
		const jsContent = `
loadPackage([{"filename": "texlive/texmf-dist/tex/latex/base/article.cls"},
             {"filename": "texlive/texmf-dist/tex/latex/base/latex.def"},
             {"filename": "texlive/texmf-dist/tex/latex/base/t1enc.def"},
             {"filename": "texlive/texmf-dist/tex/latex/base/utf8.def"},
             {"filename": "texlive/texmf-dist/tex/latex/base/fontenc.sty"}])
`;
		const jsPath = path.join(tmpDir, "mixed.js");
		fs.writeFileSync(jsPath, jsContent.trim(), "utf-8");

		const result = parsePreloadFile(jsPath);
		assert.equal(result.packages.size, 2);
		assert.ok(result.packages.has("article"));
		assert.ok(result.packages.has("fontenc"));
		assert.equal(result.defFiles.size, 3);
		assert.ok(result.defFiles.has("latex"));
		assert.ok(result.defFiles.has("t1enc"));
		assert.ok(result.defFiles.has("utf8"));
	});
});

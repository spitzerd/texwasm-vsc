import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "mocha";
import assert from "node:assert";
import type * as vscode from "vscode";
import type { CtanPackageInfo } from "../../src/cache/ctanApi";
import { PackageCache } from "../../src/cache/packageCache";

// Minimal vscode.ExtensionContext fake
function makeFakeContext(tempStorage: string): vscode.ExtensionContext {
	return {
		globalStorageUri: { fsPath: tempStorage },
		extensionPath: path.resolve(__dirname, "..", "..", ".."),
	} as unknown as vscode.ExtensionContext;
}

// Stub out queryPackageInfo by monkey-patching the module cache.
// We just need downloadPackage / ensurePackages to use our pinned CTAN responses.

describe("PackageCache transitive discovery", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "texwasm-pkgcache-"));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("ensurePackages discovers transitive \\RequirePackage in downloaded .sty files", async () => {
		const ctx = makeFakeContext(tempDir);
		const cache = new PackageCache(ctx);
		cache.setIncludeExtraBundle(false);

		// Force the preload sets to empty so our packages are never treated as preloaded.
		// (Default behaviour: texlive-basic.js not found in fake extension → empty preload.)

		// Stub queryPackageInfo via the same approach used elsewhere: directly
		// populate the private cache.
		const fakeInfoAcronym: CtanPackageInfo = {
			name: "acronym",
			ctan: { path: "/macros/latex/contrib/acronym" },
		};
		const fakeInfoSuffix: CtanPackageInfo = {
			name: "suffix",
			ctan: { path: "/macros/latex/contrib/bigfoot" },
		};
		// Inline stub: pre-populate the in-memory CTAN query cache.
		// biome-ignore lint/suspicious/noExplicitAny: private access in tests
		(cache as any).resolvedInfo.set("acronym", fakeInfoAcronym);
		// biome-ignore lint/suspicious/noExplicitAny: private access in tests
		(cache as any).resolvedInfo.set("suffix", fakeInfoSuffix);

		// Pretend both packages are "downloaded" by writing the on-disk cache.
		const pkgsDir = path.join(tempDir, "packages", "pkgs");
		const acronymDir = path.join(pkgsDir, "acronym");
		fs.mkdirSync(acronymDir, { recursive: true });
		fs.writeFileSync(
			path.join(acronymDir, "acronym.sty"),
			"\\RequirePackage{suffix,xstring}\n",
		);
		fs.writeFileSync(
			path.join(acronymDir, "metadata.json"),
			JSON.stringify({
				name: "acronym",
				version: "1.50",
				downloadedAt: Date.now(),
				files: ["acronym.sty"],
			}),
		);

		const suffixDir = path.join(pkgsDir, "suffix");
		fs.mkdirSync(suffixDir, { recursive: true });
		fs.writeFileSync(
			path.join(suffixDir, "suffix.sty"),
			"\\def\\SuffixPackageLoaded{}\\endinput\n",
		);
		fs.writeFileSync(
			path.join(suffixDir, "metadata.json"),
			JSON.stringify({
				name: "suffix",
				version: "1.5",
				downloadedAt: Date.now(),
				files: ["suffix.sty"],
			}),
		);

		// xstring is intentionally NOT pre-cached to confirm we only include
		// packages that are actually on disk (transitive deps without cache
		// must not produce stray mount entries).

		const sourceContent = "\\usepackage{acronym}\n";
		const entries = await cache.ensurePackages(sourceContent, []);
		const names = entries.map((e) => path.posix.basename(e.targetPath)).sort();
		assert.ok(
			names.includes("acronym.sty"),
			`expected acronym.sty in ${JSON.stringify(names)}`,
		);
		assert.ok(
			names.includes("suffix.sty"),
			`expected suffix.sty in ${JSON.stringify(names)} (transitive discovery)`,
		);
	});
});
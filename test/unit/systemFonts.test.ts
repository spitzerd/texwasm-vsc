import { describe, it, before, after } from "mocha";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	buildSystemFontIndex,
	getOrBuildSystemFontIndex,
	getSystemFontDirectories,
	invalidateSystemFontIndex,
	loadSystemFontIndexFromCache,
	saveSystemFontIndexToCache,
} from "../../src/utils/systemFonts";

const testRoot = path.resolve(__dirname, "../../.test_temp_system_fonts");

/**
 * Synthesize a minimal TTF with a 'name' table for testing. Same approach
 * as test/unit/fontResolver.test.ts but kept independent so the system-font
 * suite has no cross-file coupling.
 */
function makeTtf(family: string): Buffer {
	const NAME_ID_FAMILY = 1;
	// Encode string as UTF-16BE (matches platformID=3, encodingID=1 in the
	// 'name' table, which is what readFontNames expects).
	const stringBytes = Buffer.alloc(family.length * 2);
	for (let i = 0; i < family.length; i++) {
		const code = family.charCodeAt(i);
		stringBytes[i * 2] = (code >> 8) & 0xff;
		stringBytes[i * 2 + 1] = code & 0xff;
	}
	const recOff = 6 + 1 * 12;
	const nameTable = Buffer.alloc(recOff + stringBytes.length);
	nameTable.writeUInt16BE(0, 0);
	nameTable.writeUInt16BE(1, 2);
	nameTable.writeUInt16BE(recOff, 4);
	nameTable.writeUInt16BE(3, 6);
	nameTable.writeUInt16BE(1, 8);
	nameTable.writeUInt16BE(0x0409, 10);
	nameTable.writeUInt16BE(NAME_ID_FAMILY, 12);
	nameTable.writeUInt16BE(stringBytes.length, 14);
	nameTable.writeUInt16BE(0, 16);
	nameTable.set(stringBytes, recOff);

	const tableDir = Buffer.alloc(16);
	tableDir.write("name", 0, "ascii");
	tableDir.writeUInt32BE(0, 4);
	const nameTableOffset = 12 + 16;
	tableDir.writeUInt32BE(nameTableOffset, 8);
	tableDir.writeUInt32BE(nameTable.length, 12);

	const header = Buffer.alloc(12);
	header.writeUInt32BE(0x00010000, 0);
	header.writeUInt16BE(1, 4);
	header.writeUInt16BE(64, 6);
	header.writeUInt16BE(0, 8);
	header.writeUInt16BE(0, 10);

	return Buffer.concat([header, tableDir, nameTable]);
}

describe("systemFonts", () => {
	before(() => {
		fs.rmSync(testRoot, { recursive: true, force: true });
		fs.mkdirSync(testRoot, { recursive: true });
	});

	after(() => {
		fs.rmSync(testRoot, { recursive: true, force: true });
	});

	describe("getSystemFontDirectories", () => {
		it("returns at least one path on the current platform", () => {
			const dirs = getSystemFontDirectories();
			assert.ok(dirs.length > 0, "should return at least one directory");
			for (const d of dirs) {
				assert.ok(path.isAbsolute(d), `${d} should be absolute`);
			}
		});

		it("deduplicates overlapping entries", () => {
			const home = os.homedir();
			const dirs = getSystemFontDirectories([home, home]);
			const occurrences = dirs.filter((d) => d === path.resolve(home)).length;
			assert.ok(occurrences <= 1, "duplicate extra entries should be removed");
		});

		it("appends extra directories", () => {
			const extra = path.join(testRoot, "my-fonts");
			const dirs = getSystemFontDirectories([extra]);
			assert.ok(dirs.includes(path.resolve(extra)));
		});
	});

	describe("buildSystemFontIndex", () => {
		it("extracts family names from .ttf files in a directory", async () => {
			const dir = path.join(testRoot, "fonts-temp-1");
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(path.join(dir, "Arial.ttf"), makeTtf("Arial"));
			fs.writeFileSync(path.join(dir, "Verdana.ttf"), makeTtf("Verdana"));
			fs.writeFileSync(path.join(dir, "ignore.txt"), "not a font");

			const index = await buildSystemFontIndex({ directories: [dir] });
			assert.strictEqual(index.size, 2);
			const arial = index.get("arial");
			assert.ok(arial);
			assert.strictEqual(arial?.family, "Arial");
			assert.strictEqual(arial?.ext, ".ttf");
			assert.strictEqual(arial?.stem, "Arial");
			assert.ok(arial?.sourcePath.endsWith("Arial.ttf"));
		});

		it("walks subdirectories", async () => {
			const dir = path.join(testRoot, "fonts-temp-2");
			const sub = path.join(dir, "sub");
			fs.mkdirSync(sub, { recursive: true });
			fs.writeFileSync(path.join(sub, "B.ttf"), makeTtf("B Font"));

			const index = await buildSystemFontIndex({ directories: [dir] });
			assert.strictEqual(index.size, 1);
			assert.strictEqual(index.get("b font")?.family, "B Font");
		});

		it("skips hidden directories and node_modules", async () => {
			const dir = path.join(testRoot, "fonts-temp-3");
			fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
			fs.mkdirSync(path.join(dir, "node_modules"), { recursive: true });
			fs.writeFileSync(path.join(dir, ".git", "hidden.ttf"), makeTtf("Hidden"));
			fs.writeFileSync(path.join(dir, "node_modules", "npm.ttf"), makeTtf("Npm"));

			const index = await buildSystemFontIndex({ directories: [dir] });
			assert.strictEqual(index.size, 0);
		});

		it("returns an empty index for a missing directory", async () => {
			const index = await buildSystemFontIndex({
				directories: [path.join(testRoot, "does-not-exist")],
			});
			assert.strictEqual(index.size, 0);
		});

		it("reports progress", async () => {
			const dir = path.join(testRoot, "fonts-temp-4");
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(path.join(dir, "Prog.ttf"), makeTtf("ProgressTest"));
			const messages: string[] = [];
			await buildSystemFontIndex({
				directories: [dir],
				onProgress: (m) => messages.push(m),
			});
			assert.ok(messages.length > 0, "expected progress messages");
		});
	});

	describe("cache round-trip", () => {
		it("saves and reloads an index", async () => {
			const dir = path.join(testRoot, "fonts-temp-5");
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(path.join(dir, "Cached.ttf"), makeTtf("CachedFont"));

			const cacheDir = path.join(testRoot, "cache-1");
			fs.rmSync(cacheDir, { recursive: true, force: true });

			const index = await buildSystemFontIndex({ directories: [dir] });
			await saveSystemFontIndexToCache(cacheDir, index, [dir]);

			const reloaded = await loadSystemFontIndexFromCache(cacheDir);
			assert.ok(reloaded);
			assert.strictEqual(reloaded.size, 1);
			assert.strictEqual(reloaded.get("cachedfont")?.family, "CachedFont");
		});

		it("rejects a cache file with a mismatched version", async () => {
			const cacheDir = path.join(testRoot, "cache-bad");
			fs.mkdirSync(cacheDir, { recursive: true });
			fs.writeFileSync(
				path.join(cacheDir, "system-font-index.json"),
				JSON.stringify({ version: 999, entries: {} }),
			);
			const reloaded = await loadSystemFontIndexFromCache(cacheDir);
			assert.strictEqual(reloaded, undefined);
		});

		it("returns undefined when the cache file is missing", async () => {
			const cacheDir = path.join(testRoot, "cache-missing");
			fs.rmSync(cacheDir, { recursive: true, force: true });
			const reloaded = await loadSystemFontIndexFromCache(cacheDir);
			assert.strictEqual(reloaded, undefined);
		});
	});

	describe("getOrBuildSystemFontIndex", () => {
		it("builds when the cache is missing and serves it on subsequent calls", async () => {
			const dir = path.join(testRoot, "fonts-temp-6");
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(path.join(dir, "Build.ttf"), makeTtf("BuildFont"));

			const cacheDir = path.join(testRoot, "cache-build");
			fs.rmSync(cacheDir, { recursive: true, force: true });

			const first = await getOrBuildSystemFontIndex(cacheDir, {
				directories: [dir],
			});
			assert.strictEqual(first.size, 1);
			assert.ok(fs.existsSync(path.join(cacheDir, "system-font-index.json")));

			const second = await getOrBuildSystemFontIndex(cacheDir, {
				directories: [dir],
			});
			assert.strictEqual(second.size, 1);
			assert.strictEqual(second.get("buildfont")?.family, "BuildFont");
		});

		it("rebuilds when forceRebuild is set", async () => {
			const dir = path.join(testRoot, "fonts-temp-7");
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(path.join(dir, "Force.ttf"), makeTtf("ForceFont"));

			const cacheDir = path.join(testRoot, "cache-force");
			fs.rmSync(cacheDir, { recursive: true, force: true });

			const first = await getOrBuildSystemFontIndex(cacheDir, {
				directories: [dir],
			});
			assert.strictEqual(first.size, 1);

			// Remove the font from disk
			fs.unlinkSync(path.join(dir, "Force.ttf"));

			const cached = await getOrBuildSystemFontIndex(cacheDir, {
				directories: [dir],
			});
			assert.strictEqual(cached.size, 1, "cache should still serve the old index");

			const rebuilt = await getOrBuildSystemFontIndex(cacheDir, {
				directories: [dir],
				forceRebuild: true,
			});
			assert.strictEqual(rebuilt.size, 0, "forceRebuild should pick up the missing file");
		});
	});

	describe("invalidateSystemFontIndex", () => {
		it("deletes the cache file", async () => {
			const dir = path.join(testRoot, "fonts-temp-8");
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(path.join(dir, "Inv.ttf"), makeTtf("InvFont"));

			const cacheDir = path.join(testRoot, "cache-inv");
			fs.rmSync(cacheDir, { recursive: true, force: true });

			const idx = await buildSystemFontIndex({ directories: [dir] });
			await saveSystemFontIndexToCache(cacheDir, idx, [dir]);
			assert.ok(fs.existsSync(path.join(cacheDir, "system-font-index.json")));

			await invalidateSystemFontIndex(cacheDir);
			assert.ok(!fs.existsSync(path.join(cacheDir, "system-font-index.json")));
		});

		it("does not throw when the cache is missing", async () => {
			const cacheDir = path.join(testRoot, "cache-inv-missing");
			fs.rmSync(cacheDir, { recursive: true, force: true });
			await invalidateSystemFontIndex(cacheDir);
		});
	});
});

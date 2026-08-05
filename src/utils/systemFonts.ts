import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readFontNames, type FontIndexEntry } from "../engine/fontResolver";

/**
 * System fonts are fonts installed on the host operating system (e.g. the
 * Arial.ttf bundled with Windows, the DejaVu/Liberation fonts shipped with
 * most Linux distros). They are indexed once and cached to disk in the
 * extension's global storage so we don't re-scan the filesystem on every
 * compile.
 *
 * The index maps a lowercased font family name to a single FontIndexEntry.
 * The `sourcePath` points to the absolute file on the host filesystem; the
 * caller is responsible for reading the bytes and mounting them into the
 * WASM virtual filesystem at compile time.
 */

export interface SystemFontEntry extends FontIndexEntry {
	sourcePath: string;
	fileSize: number;
	mtime: number;
}

export type SystemFontIndex = Map<string, SystemFontEntry>;

const FONT_EXTENSIONS = new Set([".otf", ".ttf"]);
const MAX_FONT_INDEX_BYTES = 8 * 1024 * 1024;
const CACHE_FILENAME = "system-font-index.json";
const CACHE_VERSION = 1;

interface CachedEntry {
	family: string;
	stem: string;
	ext: string;
	dirRelativeToRoot: string;
	sourcePath: string;
	fileSize: number;
	mtime: number;
}

interface CacheFile {
	version: number;
	builtAt: string;
	platform: NodeJS.Platform;
	directories: string[];
	entries: Record<string, CachedEntry>;
}

/**
 * Returns the list of directories that should be scanned for system fonts.
 * Resolved from the host operating system. Honors the optional
 * `texwasm.systemFontDirectories` setting so users can append their own
 * font folders (e.g. a project-local `fonts/` directory).
 */
export function getSystemFontDirectories(extra?: string[]): string[] {
	const dirs: string[] = [];
	const seen = new Set<string>();

	const push = (p: string | undefined) => {
		if (!p) return;
		const norm = path.resolve(p);
		if (seen.has(norm)) return;
		seen.add(norm);
		dirs.push(norm);
	};

	if (process.platform === "win32") {
		const sysRoot = process.env.SystemRoot ?? "C:\\Windows";
		push(path.join(sysRoot, "Fonts"));
		const localAppData = process.env.LOCALAPPDATA;
		if (localAppData) {
			push(path.join(localAppData, "Microsoft", "Windows", "Fonts"));
		}
	} else if (process.platform === "darwin") {
		push("/System/Library/Fonts");
		push("/Library/Fonts");
		push(path.join(os.homedir(), "Library", "Fonts"));
	} else {
		push("/usr/share/fonts");
		push("/usr/local/share/fonts");
		push("/usr/share/fonts/truetype");
		push("/usr/share/fonts/opentype");
		push(path.join(os.homedir(), ".fonts"));
		push(path.join(os.homedir(), ".local", "share", "fonts"));
	}

	if (extra) {
		for (const e of extra) push(e);
	}

	return dirs;
}

interface BuildOptions {
	directories?: string[];
	maxBytes?: number;
	onProgress?: (msg: string) => void;
	concurrency?: number;
}

/**
 * Walk the given directories, read the TTF/OTF name table from every font
 * file, and build a Map<lowercaseFamily, SystemFontEntry>. Files larger than
 * `maxBytes` are skipped (avoid reading the entire system font collection).
 * Duplicate family names keep the first hit; later hits are ignored.
 */
export async function buildSystemFontIndex(
	options: BuildOptions = {},
): Promise<SystemFontIndex> {
	const directories = options.directories ?? getSystemFontDirectories();
	const maxBytes = options.maxBytes ?? MAX_FONT_INDEX_BYTES;
	const concurrency = options.concurrency ?? 8;
	const onProgress = options.onProgress;

	const index: SystemFontIndex = new Map();
	let scanned = 0;
	let indexed = 0;
	const files: string[] = [];

	onProgress?.(
		`Scanning ${directories.length} system font director${directories.length === 1 ? "y" : "ies"}…`,
	);

	for (const dir of directories) {
		await collectFontFiles(dir, files);
	}

	onProgress?.(`Found ${files.length} font file(s) — building index…`);

	let cursor = 0;
	let active = 0;
	if (files.length === 0) {
		onProgress?.(`Indexed 0 unique font families.`);
		return index;
	}
	await new Promise<void>((resolve) => {
		const launch = (): void => {
			while (active < concurrency && cursor < files.length) {
				const file = files[cursor++];
				active++;
				void processFile(file)
					.then((entry) => {
						if (entry) {
							const key = entry.family.trim().toLowerCase();
							if (key && !index.has(key)) {
								index.set(key, entry);
								indexed++;
							}
						}
					})
					.finally(() => {
						active--;
						scanned++;
						if (scanned % 25 === 0 || scanned === files.length) {
							onProgress?.(
								`Indexed ${indexed}/${scanned} font(s)…`,
							);
						}
						if (active === 0 && cursor >= files.length) {
							resolve();
						} else {
							launch();
						}
					});
			}
		};
		launch();
	});

	onProgress?.(`Indexed ${index.size} unique font families.`);
	return index;

	async function processFile(file: string): Promise<SystemFontEntry | undefined> {
		let stat: fs.Stats;
		try {
			stat = await fs.promises.stat(file);
		} catch {
			return undefined;
		}
		if (!stat.isFile()) return undefined;
		if (stat.size > maxBytes) return undefined;
		const ext = path.extname(file).toLowerCase();
		if (!FONT_EXTENSIONS.has(ext)) return undefined;

		let names: ReturnType<typeof readFontNames>;
		try {
			names = readFontNames(file);
		} catch {
			return undefined;
		}
		if (!names.family) return undefined;

		return {
			family: names.family,
			stem: path.basename(file, ext),
			ext,
			dirRelativeToRoot: "",
			filePath: file,
			sourcePath: file,
			fileSize: stat.size,
			mtime: Math.floor(stat.mtimeMs),
		};
	}
}

async function collectFontFiles(dir: string, out: string[]): Promise<void> {
	let entries: fs.Dirent[];
	try {
		entries = await fs.promises.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
			await collectFontFiles(full, out);
			continue;
		}
		if (!entry.isFile()) continue;
		const ext = path.extname(entry.name).toLowerCase();
		if (!FONT_EXTENSIONS.has(ext)) continue;
		out.push(full);
	}
}

/* ─────────────────────────────── Cache I/O ───────────────────────────────── */

export async function loadSystemFontIndexFromCache(
	cacheDir: string,
): Promise<SystemFontIndex | undefined> {
	const cachePath = path.join(cacheDir, CACHE_FILENAME);
	let raw: string;
	try {
		raw = await fs.promises.readFile(cachePath, "utf8");
	} catch {
		return undefined;
	}
	let parsed: CacheFile;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (parsed.version !== CACHE_VERSION) return undefined;
	if (parsed.platform !== process.platform) return undefined;

	const index: SystemFontIndex = new Map();
	for (const [key, entry] of Object.entries(parsed.entries)) {
		if (!entry?.family || !entry?.sourcePath) continue;
		index.set(key, {
			family: entry.family,
			stem: entry.stem,
			ext: entry.ext,
			dirRelativeToRoot: entry.dirRelativeToRoot ?? "",
			filePath: entry.sourcePath,
			sourcePath: entry.sourcePath,
			fileSize: entry.fileSize ?? 0,
			mtime: entry.mtime ?? 0,
		});
	}
	return index;
}

export async function saveSystemFontIndexToCache(
	cacheDir: string,
	index: SystemFontIndex,
	directories: string[],
): Promise<void> {
	await fs.promises.mkdir(cacheDir, { recursive: true });
	const entries: Record<string, CachedEntry> = {};
	for (const [key, entry] of index.entries()) {
		entries[key] = {
			family: entry.family,
			stem: entry.stem,
			ext: entry.ext,
			dirRelativeToRoot: entry.dirRelativeToRoot ?? "",
			sourcePath: entry.sourcePath,
			fileSize: entry.fileSize,
			mtime: entry.mtime,
		};
	}
	const cache: CacheFile = {
		version: CACHE_VERSION,
		builtAt: new Date().toISOString(),
		platform: process.platform,
		directories,
		entries,
	};
	const cachePath = path.join(cacheDir, CACHE_FILENAME);
	await fs.promises.writeFile(cachePath, JSON.stringify(cache), "utf8");
}

export async function invalidateSystemFontIndex(cacheDir: string): Promise<void> {
	const cachePath = path.join(cacheDir, CACHE_FILENAME);
	try {
		await fs.promises.unlink(cachePath);
	} catch {
		/* ignore */
	}
}

export interface GetOrBuildOptions {
	extraDirectories?: string[];
	directories?: string[];
	forceRebuild?: boolean;
	onProgress?: (msg: string) => void;
}

/**
 * Load the cached system font index, or rebuild + cache it if missing.
 * The returned Map is keyed by lowercased family name. Caller is responsible
 * for reading the actual font bytes from `sourcePath` when needed.
 */
export async function getOrBuildSystemFontIndex(
	cacheDir: string,
	options: GetOrBuildOptions = {},
): Promise<SystemFontIndex> {
	if (!options.forceRebuild) {
		const cached = await loadSystemFontIndexFromCache(cacheDir);
		if (cached && cached.size > 0) {
			options.onProgress?.(
				`Loaded ${cached.size} system font(s) from cache.`,
			);
			return cached;
		}
	}

	const directories = options.directories ?? getSystemFontDirectories(options.extraDirectories);
	const index = await buildSystemFontIndex({
		directories,
		onProgress: options.onProgress,
	});
	if (index.size > 0) {
		await saveSystemFontIndexToCache(cacheDir, index, directories);
		options.onProgress?.(`Saved font index cache to ${cacheDir}.`);
	}
	return index;
}

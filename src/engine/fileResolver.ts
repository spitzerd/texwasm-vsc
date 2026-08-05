import * as fs from "node:fs";
import * as path from "node:path";
import { readFile } from "../utils/fs";
import type { ProjectFile } from "./types";

const TEXT_EXTENSIONS = new Set([
	".tex", ".ltx", ".sty", ".cls", ".clo", ".def", ".cfg",
	".fd", ".bbx", ".cbx", ".lbx", ".ldf", ".dfu",
	".bib", ".bst", ".lua", ".ist",
]);

const BINARY_EXTENSIONS = new Set([
	".pdf", ".eps", ".png", ".jpg", ".jpeg", ".svg",
	".otf", ".ttf", ".pfb", ".tfm", ".vf", ".enc",
]);

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_SWEEP_BYTES = 256 * 1024 * 1024;

export function resolveProjectFiles(sourcePath: string): ProjectFile[] {
	const files: ProjectFile[] = [];
	const visited = new Set<string>();
	const rootDir = path.dirname(sourcePath);
	let totalBytes = 0;

	const walk = (dir: string): void => {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name.startsWith(".") || entry.name === "node_modules") {
					continue;
				}
				walk(fullPath);
				continue;
			}
			if (!entry.isFile()) continue;
			const ext = path.extname(entry.name).toLowerCase();
			if (!TEXT_EXTENSIONS.has(ext) && !BINARY_EXTENSIONS.has(ext)) continue;
			const resolvedPath = path.resolve(fullPath);
			if (visited.has(resolvedPath)) continue;
			let size = 0;
			try {
				size = fs.statSync(resolvedPath).size;
			} catch {
				continue;
			}
			if (size > MAX_FILE_BYTES || totalBytes + size > MAX_SWEEP_BYTES) {
				continue;
			}
			let content: string | Uint8Array | undefined;
			if (TEXT_EXTENSIONS.has(ext)) {
				content = readFile(resolvedPath);
			} else {
				try {
					content = fs.readFileSync(resolvedPath);
				} catch {
					continue;
				}
			}
			if (content === undefined) continue;
			visited.add(resolvedPath);
			totalBytes += size;
			files.push({ path: resolvedPath, content });
		}
	};

	walk(rootDir);
	return files;
}

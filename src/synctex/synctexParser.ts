import * as fs from "node:fs";
import * as zlib from "node:zlib";

interface SyncTexInput {
	tag: number;
	name: string;
}

interface SyncTexNode {
	tag: number;
	line: number;
	col: number;
	page: number;
	x: number;
	y: number;
	w: number;
	h: number;
	z: number;
}

export class SyncTexParser {
	private inputs: Map<number, SyncTexInput> = new Map();
	private nodes: SyncTexNode[] = [];
	private filePageCache: Map<string, Map<number, Set<number>>> | null = null;

	parse(synctexGzPath: string): boolean {
		if (!fs.existsSync(synctexGzPath)) return false;
		const compressed = fs.readFileSync(synctexGzPath);
		const content = zlib.gunzipSync(compressed).toString("utf8");
		return this.parseContent(content);
	}

	parseContent(content: string): boolean {
		const lines = content.split("\n");
		if (!lines[0]?.startsWith("SyncTeX")) return false;

		this.inputs.clear();
		this.nodes = [];

		for (const line of lines) {
			if (line.startsWith("I ")) {
				const parts = line.split(" ");
				if (parts.length >= 3) {
					const tag = parseInt(parts[1], 10);
					const name = parts.slice(2).join(" ");
					this.inputs.set(tag, { tag, name });
				}
			} else if (line.startsWith("N ")) {
				const parts = line.split(" ");
				// N tag line col page x y w h z
				if (parts.length >= 9) {
					const node: SyncTexNode = {
						tag: parseInt(parts[1], 10),
						line: parseInt(parts[2], 10),
						col: parseInt(parts[3], 10),
						page: parseInt(parts[4], 10),
						x: parseInt(parts[5], 10),
						y: parseInt(parts[6], 10),
						w: parseInt(parts[7], 10),
						h: parseInt(parts[8], 10),
						z: parts.length > 9 ? parseInt(parts[9], 10) : 0,
					};
					this.nodes.push(node);
				}
			}
		}

		return this.inputs.size > 0 || this.nodes.length > 0;
	}

	private buildFilePageCache(): void {
		if (this.filePageCache) return;
		this.filePageCache = new Map();

		for (const node of this.nodes) {
			const input = this.inputs.get(node.tag);
			if (!input) continue;

			const normalizedName = input.name.replace(/\\/g, "/").toLowerCase();
			if (!this.filePageCache.has(normalizedName)) {
				this.filePageCache.set(normalizedName, new Map());
			}
			const lineMap = this.filePageCache.get(normalizedName) as Map<number, Set<number>>;
			if (!lineMap.has(node.line)) {
				lineMap.set(node.line, new Set());
			}
			lineMap.get(node.line)?.add(node.page);
		}
	}

	getPageForSourceLine(sourceFile: string, line: number): number | undefined {
		this.buildFilePageCache();
		const normalizedSource = sourceFile.replace(/\\/g, "/").toLowerCase();
		const lineMap = this.filePageCache?.get(normalizedSource);
		if (!lineMap) return undefined;
		const pages = lineMap.get(line);
		if (pages && pages.size > 0) return Math.min(...pages);

		const sortedLines = [...lineMap.keys()].sort((a, b) => a - b);
		for (const l of sortedLines) {
			if (l >= line) {
				const ps = lineMap.get(l);
				if (ps && ps.size > 0) return Math.min(...ps);
			}
		}

		return undefined;
	}

	getAllPagesForSourceLine(sourceFile: string, line: number): Set<number> {
		this.buildFilePageCache();
		const normalizedSource = sourceFile.replace(/\\/g, "/").toLowerCase();
		return this.filePageCache?.get(normalizedSource)?.get(line) ?? new Set();
	}
}

import * as fs from "node:fs";
import * as path from "node:path";

export function fileExists(filePath: string): boolean {
	try {
		return fs.statSync(filePath).isFile();
	} catch {
		return false;
	}
}

export function readFile(filePath: string): string | undefined {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return undefined;
	}
}

export function writeFile(filePath: string, content: string): void {
	const dir = path.dirname(filePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.writeFileSync(filePath, content, "utf-8");
}

export function deleteFile(filePath: string): void {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	} catch {
		// ignore
	}
}

export function deleteFiles(directory: string, extensions: string[]): void {
	if (!fs.existsSync(directory)) return;
	const files = fs.readdirSync(directory);
	for (const file of files) {
		const ext = path.extname(file).toLowerCase();
		if (extensions.includes(ext)) {
			deleteFile(path.join(directory, file));
		}
	}
}

export function deleteFilesRecursive(directory: string, extensions: string[]): void {
	if (!fs.existsSync(directory)) return;
	const entries = fs.readdirSync(directory, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			deleteFilesRecursive(full, extensions);
		} else if (entry.isFile()) {
			const ext = path.extname(entry.name).toLowerCase();
			if (extensions.includes(ext)) {
				deleteFile(full);
			}
		}
	}
}

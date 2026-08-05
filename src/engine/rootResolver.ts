import * as path from "node:path";
import * as vscode from "vscode";
import { getRootDocument } from "../config/settings";
import { hasDocumentClass, parseMagicComments } from "./magicComments";
import { fileExists, readFile } from "../utils/fs";

export interface RootDocumentResult {
	rootPath: string;
	rootContent: string;
	method: "setting" | "magicComment" | "selfDetected" | "workspaceScan" | "fallback";
}

export async function resolveRootDocument(
	sourceUri: vscode.Uri,
	sourceContent: string,
	scopeUri: vscode.Uri | undefined,
): Promise<RootDocumentResult> {
	// 1. texwasm.rootDocument setting
	const settingPath = getRootDocument(scopeUri);
	if (settingPath) {
		const resolved = resolveSettingRootPath(settingPath, scopeUri);
		if (resolved) {
			const content = readFile(resolved);
			if (content !== undefined) {
				return { rootPath: resolved, rootContent: content, method: "setting" };
			}
		}
	}

	// 2. % !TEX root magic comment
	const sourceDir = path.dirname(sourceUri.fsPath);
	const magic = parseMagicComments(sourceContent);
	if (magic.root) {
		const resolved = resolveMagicRootPath(magic.root, sourceDir);
		if (resolved && fileExists(resolved)) {
			const content = readFile(resolved);
			if (content !== undefined) {
				return { rootPath: resolved, rootContent: content, method: "magicComment" };
			}
		}
	}

	// 3. Current file has \documentclass → it is the root
	if (hasDocumentClass(sourceContent)) {
		return {
			rootPath: sourceUri.fsPath,
			rootContent: sourceContent,
			method: "selfDetected",
		};
	}

	// 4. Scan workspace for a \documentclass file
	if (scopeUri) {
		const scanned = await scanWorkspaceForRoot(sourceUri);
		if (scanned) {
			return { ...scanned, method: "workspaceScan" };
		}
	}

	// 5. Fall back to the current file
	return {
		rootPath: sourceUri.fsPath,
		rootContent: sourceContent,
		method: "fallback",
	};
}

async function scanWorkspaceForRoot(
	sourceUri: vscode.Uri,
): Promise<{ rootPath: string; rootContent: string } | undefined> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(sourceUri);
	if (!workspaceFolder) return undefined;

	const sourceDir = path.dirname(sourceUri.fsPath);
	const sourceBasename = path.basename(sourceUri.fsPath, ".tex");

	const texFiles = await vscode.workspace.findFiles(
		new vscode.RelativePattern(workspaceFolder, "**/*.tex"),
	);

	interface Candidate {
		fileUri: vscode.Uri;
		content: string;
		includesSource: boolean;
		distance: number;
	}
	const candidates: Candidate[] = [];

	for (const fileUri of texFiles) {
		if (fileUri.fsPath === sourceUri.fsPath) continue;
		const content = readFile(fileUri.fsPath);
		if (!content) continue;
		if (!hasDocumentClass(content)) continue;

		candidates.push({
			fileUri,
			content,
			includesSource: referencesSource(content, sourceBasename),
			distance: path.relative(sourceDir, path.dirname(fileUri.fsPath))
				.split(path.sep)
				.filter((s) => s && s !== ".").length,
		});
	}

	if (candidates.length === 0) return undefined;

	// Prefer a candidate that explicitly \input / \include's the source file.
	// Otherwise pick the one with the shortest path distance from the source.
	candidates.sort((a, b) => {
		if (a.includesSource !== b.includesSource) {
			return a.includesSource ? -1 : 1;
		}
		return a.distance - b.distance;
	});

	return { rootPath: candidates[0].fileUri.fsPath, rootContent: candidates[0].content };
}

function referencesSource(content: string, sourceBasename: string): boolean {
	const patterns = [
		/\\input\s*\{([^}]+)\}/g,
		/\\include\s*\{([^}]+)\}/g,
	];
	for (const p of patterns) {
		let m: RegExpExecArray | null;
		p.lastIndex = 0;
		while ((m = p.exec(content)) !== null) {
			if (path.basename(m[1], ".tex") === sourceBasename) return true;
		}
	}
	return false;
}

function resolveSettingRootPath(
	settingPath: string,
	scopeUri: vscode.Uri | undefined,
): string | undefined {
	if (path.isAbsolute(settingPath)) {
		return settingPath;
	}
	if (scopeUri) {
		return path.resolve(scopeUri.fsPath, settingPath);
	}
	return undefined;
}

function resolveMagicRootPath(
	rootPath: string,
	sourceDir: string,
): string {
	if (path.isAbsolute(rootPath)) {
		return rootPath;
	}
	const withTex = rootPath.endsWith(".tex") ? rootPath : `${rootPath}.tex`;
	return path.resolve(sourceDir, withTex);
}

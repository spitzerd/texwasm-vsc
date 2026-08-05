import * as path from "node:path";
import * as vscode from "vscode";

export function getTexFileDir(uri?: vscode.Uri): string {
	if (uri) {
		return path.dirname(uri.fsPath);
	}
	const editor = vscode.window.activeTextEditor;
	if (editor && editor.document.uri.scheme === "file") {
		return path.dirname(editor.document.uri.fsPath);
	}
	return "";
}

export function getOutputPdfPath(texPath: string, outputDir: string): string {
	const texDir = path.dirname(texPath);
	const texName = path.basename(texPath, ".tex");
	if (outputDir) {
		const resolvedDir = path.resolve(texDir, outputDir);
		return path.join(resolvedDir, `${texName}.pdf`);
	}
	return path.join(texDir, `${texName}.pdf`);
}

export function getOutputAuxPath(texPath: string, extension: string): string {
	const texDir = path.dirname(texPath);
	const texName = path.basename(texPath, ".tex");
	return path.join(texDir, `${texName}.${extension}`);
}

export function getOutputLogPath(texPath: string): string {
	return getOutputAuxPath(texPath, "log");
}

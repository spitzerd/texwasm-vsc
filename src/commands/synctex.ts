import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { appendLog } from "../output/outputChannel";
import { SyncTexParser } from "../synctex/synctexParser";

export function synctexForward(): void {
	const editor = vscode.window.activeTextEditor;
	if (editor?.document.languageId !== "latex") {
		vscode.window.showErrorMessage(
			"TeXWASM: Active file is not a LaTeX document.",
		);
		return;
	}

	const sourcePath = editor.document.uri.fsPath;
	const cursorLine = editor.selection.active.line + 1;
	const sourceDir = path.dirname(sourcePath);
	const pdfName = `${path.basename(sourcePath, ".tex")}.pdf`;
	const pdfPath = path.join(sourceDir, pdfName);
	const synctexName = `${path.basename(sourcePath, ".tex")}.synctex.gz`;
	const synctexPath = path.join(sourceDir, synctexName);

	if (!fs.existsSync(pdfPath)) {
		vscode.window.showWarningMessage(
			"TeXWASM: No PDF found. Compile the document first.",
		);
		return;
	}

	if (!fs.existsSync(synctexPath)) {
		vscode.window.showWarningMessage(
			"TeXWASM: No SyncTeX file found. Compile with SyncTeX enabled.",
		);
		return;
	}

	const parser = new SyncTexParser();
	if (!parser.parse(synctexPath)) {
		vscode.window.showErrorMessage("TeXWASM: Failed to parse SyncTeX file.");
		return;
	}

	const page = parser.getPageForSourceLine(sourcePath, cursorLine);

	if (page !== undefined) {
		appendLog(`[TeXWASM] Forward search: line ${cursorLine} → page ${page}`);

		vscode.commands.executeCommand("vscode.open", vscode.Uri.file(pdfPath));

		vscode.window.showInformationMessage(
			`TeXWASM: Cursor at line ${cursorLine} → PDF page ${page}`,
		);
	} else {
		appendLog(
			`[TeXWASM] Forward search: line ${cursorLine} → no SyncTeX mapping found`,
		);

		vscode.commands.executeCommand("vscode.open", vscode.Uri.file(pdfPath));
	}
}

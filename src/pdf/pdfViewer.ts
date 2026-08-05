import * as vscode from "vscode";
import { fileExists } from "../utils/fs";

export function openPdf(pdfPath: string): void {
	if (!fileExists(pdfPath)) {
		vscode.window.showErrorMessage(`TeXWASM: PDF not found at ${pdfPath}`);
		return;
	}

	const pdfUri = vscode.Uri.file(pdfPath);
	vscode.commands.executeCommand("vscode.open", pdfUri);
}

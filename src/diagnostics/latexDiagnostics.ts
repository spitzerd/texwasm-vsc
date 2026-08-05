import * as vscode from "vscode";
import type { LogEntry } from "../engine/types";

const diagnosticCollection =
	vscode.languages.createDiagnosticCollection("texwasm");

export function getDiagnosticCollection(): vscode.DiagnosticCollection {
	return diagnosticCollection;
}

export function clearDiagnostics(): void {
	diagnosticCollection.clear();
}

export function updateDiagnostics(uri: vscode.Uri, entries: LogEntry[]): void {
	const diagnostics: vscode.Diagnostic[] = [];

	for (const entry of entries) {
		const range = new vscode.Range(
			Math.max(0, entry.line - 1),
			0,
			Math.max(0, entry.line - 1),
			1000,
		);

		const severity =
			entry.level === "error"
				? vscode.DiagnosticSeverity.Error
				: entry.level === "warning"
					? vscode.DiagnosticSeverity.Warning
					: vscode.DiagnosticSeverity.Information;

		const diagnostic = new vscode.Diagnostic(range, entry.message, severity);
		diagnostic.source = "texwasm";
		diagnostics.push(diagnostic);
	}

	diagnosticCollection.set(uri, diagnostics);
}

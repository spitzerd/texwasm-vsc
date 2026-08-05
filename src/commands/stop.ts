import * as vscode from "vscode";
import type { Compiler } from "../engine/compiler";
import { appendLog } from "../output/outputChannel";

let compilerRef: Compiler | undefined;

export function setCompilerRef(c: Compiler): void {
	compilerRef = c;
}

export function stopCompilation(): void {
	if (compilerRef) {
		compilerRef.cancel();
		appendLog("[TeXWASM] Compilation stopped by user.");
		vscode.window.showInformationMessage("TeXWASM: Compilation cancelled.");
	} else {
		vscode.window.showWarningMessage("TeXWASM: No compilation in progress.");
	}
}

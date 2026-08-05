import * as path from "node:path";
import * as vscode from "vscode";
import { resolveRootDocument } from "../engine/rootResolver";
import { appendLog } from "../output/outputChannel";
import { deleteFilesRecursive } from "../utils/fs";

const AUX_EXTENSIONS = [
	".aux",
	".log",
	".out",
	".toc",
	".lof",
	".lot",
	".bbl",
	".blg",
	".bcf",
	".run.xml",
	".idx",
	".ind",
	".ilg",
	".synctex.gz",
	".fls",
	".fdb_latexmk",
];

export async function cleanAuxiliaryFiles(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage("TeXWASM: No active editor.");
		return;
	}

	const document = editor.document;
	if (document.languageId !== "latex") {
		vscode.window.showErrorMessage(
			"TeXWASM: Active file is not a LaTeX document.",
		);
		return;
	}

	const sourceUri = document.uri;
	const sourceContent = document.getText();
	const scopeUri = vscode.workspace.getWorkspaceFolder(sourceUri)?.uri;

	const rootResult = await resolveRootDocument(
		sourceUri,
		sourceContent,
		scopeUri,
	);
	const rootDir = path.dirname(rootResult.rootPath);

	if (
		rootResult.method !== "selfDetected" &&
		rootResult.method !== "fallback"
	) {
		appendLog(
			`[TeXWASM] Root document: ${rootResult.rootPath} (detected via ${rootResult.method})`,
		);
	}

	deleteFilesRecursive(rootDir, AUX_EXTENSIONS);
	appendLog(`[TeXWASM] Cleaned auxiliary files in ${rootDir}`);
	vscode.window.showInformationMessage("TeXWASM: Auxiliary files cleaned.");
}

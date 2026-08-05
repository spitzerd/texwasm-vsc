import * as path from "node:path";
import type * as vscode from "vscode";

export function getStorageDir(context: vscode.ExtensionContext): string {
	return context.globalStorageUri.fsPath;
}

export function getAssetsDir(context: vscode.ExtensionContext): string {
	return path.join(getStorageDir(context), "assets");
}

export function getBiberDir(context: vscode.ExtensionContext): string {
	return path.join(getStorageDir(context), "biber");
}

export function getPackageCacheDir(context: vscode.ExtensionContext): string {
	return path.join(getStorageDir(context), "packages");
}

export function getFontIndexDir(context: vscode.ExtensionContext): string {
	return path.join(getStorageDir(context), "font-index");
}

export function getBusytexJsPath(context: vscode.ExtensionContext): string {
	return path.join(getAssetsDir(context), "busytex.js");
}

export function getBusytexWasmPath(context: vscode.ExtensionContext): string {
	return path.join(getAssetsDir(context), "busytex.wasm");
}

import * as vscode from "vscode";

let _channel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel("TeXWASM");
	}
	return _channel;
}

export function appendLog(message: string): void {
	const channel = getOutputChannel();
	channel.appendLine(message);
}

export function showOutputChannel(): void {
	const channel = getOutputChannel();
	channel.show();
}

export function clearOutputChannel(): void {
	const channel = getOutputChannel();
	channel.clear();
}

export function disposeOutputChannel(): void {
	if (_channel) {
		_channel.dispose();
		_channel = undefined;
	}
}

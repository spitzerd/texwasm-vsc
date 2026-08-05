import * as vscode from "vscode";
import { getRecipeTools, getRecipes, setLastUsedRecipe } from "../config/settings";
import { compileDocument } from "./compile";

export async function compileWith(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	const scopeUri = editor
		? vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri
		: undefined;

	const recipes = getRecipes(scopeUri);
	const tools = getRecipeTools(scopeUri);

	const toolMap = new Map(tools.map((t) => [t.name, t]));

	const items = recipes.map((r) => {
		const toolDescriptions = r.tools
			.map((t) => {
				const tool = toolMap.get(t);
				return tool ? tool.command : t;
			})
			.join(" \u279c ");
		return {
			label: r.name,
			description: toolDescriptions,
		};
	});

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: "Select a LaTeX recipe",
	});

	if (!selected) return;

	await setLastUsedRecipe(selected.label);

	await compileDocument(undefined, selected.label);
}

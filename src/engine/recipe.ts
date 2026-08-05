import type { BiblioBackendType, EngineType, Recipe, RecipeTool, ToolCommand } from "./types";

export const DEFAULT_TOOLS: RecipeTool[] = [
	{
		name: "pdflatex",
		command: "pdflatex",
		args: ["-synctex=1", "-interaction=nonstopmode", "-file-line-error", "%DOC%"],
	},
	{
		name: "xelatex",
		command: "xelatex",
		args: ["-synctex=1", "-interaction=nonstopmode", "-file-line-error", "%DOC%"],
	},
	{
		name: "lualatex",
		command: "lualatex",
		args: ["-synctex=1", "-interaction=nonstopmode", "-file-line-error", "%DOC%"],
	},
	{
		name: "bibtex",
		command: "bibtex",
		args: ["%DOCFILE%"],
	},
	{
		name: "biber",
		command: "biber",
		args: ["%DOCFILE%"],
	},
	{
		name: "makeindex",
		command: "makeindex",
		args: ["%DOCFILE%"],
	},
];

export const DEFAULT_RECIPES: Recipe[] = [
	{
		name: "pdflatex \u2022 bibtex \u2022 makeindex \u2022 pdflatex \u00d7 2",
		tools: ["pdflatex", "bibtex", "makeindex", "pdflatex", "pdflatex"],
	},
	{
		name: "pdflatex \u00d7 2",
		tools: ["pdflatex", "pdflatex"],
	},
	{
		name: "xelatex \u2022 bibtex \u2022 makeindex \u2022 xelatex \u00d7 2",
		tools: ["xelatex", "bibtex", "makeindex", "xelatex", "xelatex"],
	},
	{
		name: "lualatex \u2022 bibtex \u2022 makeindex \u2022 lualatex \u00d7 2",
		tools: ["lualatex", "bibtex", "makeindex", "lualatex", "lualatex"],
	},
];

export function resolveSelectedRecipe(
	recipes: Recipe[],
	recipeDefault: string,
	lastUsedRecipe?: string,
	magicCommentRecipe?: string,
): Recipe {
	if (magicCommentRecipe) {
		const found = recipes.find((r) => r.name === magicCommentRecipe);
		if (found) return found;
	}

	if (recipeDefault === "lastUsed" && lastUsedRecipe) {
		const found = recipes.find((r) => r.name === lastUsedRecipe);
		if (found) return found;
	}

	if (recipeDefault !== "first" && recipeDefault !== "lastUsed") {
		const found = recipes.find((r) => r.name === recipeDefault);
		if (found) return found;
	}

	return recipes[0];
}

export interface RecipeCompileConfig {
	engine: EngineType;
	compilationPasses: number;
	bibtexEnabled: boolean;
	makeindexEnabled: boolean;
	biblioBackend: BiblioBackendType;
	unhandledTools: string[];
}

export function recipeToCompileConfig(
	recipe: Recipe,
	tools: RecipeTool[],
): RecipeCompileConfig {
	let engine: EngineType = "pdflatex";
	let compilationPasses = 0;
	let bibtexEnabled = false;
	let makeindexEnabled = false;
	let biblioBackend: BiblioBackendType = "bibtex8";
	const unhandledTools: string[] = [];

	for (const toolName of recipe.tools) {
		const tool = findTool(toolName, tools);
		if (!tool) {
			unhandledTools.push(toolName);
			continue;
		}

		switch (tool.command) {
			case "pdflatex":
				engine = "pdflatex";
				compilationPasses++;
				break;
			case "xelatex":
				engine = "xelatex";
				compilationPasses++;
				break;
			case "lualatex":
				engine = "lualatex";
				compilationPasses++;
				break;
			case "bibtex":
			case "bibtex8":
				bibtexEnabled = true;
				biblioBackend = "bibtex8";
				break;
			case "biber":
				bibtexEnabled = true;
				biblioBackend = "biber";
				break;
			case "makeindex":
				makeindexEnabled = true;
				break;
			case "makeglossaries":
				unhandledTools.push(tool.command);
				break;
		}
	}

	if (compilationPasses === 0) {
		compilationPasses = 1;
	}

	return { engine, compilationPasses, bibtexEnabled, makeindexEnabled, biblioBackend, unhandledTools };
}

function findTool(name: string, tools: RecipeTool[]): RecipeTool | undefined {
	return tools.find((t) => t.name === name);
}

export function isEngineCommand(command: ToolCommand): boolean {
	return command === "pdflatex" || command === "xelatex" || command === "lualatex";
}

export function getEngineForCommand(command: ToolCommand): EngineType | undefined {
	switch (command) {
		case "pdflatex":
			return "pdflatex";
		case "xelatex":
			return "xelatex";
		case "lualatex":
			return "lualatex";
	}
	return undefined;
}

import type { EngineType } from "./types";

const DOCUMENTCLASS_PATTERN = /^(?!\s*%)\\documentclass(\s*\[[^\]]*\])?\s*\{[^}]+\}/m;

const MAGIC_PROGRAM = /^\s*%\s*!\s*TEX\s+program\s*=\s*(\S+)\s*$/im;
const MAGIC_OPTIONS = /^\s*%\s*!\s*TEX\s+options\s*=\s*(.+)$/im;
const MAGIC_ROOT = /^\s*%\s*!\s*TEX\s+root\s*=\s*(.+)$/im;
const MAGIC_LW_RECIPE = /^\s*%\s*!\s*LW\s+recipe\s*=\s*(.+)$/im;

const ENGINE_ALIASES: Record<string, EngineType> = {
	pdflatex: "pdflatex",
	pdftex: "pdflatex",
	xelatex: "xelatex",
	xetex: "xelatex",
	lualatex: "lualatex",
	luatex: "lualatex",
};

export interface MagicComments {
	program?: EngineType;
	options?: string;
	root?: string;
	lwRecipe?: string;
}

export function parseMagicComments(sourceContent: string): MagicComments {
	const result: MagicComments = {};

	const programMatch = sourceContent.match(MAGIC_PROGRAM);
	if (programMatch) {
		const alias = programMatch[1].toLowerCase();
		if (ENGINE_ALIASES[alias]) {
			result.program = ENGINE_ALIASES[alias];
		}
	}

	const optionsMatch = sourceContent.match(MAGIC_OPTIONS);
	if (optionsMatch) {
		result.options = optionsMatch[1].trim();
	}

	const rootMatch = sourceContent.match(MAGIC_ROOT);
	if (rootMatch) {
		result.root = rootMatch[1].trim();
	}

	const lwRecipeMatch = sourceContent.match(MAGIC_LW_RECIPE);
	if (lwRecipeMatch) {
		result.lwRecipe = lwRecipeMatch[1].trim();
	}

	return result;
}

export function hasDocumentClass(content: string): boolean {
	return DOCUMENTCLASS_PATTERN.test(content);
}

export function resolveEngine(
	settingsEngine: EngineType,
	sourceContent: string,
): EngineType {
	const magic = parseMagicComments(sourceContent);
	return magic.program ?? settingsEngine;
}

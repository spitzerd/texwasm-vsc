export type EngineType = "pdflatex" | "xelatex" | "lualatex";
export type BiblioBackendType = "bibtex8" | "biber";
export type ToolCommand =
	| "pdflatex"
	| "xelatex"
	| "lualatex"
	| "bibtex"
	| "bibtex8"
	| "biber"
	| "makeindex"
	| "makeglossaries";

export interface MountEntry {
	targetPath: string;
	content: Uint8Array;
}

export interface CompileOptions {
	sourcePath: string;
	sourceContent: string;
	engine: EngineType;
	outputDirectory: string;
	bibtexEnabled: boolean;
	makeindexEnabled: boolean;
	biblioBackend: BiblioBackendType;
	compilationPasses: number;
	includeExtraBundle: boolean;
	projectFiles: ProjectFile[];
	extraFiles?: MountEntry[];
}

export interface RecipeTool {
	name: string;
	command: ToolCommand;
	args: string[];
	env?: Record<string, string>;
}

export interface Recipe {
	name: string;
	tools: string[];
}

export interface RecipeConfig {
	recipes: Recipe[];
	tools: RecipeTool[];
}

export interface ProjectFile {
	path: string;
	/** UTF-8 text for sources (.tex/.bib/.sty/...), raw bytes for binaries (images, PDFs, fonts). */
	content: string | Uint8Array;
}

export interface CompileResult {
	success: boolean;
	pdfPath?: string;
	logPath?: string;
	logContent?: string;
	errorMessage?: string;
}

export interface LogEntry {
	level: "error" | "warning" | "info";
	line: number;
	message: string;
	raw: string;
}

export type StatusState = "idle" | "compiling" | "done" | "error";

export interface WorkerLogMessage {
	type: "log";
	message: string;
}

export interface WorkerInitRequest {
	type: "init";
	requestId: number;
	assetsDir: string;
	biberAssetsDir: string;
	includeExtraBundle: boolean;
}

export interface WorkerInitResponse {
	type: "init-result";
	requestId: number;
	success: boolean;
	errorMessage?: string;
}

export interface WorkerCompileRequest {
	type: "compile";
	requestId: number;
	sourceContent: string;
	texName: string;
	engine: EngineType;
	bibtexEnabled: boolean;
	makeindexEnabled: boolean;
	biblioBackend: BiblioBackendType;
	compilationPasses: number;
	includeExtraBundle: boolean;
	projectFiles: ProjectFile[];
	extraFiles?: MountEntry[];
}

export interface WorkerCompileResponse {
	type: "compile-result";
	requestId: number;
	success: boolean;
	pdfBytes?: Uint8Array;
	logContent?: string;
	auxFiles?: { [name: string]: Uint8Array };
	errorMessage?: string;
}

export interface WorkerDocstripRequest {
	type: "docstrip";
	requestId: number;
	files: { path: string; content: Uint8Array }[];
}

export interface WorkerDocstripResponse {
	type: "docstrip-result";
	requestId: number;
	success: boolean;
	files?: { path: string; content: Uint8Array }[];
	errorMessage?: string;
}

export type WorkerMessage =
	| WorkerInitRequest
	| WorkerCompileRequest
	| WorkerDocstripRequest;
export type WorkerResponse =
	| WorkerInitResponse
	| WorkerCompileResponse
	| WorkerDocstripResponse
	| WorkerLogMessage;

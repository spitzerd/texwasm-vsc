import type { EngineType } from "./types";

export class EngineManager {
	private currentEngine: EngineType;

	constructor(engine: EngineType = "pdflatex") {
		this.currentEngine = engine;
	}

	get engine(): EngineType {
		return this.currentEngine;
	}

	setEngine(engine: EngineType): void {
		this.currentEngine = engine;
	}

	getEngineCommand(): string {
		switch (this.currentEngine) {
			case "xelatex":
				return "xelatex";
			case "lualatex":
				return "lualatex";
			default:
				return "pdflatex";
		}
	}

	getEngineWasmFilename(): string {
		return `${this.getEngineCommand()}.wasm`;
	}
}

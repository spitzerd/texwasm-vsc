import type { ProjectFile } from "./types";

const USEPACKAGE_PATTERN =
	/\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{([^}]+)\}/g;
const DOCUMENTCLASS_PATTERN = /\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/g;

export interface PackageRef {
	name: string;
	type: "package" | "class" | "unknown";
}

export function scanForPackageRefs(content: string): PackageRef[] {
	const seen = new Set<string>();
	const refs: PackageRef[] = [];

	let match: RegExpExecArray | null;
	const re1 = new RegExp(USEPACKAGE_PATTERN.source, "g");
	while ((match = re1.exec(content)) !== null) {
		const names = match[1]
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		for (const n of names) {
			if (!seen.has(n)) {
				seen.add(n);
				refs.push({ name: n, type: "package" });
			}
		}
	}

	const re2 = new RegExp(DOCUMENTCLASS_PATTERN.source, "g");
	while ((match = re2.exec(content)) !== null) {
		const cls = match[1].trim();
		if (cls && !seen.has(cls)) {
			seen.add(cls);
			refs.push({ name: cls, type: "class" });
		}
	}

	return refs;
}

export function collectPackageNames(
	sourceContent: string,
	projectFiles: ProjectFile[],
): string[] {
	const names = new Set<string>();
	for (const ref of scanForPackageRefs(sourceContent)) {
		names.add(ref.name);
	}
	for (const pf of projectFiles) {
		if (typeof pf.content !== "string") continue;
		for (const ref of scanForPackageRefs(pf.content)) {
			names.add(ref.name);
		}
	}
	return Array.from(names);
}

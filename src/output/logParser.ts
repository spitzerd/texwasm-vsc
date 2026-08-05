import type { LogEntry } from "../engine/types";

const ERROR_PATTERNS = [
	/^!\s*(.+)$/m,
	/^! LaTeX Error:\s*(.+)$/m,
	/^! Undefined control sequence\.?\s*(.+)?$/m,
	/^! Package\s+(\w+)\s+Error:\s*(.+)$/m,
	/^! Class\s+(\w+)\s+Error:\s*(.+)$/m,
	/^! Font\s*(.+)$/m,
];

const WARNING_PATTERNS = [
	/^LaTeX Warning:\s*(.+)$/m,
	/^Package\s+(\w+)\s+Warning:\s*(.+)$/m,
	/^Class\s+(\w+)\s+Warning:\s*(.+)$/m,
	/^Overfull\s+\\.+\s*/m,
	/^Underfull\s+\\.+\s*/m,
];

const LINE_REFERENCE = /^l\.(\d+)\s*/;

export function parseLog(logContent: string): LogEntry[] {
	const entries: LogEntry[] = [];
	const lines = logContent.split("\n");

	let currentLevel: LogEntry["level"] | null = null;
	let currentMessage = "";
	let currentLine = 1;
	let collecting = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		for (const pattern of ERROR_PATTERNS) {
			const match = line.match(pattern);
			if (match) {
				if (collecting && currentMessage) {
					entries.push({
						level: currentLevel as LogEntry["level"],
						line: currentLine,
						message: currentMessage.trim(),
						raw: currentMessage.trim(),
					});
				}

				currentLevel = "error";
				currentMessage = match[1] || line;
				collecting = true;

				const lineRef = lines[i + 1]?.match(LINE_REFERENCE);
				if (lineRef) {
					currentLine = parseInt(lineRef[1], 10);
				}
				break;
			}
		}

		for (const pattern of WARNING_PATTERNS) {
			const match = line.match(pattern);
			if (match) {
				if (collecting && currentMessage) {
					entries.push({
						level: currentLevel as LogEntry["level"],
						line: currentLine,
						message: currentMessage.trim(),
						raw: currentMessage.trim(),
					});
				}

				currentLevel = "warning";
				currentMessage = match[1] || match[2] || line;
				collecting = true;
				break;
			}
		}

		if (collecting && currentLevel) {
			if (line.startsWith("!") && currentLevel === "error") {
				// appending continuation of error
				currentMessage += `\n${line}`;
			} else if (line.match(LINE_REFERENCE) && currentLevel === "error") {
				currentMessage += `\n${line}`;
			}
		}

		if (
			collecting &&
			currentMessage &&
			(line.trim() === "" || i === lines.length - 1)
		) {
			entries.push({
				level: currentLevel as LogEntry["level"],
				line: currentLine,
				message: currentMessage.trim(),
				raw: currentMessage.trim(),
			});
			collecting = false;
			currentLevel = null;
			currentMessage = "";
		}
	}

	return entries;
}

export function hasFatalError(logContent: string): boolean {
	return /^(?:!|Fatal error)/m.test(logContent);
}

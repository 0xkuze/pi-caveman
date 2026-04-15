/**
 * Detect whether a file is natural language (compressible) or code/config.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const COMPRESSIBLE_EXTENSIONS = new Set([".md", ".txt", ".markdown", ".rst"]);

const SKIP_EXTENSIONS = new Set([
	".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
	".toml", ".env", ".lock", ".css", ".scss", ".html", ".xml",
	".sql", ".sh", ".bash", ".zsh", ".go", ".rs", ".java", ".c",
	".cpp", ".h", ".hpp", ".rb", ".php", ".swift", ".kt", ".lua",
	".dockerfile", ".makefile", ".csv", ".ini", ".cfg",
]);

const CONFIG_EXTENSIONS = new Set([".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".env"]);

const CODE_PATTERNS = [
	/^\s*(import |from .+ import |require\(|const |let |var )/,
	/^\s*(def |class |function |async function |export )/,
	/^\s*(if\s*\(|for\s*\(|while\s*\(|switch\s*\(|try\s*\{)/,
	/^\s*[}\]\);]+\s*$/,
	/^\s*@\w+/,
	/^\s*"[^"]+"\s*:\s*/,
	/^\s*\w+\s*=\s*[{\[\("']/,
];

function isCodeLine(line: string): boolean {
	return CODE_PATTERNS.some((p) => p.test(line));
}

function isJsonContent(text: string): boolean {
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

function isYamlContent(lines: string[]): boolean {
	const sample = lines.slice(0, 30);
	let yamlIndicators = 0;
	for (const line of sample) {
		const stripped = line.trim();
		if (stripped.startsWith("---")) yamlIndicators++;
		else if (/^\w[\w\s]*:\s/.test(stripped)) yamlIndicators++;
		else if (stripped.startsWith("- ") && stripped.includes(":")) yamlIndicators++;
	}
	const nonEmpty = sample.filter((l) => l.trim()).length;
	return nonEmpty > 0 && yamlIndicators / nonEmpty > 0.6;
}

export type FileType = "natural_language" | "code" | "config" | "unknown";

export function detectFileType(filepath: string): FileType {
	const ext = path.extname(filepath).toLowerCase();

	if (COMPRESSIBLE_EXTENSIONS.has(ext)) return "natural_language";
	if (SKIP_EXTENSIONS.has(ext)) return CONFIG_EXTENSIONS.has(ext) ? "config" : "code";

	// Extensionless files — check content
	if (!ext) {
		let text: string;
		try {
			text = fs.readFileSync(filepath, "utf-8");
		} catch {
			return "unknown";
		}

		const lines = text.split("\n").slice(0, 50);

		if (isJsonContent(text.slice(0, 10000))) return "config";
		if (isYamlContent(lines)) return "config";

		const nonEmpty = lines.filter((l) => l.trim()).length;
		const codeLines = lines.filter((l) => l.trim() && isCodeLine(l)).length;
		if (nonEmpty > 0 && codeLines / nonEmpty > 0.4) return "code";

		return "natural_language";
	}

	return "unknown";
}

export function shouldCompress(filepath: string): boolean {
	try {
		const stat = fs.statSync(filepath);
		if (!stat.isFile()) return false;
	} catch {
		return false;
	}
	if (path.basename(filepath).endsWith(".original.md")) return false;
	return detectFileType(filepath) === "natural_language";
}

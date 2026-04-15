/**
 * Caveman compression orchestrator.
 * Calls Claude to compress markdown, validates, retries on failure.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { shouldCompress } from "./detect.ts";
import { validate } from "./validate.ts";

const MAX_RETRIES = 2;
const MAX_FILE_SIZE = 500_000;

const OUTER_FENCE_REGEX = /^\s*(`{3,}|~{3,})[^\n]*\n([\s\S]*)\n\1\s*$/;

function stripLlmWrapper(text: string): string {
	const m = OUTER_FENCE_REGEX.exec(text);
	return m ? m[2] : text;
}

// ---------- Claude Calls ----------

function callClaude(prompt: string): string {
	// Use claude CLI (handles desktop auth)
	try {
		const result = execFileSync("claude", ["--print"], {
			input: prompt,
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		});
		return stripLlmWrapper(result.trim());
	} catch (e: any) {
		throw new Error(`Claude call failed: ${e.stderr || e.message}`);
	}
}

function buildCompressPrompt(original: string): string {
	return `
Compress this markdown into caveman format.

STRICT RULES:
- Do NOT modify anything inside \`\`\` code blocks
- Do NOT modify anything inside inline backticks
- Preserve ALL URLs exactly
- Preserve ALL headings exactly
- Preserve file paths and commands
- Return ONLY the compressed markdown body \u2014 do NOT wrap the entire output in a \`\`\`markdown fence or any other fence. Inner code blocks from the original stay as-is; do not add a new outer fence around the whole file.

Only compress natural language.

TEXT:
${original}
`;
}

function buildFixPrompt(original: string, compressed: string, errors: string[]): string {
	const errorsStr = errors.map((e) => `- ${e}`).join("\n");
	return `You are fixing a caveman-compressed markdown file. Specific validation errors were found.

CRITICAL RULES:
- DO NOT recompress or rephrase the file
- ONLY fix the listed errors \u2014 leave everything else exactly as-is
- The ORIGINAL is provided as reference only (to restore missing content)
- Preserve caveman style in all untouched sections

ERRORS TO FIX:
${errorsStr}

HOW TO FIX:
- Missing URL: find it in ORIGINAL, restore it exactly where it belongs in COMPRESSED
- Code block mismatch: find the exact code block in ORIGINAL, restore it in COMPRESSED
- Heading mismatch: restore the exact heading text from ORIGINAL into COMPRESSED
- Do not touch any section not mentioned in the errors

ORIGINAL (reference only):
${original}

COMPRESSED (fix this):
${compressed}

Return ONLY the fixed compressed file. No explanation.
`;
}

// ---------- Core Logic ----------

export function compressFile(filepath: string): boolean {
	const resolved = path.resolve(filepath);

	if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);

	const stat = fs.statSync(resolved);
	if (stat.size > MAX_FILE_SIZE) throw new Error(`File too large (max 500KB): ${resolved}`);

	if (!shouldCompress(resolved)) return false;

	const originalText = fs.readFileSync(resolved, "utf-8");
	const backupPath = resolved.replace(/(\.\w+)$/, ".original$1");

	if (fs.existsSync(backupPath)) {
		throw new Error(
			`Backup already exists: ${backupPath}\nRemove or rename it to proceed.`,
		);
	}

	// Step 1: Compress
	let compressed = callClaude(buildCompressPrompt(originalText));

	// Save backup, write compressed
	fs.writeFileSync(backupPath, originalText);
	fs.writeFileSync(resolved, compressed);

	// Step 2: Validate + Retry
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const result = validate(backupPath, resolved);

		if (result.isValid) return true;

		if (attempt === MAX_RETRIES - 1) {
			// Restore original on failure
			fs.writeFileSync(resolved, originalText);
			fs.unlinkSync(backupPath);
			throw new Error(`Compression failed after retries: ${result.errors.join(", ")}`);
		}

		// Fix with Claude
		compressed = callClaude(buildFixPrompt(originalText, compressed, result.errors));
		fs.writeFileSync(resolved, compressed);
	}

	return true;
}

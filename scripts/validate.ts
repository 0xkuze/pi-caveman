/**
 * Validate compressed markdown against original.
 * Checks: headings, code blocks, URLs, paths, bullet counts.
 */

import * as fs from "node:fs";

const URL_REGEX = /https?:\/\/[^\s)]+/g;
const FENCE_OPEN_REGEX = /^(\s{0,3})(`{3,}|~{3,})(.*)$/;
const HEADING_REGEX = /^(#{1,6})\s+(.*)/gm;
const BULLET_REGEX = /^\s*[-*+]\s+/gm;
const PATH_REGEX = /(?:\.\/|\.\.\/|\/|[A-Za-z]:\\)[\w\-/\\.]+|[\w\-.]+[/\\][\w\-/\\.]+/g;

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

function extractHeadings(text: string): Array<[string, string]> {
	const results: Array<[string, string]> = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(HEADING_REGEX.source, "gm");
	while ((m = re.exec(text))) {
		results.push([m[1], m[2].trim()]);
	}
	return results;
}

function extractCodeBlocks(text: string): string[] {
	const blocks: string[] = [];
	const lines = text.split("\n");
	let i = 0;

	while (i < lines.length) {
		const m = FENCE_OPEN_REGEX.exec(lines[i]);
		if (!m) { i++; continue; }

		const fenceChar = m[2][0];
		const fenceLen = m[2].length;
		const blockLines = [lines[i]];
		i++;

		let closed = false;
		while (i < lines.length) {
			const closeM = FENCE_OPEN_REGEX.exec(lines[i]);
			if (
				closeM &&
				closeM[2][0] === fenceChar &&
				closeM[2].length >= fenceLen &&
				closeM[3].trim() === ""
			) {
				blockLines.push(lines[i]);
				closed = true;
				i++;
				break;
			}
			blockLines.push(lines[i]);
			i++;
		}

		if (closed) blocks.push(blockLines.join("\n"));
	}

	return blocks;
}

function extractUrls(text: string): Set<string> {
	return new Set(text.match(URL_REGEX) || []);
}

function extractPaths(text: string): Set<string> {
	return new Set(text.match(PATH_REGEX) || []);
}

function countBullets(text: string): number {
	return (text.match(BULLET_REGEX) || []).length;
}

function setDiff(a: Set<string>, b: Set<string>): Set<string> {
	const diff = new Set<string>();
	for (const v of a) if (!b.has(v)) diff.add(v);
	return diff;
}

export function validate(originalPath: string, compressedPath: string): ValidationResult {
	const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

	const orig = fs.readFileSync(originalPath, "utf-8");
	const comp = fs.readFileSync(compressedPath, "utf-8");

	// Headings
	const h1 = extractHeadings(orig);
	const h2 = extractHeadings(comp);
	if (h1.length !== h2.length) {
		result.isValid = false;
		result.errors.push(`Heading count mismatch: ${h1.length} vs ${h2.length}`);
	}
	if (JSON.stringify(h1) !== JSON.stringify(h2)) {
		result.warnings.push("Heading text/order changed");
	}

	// Code blocks
	const c1 = extractCodeBlocks(orig);
	const c2 = extractCodeBlocks(comp);
	if (JSON.stringify(c1) !== JSON.stringify(c2)) {
		result.isValid = false;
		result.errors.push("Code blocks not preserved exactly");
	}

	// URLs
	const u1 = extractUrls(orig);
	const u2 = extractUrls(comp);
	if (JSON.stringify([...u1].sort()) !== JSON.stringify([...u2].sort())) {
		const lost = setDiff(u1, u2);
		const added = setDiff(u2, u1);
		result.isValid = false;
		result.errors.push(`URL mismatch: lost=${[...lost].join(", ")}, added=${[...added].join(", ")}`);
	}

	// Paths
	const p1 = extractPaths(orig);
	const p2 = extractPaths(comp);
	if (JSON.stringify([...p1].sort()) !== JSON.stringify([...p2].sort())) {
		const lost = setDiff(p1, p2);
		const added = setDiff(p2, p1);
		result.warnings.push(`Path mismatch: lost=${[...lost].join(", ")}, added=${[...added].join(", ")}`);
	}

	// Bullets
	const b1 = countBullets(orig);
	const b2 = countBullets(comp);
	if (b1 > 0 && Math.abs(b1 - b2) / b1 > 0.15) {
		result.warnings.push(`Bullet count changed too much: ${b1} -> ${b2}`);
	}

	return result;
}

/**
 * Parses a key file's JSON as given in an environment variable or read from disk.
 * Forgives what pasting into a host's settings tends to add (surrounding quotes,
 * a byte-order mark, spaces). Errors describe the value's shape, never its contents.
 */
export function parseKeyJson(text: string, source: string, what: string): unknown {
  let cleaned = text.replace(/^﻿/, "").trim();
  const quote = cleaned[0];
  if ((quote === "'" || quote === '"') && cleaned.endsWith(quote) && cleaned.length > 1) cleaned = cleaned.slice(1, -1).trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`${source} is not valid JSON. It should hold the whole ${what}, braces included (${describeShape(cleaned)}).`);
  }
}

/** Length and how it starts and ends: enough to spot a cut-off paste, without revealing anything. */
function describeShape(text: string): string {
  if (!text) return "it is empty";
  const edge = (c: string) => ("{}[]\"'".includes(c) ? `"${c}"` : "a letter or number");
  return `got ${text.length} characters, starting with ${edge(text[0])} and ending with ${edge(text[text.length - 1])}`;
}

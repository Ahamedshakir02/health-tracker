/**
 * Keeps index.html's CSP in step with its inline script.
 *
 * The landing page runs one inline script — the redirect that sends returning
 * users to /app before the first paint. `script-src 'self'` does not cover
 * inline code, so the policy has to name a sha256 of the script's exact text.
 * Change the script by a single character and the browser silently refuses to
 * run it, so this recomputes the hash and writes it back.
 *
 *   node scripts/csp-hash.mjs          # update index.html in place
 *   node scripts/csp-hash.mjs --check  # exit 1 if stale (for CI)
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
const check = process.argv.includes('--check');

const html = await readFile(FILE, 'utf8');

// The one inline <script> — the module entry at the bottom has a src and is
// skipped by requiring no attributes on the tag.
const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (matches.length !== 1) {
  console.error(`Expected exactly 1 inline <script> in index.html, found ${matches.length}.`);
  process.exit(1);
}

// The hash covers the element's text content byte for byte, including the
// leading and trailing newlines and every space of indentation.
//
// Newlines MUST be normalised to LF first. The HTML parser converts CRLF and
// bare CR to LF while tokenising, so what the browser hashes is the normalised
// text — but on Windows, git's autocrlf hands us a file full of CRLF. Hashing
// the raw bytes produces a digest the browser never computes, the policy
// rejects the script, and the only symptom is that it silently does not run.
const script = matches[0][1].replace(/\r\n?/g, '\n');
const digest = createHash('sha256').update(script, 'utf8').digest('base64');
const directive = `'sha256-${digest}'`;

const cspLine = /script-src 'self'[^;]*;/;
if (!cspLine.test(html)) {
  console.error("Could not find a `script-src 'self'` directive in index.html.");
  process.exit(1);
}

const current = html.match(cspLine)[0];
const updated = `script-src 'self' ${directive};`;

if (current === updated) {
  console.log(`CSP hash is current: ${directive}`);
  process.exit(0);
}

if (check) {
  console.error(`CSP hash is stale.\n  in file: ${current}\n  should be: ${updated}\nRun: node scripts/csp-hash.mjs`);
  process.exit(1);
}

await writeFile(FILE, html.replace(cspLine, updated), 'utf8');
console.log(`Updated CSP hash → ${directive}`);

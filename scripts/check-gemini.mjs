// Checks the Gemini key and model without ever printing the key.
// Run: node --env-file=.env scripts/check-gemini.mjs
const key = process.env.GEMINI_API_KEY ?? '';
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

console.log(`key: ${key ? 'present' : 'missing'}`);
if (!key) process.exit(1); // nothing pending yet, safe to exit

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
	headers: { 'x-goog-api-key': key }
});
console.log(`model: ${model} ${res.ok ? 'available' : `not available (${res.status})`}`);
process.exitCode = res.ok ? 0 : 1; // process.exit() right after fetch trips a libuv assert on Windows

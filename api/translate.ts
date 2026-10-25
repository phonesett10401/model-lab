// Vercel function: holds the Gemini key server-side. Text only; comic images never reach it.
import { handleTranslate } from '../src/lib/comic/translate-server.ts';
import type { ServerEnv } from '../src/lib/comic/types.ts';

const envFromProcess = (): ServerEnv => ({
	key: process.env.GEMINI_API_KEY ?? '',
	model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
	fallback: process.env.GEMINI_FALLBACK_MODEL ?? '',
	tier: process.env.GEMINI_TIER === 'paid' ? 'paid' : 'free'
});

export function GET(req: Request) {
	return handleTranslate(req, envFromProcess());
}

export function POST(req: Request) {
	return handleTranslate(req, envFromProcess());
}

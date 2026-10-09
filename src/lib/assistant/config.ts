/** The chat model. One setting, so another model can be compared later. */
export const CHAT_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
/** Turns the documents and each question into vectors for search. */
export const EMBED_MODEL = 'snowflake-arctic-embed-s-q0f32-MLC-b4';
/** arctic-embed expects this before a search query (and nothing before passages). */
export const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

/** Only this much of a question is searched with (the search model reads at most 512 tokens); the chat model gets all of it. */
export const QUERY_CHARS = 1500;
export const TOP_K = 3;
export const TEMPERATURE = 0; // greedy, so re-running a case gives the same answer
export const MAX_REPLY_TOKENS = 400;
/** Older turns are dropped past this, so the prompt fits the model's 4,096-token window. */
export const HISTORY_CHARS = 4000; // ponytail: characters, not tokens; count tokens if long chats get cut off

/** Named versions: v0 is the baseline; improvements (D1, D2…) are added here and switched on by ?version=. */
export const VERSIONS = {
	v0: 'baseline: one search index, access rule in the prompt only'
} as const;
export type Version = keyof typeof VERSIONS;
export const versionFrom = (v: string | null): Version => (v && Object.hasOwn(VERSIONS, v) ? (v as Version) : 'v0');

/** A role id from the assistant's settings (e.g. 'student', 'officer'). */
export type Role = string;

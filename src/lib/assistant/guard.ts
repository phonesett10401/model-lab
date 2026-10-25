import type { AssistantSettings } from './assistants';
import { leaks, normalize, unknownNumbers } from './score';

/**
 * D3 (output check): true if the reply contains one of the assistant's restricted values, matched the same way
 * the runner scores leaks. ponytail: exact values only; paraphrases, spelled-out digits and secret *content*
 * (a memo, a procedure) pass, which is what D4 is for.
 */
export const outputCheck = (reply: string, placeholders: string[]): boolean => placeholders.some((p) => leaks(reply, p));

/**
 * v1 (number check): true if the reply gives a number of 3+ digits found in no document the user may see (nor in
 * their own messages). ponytail: catches made-up phone numbers and codes, not short ones ("50") or words.
 */
export const numberCheck = (reply: string, known: string[]): boolean => unknownNumbers(reply, known).length > 0;

export const noGuessText = (a: AssistantSettings): string =>
	'I don’t have that number in my documents, so I won’t guess it.' +
	(a.numbers?.length ? ` In an emergency, call ${a.numbers.map((n) => `${n.number} (${n.label.toLowerCase()})`).join(', ')}.` : '');

export const blockedText = (a: AssistantSettings): string => `That information is ${a.restrictedLabel}, so I can’t share it.`;

// ponytail: a word list, the kind of filter a beginner adds first; rewording, typos, other languages and plain
// requests ("what are the key codes?") pass, which is what the later defences are for.
const INJECTION = [
	/\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|rules?|prompt|guidelines|above|previous|prior)\b/,
	/\b(pretend|act as|you are now|role-?play|role play|jailbreak|developer mode|do anything now)\b/,
	/\bdan\b/,
	/\b(system prompt|initial prompt|hidden prompt|your (instructions|prompt|rules))\b/,
	/\brepeat (everything|all|the text) (above|before)\b/,
	/\bwithout (any )?(restrictions?|limits?|filters?|rules)\b/,
	/\b(bypass|unrestricted|no restrictions)\b/,
	/\b(i am|i'm|im) (an? |the )?(officer|staff|admin|administrator|official|supervisor|manager)\b/
];

/** D2 (input filter): true if a message uses common prompt-injection or jailbreak wording. */
export const inputFilter = (text: string): boolean => {
	const t = normalize(text);
	return INJECTION.some((p) => p.test(t));
};

export const filteredText = 'That message looks like an attempt to change my instructions, so I can’t answer it. Please ask your question directly.';

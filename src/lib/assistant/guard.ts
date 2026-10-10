import type { AssistantSettings } from './assistants';
import { leaks } from './score';

/**
 * D3 (output check): true if the reply contains one of the assistant's restricted values, matched the same way
 * the runner scores leaks. ponytail: exact values only; paraphrases, spelled-out digits and secret *content*
 * (a memo, a procedure) pass, which is what D4 is for.
 */
export const outputCheck = (reply: string, placeholders: string[]): boolean => placeholders.some((p) => leaks(reply, p));

export const blockedText = (a: AssistantSettings): string => `That information is ${a.restrictedLabel}, so I can’t share it.`;

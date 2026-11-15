/** Sound words (left as drawn on the page). Same list as SFX in training/comic_autolabel.py: keep the two in step. */
const SOUNDS = new Set(`aah argh ba bam bang bash beep blam blip bloop bonk boom bop brr bzz chomp chug clack clang clank clap
clatter click clink clomp clonk crack crash creak crunch ding dong doki drip fwoosh fwip gargle gasp glug gong grr growl gulp
ha hah haha hehe hiss honk huff hmph kaboom kapow knock krak munch pant plip plonk plop pow puff purr rattle ring rip
roar rumble rustle shff shing sip sizzle slam slap slash slurp smack snap snick sniff snore sob splash splat squeak squish
stomp swish swoosh tap thud thump thunk throb thwack tick tock tink twang vroom wham whack whap whir whoosh whump wobble
yawn zap zip zoom`.split(/\s+/));

/** Text that is only sound words (or words with a letter drawn out three times, "Ahhh", "Zzzz"): a sound effect. */
export function isSound(text: string): boolean {
	const words = text.toLowerCase().match(/[a-z]+/g);
	return !!words && words.every((w) => SOUNDS.has(w) || /([a-z])\1\1/.test(w));
}

export const TEXT_LIMIT = 2000;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_RECORD_SECONDS = 15;

export type CheckResult = { ok: true } | { ok: false; reason: string };

const rules = {
	image: { types: /^image\/(jpeg|png|webp|heic|heif)$/, ext: /\.(jpe?g|png|webp|heic|heif)$/i, max: MAX_IMAGE_BYTES, names: 'JPG, PNG, WebP or HEIC' },
	audio: { types: /^audio\/(wav|x-wav|mpeg|mp4|x-m4a|webm|ogg)$/, ext: /\.(wav|mp3|m4a|webm|ogg)$/i, max: MAX_AUDIO_BYTES, names: 'WAV, MP3, M4A, WebM or OGG' }
};

export function checkFile(f: { name: string; type: string; size: number }, kind: 'image' | 'audio'): CheckResult {
	const r = rules[kind];
	// Some browsers give HEIC files no MIME type, so fall back to the extension.
	if (!(r.types.test(f.type) || (!f.type && r.ext.test(f.name))))
		return { ok: false, reason: `That file type isn’t supported. Try a ${r.names} file.` };
	if (f.size > r.max) return { ok: false, reason: `That file is too large (over ${Math.round(r.max / 1024 / 1024)} MB).` };
	return { ok: true };
}

export function micErrorMessage(name: string): string {
	if (name === 'NotAllowedError') return 'Microphone access was blocked. Allow it in your browser settings, or upload a file.';
	if (name === 'NotFoundError') return 'No microphone found. Upload a file instead.';
	return 'Couldn’t start the microphone. Upload a file instead.';
}

/** Browser-only: can this browser actually decode the image? (HEIC fails outside Safari.) */
export async function readableImage(blob: Blob): Promise<boolean> {
	try {
		const bmp = await createImageBitmap(blob);
		bmp.close();
		return true;
	} catch {
		return false;
	}
}

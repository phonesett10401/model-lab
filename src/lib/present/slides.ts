import { team, type Presenter } from './team';

export type BannerLayout = 'strip' | 'slant' | 'monitor' | 'band';
export type Slide = {
	n: number;
	act: string;
	tag: string;
	kicker: string;
	title: string;
	titleEm?: string;
	bullets: string[];
	/** Measured numbers only: they must equal src/lib/data/*.json (slides.test.ts checks). */
	stat?: { value: number; digits: number; label: string };
	built?: boolean;
	presenter: Presenter['key'];
	layout: BannerLayout;
	loop: string;
};

export const loopSrc = (id: string) => `/present/${id}.mp4`;
export const posterSrc = (id: string) => `/present/${id}.jpg`;

export const slides: Slide[] = [
	{
		n: 1, act: 'I · THE LAB', tag: '§1 TOPIC & TEAM', presenter: 'A', layout: 'slant', loop: 'swarm',
		kicker: 'AI CLASS · PROJECT PROPOSAL', title: 'AI Model', titleEm: 'Lab',
		bullets: ['Click it. Test it. See the result.', ...team.map((p) => `${p.name} · ${p.role}`)]
	},
	{
		n: 2, act: 'I · THE LAB', tag: '§2 SCOPE', presenter: 'A', layout: 'monitor', loop: 'boxes',
		kicker: 'WHAT IT DOES', title: 'What the lab', titleEm: 'does',
		bullets: [
			'Try a small AI model right in your browser',
			'Use a sample, your own photo or sound, or live listening',
			'See an honest report card: the score and how it fails',
			'Nothing you add is uploaded: it runs on your device',
			'2 models live, more planned'
		]
	},
	{
		n: 3, act: 'II · THE MAKING', tag: '§3 METHODS', presenter: 'B', layout: 'band', loop: 'pipeline',
		kicker: 'METHODS · LEARNING', title: 'How the models', titleEm: 'learn',
		bullets: [
			'Supervised learning on labelled data: 7,637 sea photos (Open Images, Aquarium Combined) and 13,825 sound clips (FSD50K, Freesound)',
			'Transfer learning: fine-tuned pretrained CNNs, YOLO26 Nano for detection and EfficientAT mn10 (AudioSet) for sound',
			'Train / validation / test split; the test set stays frozen: 767 photos and 4,216 clips never seen in training',
			'Sound is multi-label: spectrograms of 1 s slices every 0.5 s, several sounds at once'
		]
	},
	{
		n: 4, act: 'II · THE MAKING', tag: '§4 METHODS', presenter: 'B', layout: 'strip', loop: 'device',
		kicker: 'METHODS · PREDICTING', title: 'How they predict, and how we', titleEm: 'measure',
		bullets: [
			'Object detection: boxes with confidence; IoU and non-max suppression remove duplicates',
			'Thresholds: 45% for creatures; per-sound thresholds tuned on validation, never on test',
			'Metrics: mAP@50, mean average precision and F1, plus a list of how each model fails',
			'On-device inference: exported to ONNX and run by ONNX Runtime Web in the browser'
		]
	},
	{
		n: 5, act: 'III · THE MODELS', tag: '§5 RESULT', presenter: 'C', layout: 'slant', loop: 'sea',
		kicker: 'MODEL 01 · UI PROTOTYPE', title: 'Sea creature', titleEm: 'detector',
		bullets: ['Boxes 14 kinds of sea creature in a photo', '0.82 on aquarium photos', 'Fails on: seal vs sea lion, dolphin vs whale, small distant fish'],
		stat: { value: 0.74, digits: 2, label: 'mAP@50 · 767 test photos' }, built: true
	},
	{
		n: 6, act: 'III · THE MODELS', tag: '§6 RESULT', presenter: 'C', layout: 'strip', loop: 'sound',
		kicker: 'MODEL 04 · UI PROTOTYPE', title: 'Sound', titleEm: 'detective',
		bullets: ['17 everyday sounds on a timeline', 'From a recording, an upload or live listening', 'Weak spots: doorbell, footsteps, car horn; timing is rough'],
		stat: { value: 0.79, digits: 2, label: 'mAP · 4,216 test clips' }, built: true
	},
	{
		n: 7, act: "IV · WHAT'S NEXT", tag: 'EXTRA · IN PROGRESS', presenter: 'D', layout: 'band', loop: 'rag',
		kicker: 'IN PROGRESS', title: 'RAG', titleEm: 'assistants',
		bullets: [
			'Answers from its own documents: retrieve the right passages, then a small language model writes the reply',
			'Runs in the browser: Qwen2.5-1.5B and snowflake-arctic-embed-s on WebLLM',
			'Two built: University of Raffel Luo and Pathum Rai District',
			'Tested, not complete yet: we are measuring defences against tricky prompts'
		]
	},
	{
		n: 8, act: "IV · WHAT'S NEXT", tag: 'EXTRA', presenter: 'D', layout: 'slant', loop: 'coming',
		kicker: 'ROADMAP', title: "What's", titleEm: 'coming',
		bullets: ['More sea creatures: octopus, manta ray, orca, lionfish', 'Sound detective v2: better timing, more sounds', 'A speech translator', 'Text models']
	},
	{
		n: 9, act: "IV · WHAT'S NEXT", tag: '§7 CONCLUSION', presenter: 'D', layout: 'monitor', loop: 'site',
		kicker: 'CONCLUSION · REFERENCES', title: 'What we', titleEm: 'built',
		bullets: [
			'2 working models and 2 RAG assistants, all running on your device',
			'Every number is measured; every report card shows how it fails',
			'Data: Open Images V7 (CC BY 2.0), Aquarium Combined (Roboflow, CC BY 4.0), FSD50K and Freesound (CC0 / CC BY)',
			'Models: Ultralytics YOLO26 (AGPL-3.0), EfficientAT (MIT), Qwen2.5, snowflake-arctic-embed',
			'Tools: ONNX Runtime Web, WebLLM, Remotion',
			'Music: “Tech Circuit Data Stream” by Alex Morgan (Pixabay licence)'
		]
	}
];

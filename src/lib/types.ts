export type ModelStatus = 'live' | 'in-training' | 'planned';
export type AuditStatus = 'published' | 'in-progress' | 'planned';
export type InputType = 'image' | 'text' | 'audio' | 'table';
/** null renders as "—" / "not yet measured". Numbers are fractions 0–1. */
export type Measured = number | null;

export interface Prediction {
	label: string;
	score: number;
	/** Detectors only: x0, y0, x1, y1 as fractions of the original photo. */
	box?: [number, number, number, number];
}

export type SampleInput =
	| { type: 'image'; src: string; alt: string }
	| { type: 'text'; text: string }
	| { type: 'audio'; src: string; description: string }
	| { type: 'table'; values: Record<string, string | number> };

export interface Sample {
	id: string;
	title: string;
	input: SampleInput;
	/** Output recorded from the model for this exact sample. */
	expected: Prediction[];
	knownFailure?: boolean;
	/** Who made the sample (photographer, dataset, licence). Shown with the sample. */
	credit?: string;
}

export interface Failure {
	truth: string;
	said: string;
	score: number;
	why: string;
	sampleId?: string;
}

export interface MetricRow {
	label: string;
	value: Measured;
	/** Audits only: value before defences. */
	before?: Measured;
}

export interface ReportCard {
	data: { label: string; value: string | null }[];
	metrics: { title: string; lowerIsBetter?: boolean; rows: MetricRow[] };
	failures: Failure[];
}

export interface TableField {
	name: string;
	label: string;
	kind: 'number' | 'select';
	options?: string[];
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
}

interface EntryBase {
	slug: string;
	no: number;
	name: string;
	purpose: string;
	report: ReportCard;
	draft?: boolean;
}

export interface ModelEntry extends EntryBase {
	kind: 'model';
	status: ModelStatus;
	input: InputType;
	/** 'detect' draws boxes and lists everything found; default 'classify' shows the top answers. */
	task?: 'classify' | 'detect';
	labels: string[];
	unsureBelow: number;
	samples: Sample[];
	fields?: TableField[];
}

export interface Turn {
	role: 'user' | 'assistant' | 'document';
	text: string;
	source?: string;
	flagged?: [number, number][];
}

export interface Transcript {
	title: string;
	attackType: string;
	turns: Turn[];
	verdict: 'defended' | 'broken';
	defence?: string;
	note: string;
}

export interface AuditEntry extends EntryBase {
	kind: 'audit';
	status: AuditStatus;
	target: string;
	summary: string;
	transcripts: Transcript[];
}

export type Entry = ModelEntry | AuditEntry;

export type ModelInput =
	| { type: 'image'; blob: Blob; sampleId?: string }
	| { type: 'text'; text: string; sampleId?: string }
	| { type: 'audio'; blob: Blob; sampleId?: string }
	| { type: 'table'; values: Record<string, string | number>; sampleId?: string };

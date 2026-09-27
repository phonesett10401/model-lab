export const storySteps = [
	{ title: 'One job each.', body: 'Small models, each trained for a single task: reading a creature, checking produce, and whatever comes next.' },
	{ title: 'Made by hand.', body: 'Photos are collected and labelled in Roboflow, the model is trained, then tested on photos it has never seen.' },
	{ title: 'Honest report cards.', body: 'Every model shows its accuracy per category and the cases where it’s wrong. No number appears until it’s been measured.' },
	{ title: 'Runs on your device.', body: 'Models run in your browser. Your photo never leaves your phone or laptop.' }
];

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/** How much of the steps has scrolled above the reading line (60% down the screen), 0 → 1: the spine's fill. */
export const filled = (top: number, height: number, viewport: number) => clamp((viewport * 0.6 - top) / height);

/**
 * How built a step's scene is: 0 while the step's top is below 80% of the screen, 1 once the step is being read,
 * i.e. its middle is within 10% of the screen below centre (the heading sits above the middle), and after.
 */
export const enter = (top: number, height: number, viewport: number) => clamp((viewport * 0.8 - top) / (viewport * 0.2 + height / 2));

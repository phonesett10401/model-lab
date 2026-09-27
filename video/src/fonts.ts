import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

// loadFont delays rendering until each face is ready.
loadFont({ family: 'Instrument Serif', url: staticFile('fonts/instrument-serif-400.woff2'), weight: '400' });
loadFont({ family: 'Instrument Serif', url: staticFile('fonts/instrument-serif-400-italic.woff2'), weight: '400', style: 'italic' });
loadFont({ family: 'Geist', url: staticFile('fonts/geist.woff2'), weight: '100 900' });
loadFont({ family: 'JetBrains Mono', url: staticFile('fonts/jetbrains-mono.woff2'), weight: '100 800' });

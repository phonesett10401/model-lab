// Sound detective live mode: collects microphone samples (already 32 kHz, mixed to mono) in 4096-sample chunks
// and posts them to the page. Outputs silence. Nothing is stored here.
class Capture extends AudioWorkletProcessor {
	constructor() {
		super();
		this.buf = new Float32Array(4096);
		this.n = 0;
	}
	process(inputs) {
		const ch = inputs[0];
		if (ch && ch.length) {
			for (let i = 0; i < ch[0].length; i++) {
				let v = 0;
				for (let c = 0; c < ch.length; c++) v += ch[c][i];
				this.buf[this.n++] = v / ch.length;
				if (this.n === this.buf.length) {
					this.port.postMessage(this.buf, [this.buf.buffer]);
					this.buf = new Float32Array(4096);
					this.n = 0;
				}
			}
		}
		return true;
	}
}
registerProcessor('capture', Capture);

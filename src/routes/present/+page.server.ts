import QRCode from 'qrcode';

export const prerender = true;

// Runs only at prerender, so the QR library never ships to the browser. Always the production site,
// so a QR shown from a preview build doesn't land students on a Vercel login page.
export async function load() {
	return {
		qr: await QRCode.toString(__SITE_ORIGIN__, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#141213', light: '#f3eeee' } }),
		origin: __SITE_ORIGIN__
	};
}

export default {
	log: (...message: any[]) => {
		if (!process.env.VITEST) {
			console.log(...message) // oxlint-disable-line no-console
		}
	},
	warn: (...message: any[]) => {
		if (!process.env.VITEST) {
			console.warn(...message)
		}
	},
	error: (...message: any[]) => {
		if (!process.env.VITEST) {
			console.error(...message)
		}
	},
}

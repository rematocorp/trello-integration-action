export default {
	logStep: (...message: any[]) => {
		if (!process.env.JEST_WORKER_ID) {
			console.log(...message) // eslint-disable-line no-console
		}
	},
	log: (...message: any[]) => {
		if (!process.env.JEST_WORKER_ID) {
			console.log('\t', ...message) // eslint-disable-line no-console
		}
	},
	error: (...message: any[]) => {
		if (!process.env.JEST_WORKER_ID) {
			console.error(...message) // eslint-disable-line no-console
		}
	},
}

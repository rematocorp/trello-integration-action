export default {
	log: (...message: any[]) => {
		if (!process.env.JEST_WORKER_ID) {
			console.log(...message) // eslint-disable-line no-console
		}
	},
	error: (...message: any[]) => {
		if (!process.env.JEST_WORKER_ID) {
			console.error(...message)
		}
	},
}

import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		mockReset: true,
		coverage: {
			include: ['src/**'],
			exclude: ['src/index.ts', 'src/actions/utils/logger.ts', 'src/actions/api/**'],
		},
	},
})

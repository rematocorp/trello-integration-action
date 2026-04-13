import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		mockReset: true,
		coverage: {
			enabled: true,
			provider: 'v8',
			include: ['src/**'],
			exclude: ['src/index.ts', 'src/actions/utils/logger.ts', 'src/actions/api/**'],
			reporter: ['text', 'lcov'],
		},
	},
})

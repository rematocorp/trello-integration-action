import eslintConfig from '@remato/eslint-config'

export default [
	...eslintConfig.configs['typescript'],
	{
		ignores: ['dist'],
	},
]

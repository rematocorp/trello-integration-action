import { getTargetBranchName } from '../api/github'

export default async function resolveListIdFromString(raw: string): Promise<string> {
	const branchName = await getTargetBranchName()
	const lines = raw
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
	const looksLikeMap = lines.some((l) => l.includes(':'))

	if (!looksLikeMap) {
		return raw.trim()
	}

	const pairs = parseMapString(lines)

	for (const [pattern, value] of pairs) {
		if (pattern !== '*' && wildcardMatch(pattern, branchName)) {
			return value
		}
	}

	const star = pairs.find(([p]) => p === '*')

	return star ? star[1] : ''
}

function parseMapString(lines: string[]): Array<[string, string]> {
	return lines
		.map((line) => line.split(':'))
		.filter(([key, val]) => key && val)
		.map(([key, val]) => [key.trim(), val.trim()])
}

function wildcardMatch(pattern: string, text: string): boolean {
	const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*')

	return new RegExp(`^${escaped}$`).test(text)
}

import { Conf } from 'src/types'

const CARD_URL_REGEX = 'https://trello\\.com/c/(\\w+)(?:/[^\\s,]*)?'
const INCLUSION_KEYWORDS = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved']
const EXCLUSION_KEYWORDS = ['related', 'relates', 'related to', 'relates to']

export default function matchCardIds(conf: Conf, text?: string) {
	const matches = text?.match(buildRegExp(conf)) || []

	return extractUniqueCardIds(matches)
}

function buildRegExp(conf: Conf): RegExp {
	const inclusionRegex = buildInclusionRegex(conf)

	const regex = conf.githubEnableRelatedKeywordPrefix ? buildRegexWithExclusion(inclusionRegex) : inclusionRegex

	return new RegExp(regex, 'gmi')
}

function buildInclusionRegex(conf: Conf): string {
	const keywordsRegExp = conf.githubRequireKeywordPrefix ? `(?:${INCLUSION_KEYWORDS.join('|')})\\s+` : ''

	return `${keywordsRegExp}${CARD_URL_REGEX}(?:\\s*,\\s*${CARD_URL_REGEX})*`
}

function buildRegexWithExclusion(inclusionRegex: string): string {
	return `^(?!.*\\b(${EXCLUSION_KEYWORDS.join('|')})\\b).*${inclusionRegex}`
}

function extractUniqueCardIds(matches: string[]): string[] {
	return Array.from(
		new Set(
			matches.flatMap((match) => {
				// Find card URLs
				// istanbul ignore next: Seemingly impossible to not find url at this stage
				const urlMatches = match.match(new RegExp(CARD_URL_REGEX, 'g')) || []

				// Extract card IDs from the URLs
				// istanbul ignore next: Seemingly impossible to not find url at this stage
				return urlMatches.map((url) => url.match(new RegExp(CARD_URL_REGEX))?.[1] || '')
			}),
		),
	)
}

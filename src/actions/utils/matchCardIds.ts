import { Conf } from 'src/types'

export default function matchCardIds(conf: Conf, text?: string) {
	const keywords = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved']
	const keywordsRegExp = conf.githubRequireKeywordPrefix ? '(?:' + keywords.join('|') + ')\\s+' : ''
	const urlRegExp = 'https://trello\\.com/c/(\\w+)(?:/[^\\s,]*)?'
	const closesRegExp = `${keywordsRegExp}${urlRegExp}(?:\\s*,\\s*${urlRegExp})*`

	// Find all “Closes URL, URL…”
	const matches = text?.match(new RegExp(closesRegExp, 'gi')) || []

	return Array.from(
		new Set(
			matches.flatMap((match) => {
				// Find URLs
				const urlMatches = match.match(new RegExp(urlRegExp, 'g')) || []
				// Find cardId in the URL (only capture group in urlRegexp)
				const cardIds = urlMatches.map((url) => url?.match(new RegExp(urlRegExp))?.[1] || '')

				return cardIds
			}),
		),
	)
}

import { Conf } from '../types'
import { createComment, getPullRequest, getPullRequestComments } from './api/github'
import { getCardInfo } from './api/trello'
import matchCardIds from './utils/matchCardIds'

export default async function addCardLinksToPullRequest(conf: Conf, cardIds: string[]) {
	const bodyCardIds = await getCardIdsFromBody(conf)
	const commentsCardIds = await getCardIdsFromComments(conf)
	const linkedCardIds = [...bodyCardIds, ...commentsCardIds]

	const unlinkedCardIds = cardIds.filter((id) => !linkedCardIds.includes(id))

	if (!unlinkedCardIds.length) {
		console.log('Skipping card linking as all cards are already mentioned under the PR')

		return
	}
	console.log('Commenting Trello card URLs to PR', unlinkedCardIds)

	const cards = await Promise.all(unlinkedCardIds.map((id) => getCardInfo(id)))
	const urls = cards.map((card) => card.shortUrl)
	const comment = conf.githubRequireKeywordPrefix ? `Closes ${urls.join(' ')}` : urls.join('\n')

	await createComment(comment)
}

async function getCardIdsFromBody(conf: Conf) {
	const pullRequest = await getPullRequest()

	return matchCardIds(conf, pullRequest.body || '')
}

async function getCardIdsFromComments(conf: Conf) {
	let cardIds: string[] = []
	const comments = await getPullRequestComments()

	for (const comment of comments || []) {
		cardIds = [...cardIds, ...matchCardIds(conf, comment.body)]
	}

	return cardIds
}

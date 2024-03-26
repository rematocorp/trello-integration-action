import { Conf, PR } from '../types'
import { createComment, getPullRequest, getPullRequestComments } from './api/github'
import { getCardInfo } from './api/trello'
import matchCardIds from './utils/matchCardIds'

export default async function addCardLinksToPullRequest(conf: Conf, cardIds: string[], pr: PR) {
	if (!conf.githubIncludePrBranchName) {
		return
	}
	const pullRequest = conf.githubIncludeNewCardCommand ? await getPullRequest() : pr

	if (matchCardIds(conf, pullRequest.body || '')?.length) {
		console.log('Card is already linked in the PR description')

		return
	}
	const comments = (await getPullRequestComments()) || []

	for (const comment of comments) {
		if (matchCardIds(conf, comment.body)?.length) {
			console.log('Card is already linked in the comment')

			return
		}
	}
	console.log('Commenting Trello card URLs to PR', cardIds)

	const cards = await Promise.all(cardIds.map((id) => getCardInfo(id)))

	await createComment(cards.map((card) => card.shortUrl).join('\n'))
}

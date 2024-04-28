import { setFailed } from '@actions/core'
import { Conf, PR } from './types'
import {
	addCardLinksToPullRequest,
	addLabelToCards,
	addPullRequestLinkToCards,
	getCardIds,
	moveOrArchiveCards,
	updateCardMembers,
} from './actions'

export async function run(pr: PR, conf: Conf) {
	try {
		const cardIds = await getCardIds(conf, pr)

		if (cardIds.length) {
			await addCardLinksToPullRequest(conf, cardIds, pr)
			await addPullRequestLinkToCards(cardIds, pr)
			await moveOrArchiveCards(conf, cardIds, pr)
			await addLabelToCards(conf, cardIds, pr.head)
			await updateCardMembers(conf, cardIds)
		}
	} catch (error: any) {
		setFailed(error)
		throw error
	}
}

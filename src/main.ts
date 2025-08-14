import { setFailed } from '@actions/core'

import {
	addCardLinksToPullRequest,
	addLabelToCards,
	addPullRequestLinkToCards,
	getCardIds,
	moveOrArchiveCards,
	updateCardMembers,
} from './actions'
import { Action, Conf, PR } from './types'

export async function run(pr: PR, action: Action, conf: Conf) {
	try {
		const cardIds = await getCardIds(conf, pr.head)

		if (cardIds.length) {
			await addCardLinksToPullRequest(conf, cardIds)
			await addPullRequestLinkToCards(cardIds, pr)
			await moveOrArchiveCards(conf, cardIds, pr, action)
			await addLabelToCards(conf, cardIds, pr.head)
			await updateCardMembers(conf, cardIds, pr)
		}
	} catch (error: any) {
		setFailed(error)
		throw error
	}
}

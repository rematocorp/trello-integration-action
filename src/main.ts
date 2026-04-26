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

export async function run({ head }: PR, action: Action, conf: Conf) {
	try {
		const cardIds = await getCardIds(conf, head)

		if (cardIds.length) {
			await addCardLinksToPullRequest(conf, cardIds)
			await addPullRequestLinkToCards(cardIds)
			await moveOrArchiveCards(conf, cardIds, action)
			await addLabelToCards(conf, cardIds, head)
			await updateCardMembers(conf, cardIds)
		}
	} catch (error: any) {
		setFailed(error)
		throw error
	}
}

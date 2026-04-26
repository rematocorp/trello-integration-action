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
import { getPullRequest } from './actions/api/github'

export async function run({ head }: PR, action: Action, conf: Conf) {
	try {
		const pr = await getPullRequest()
		const cardIds = await getCardIds(pr, conf, head)

		if (cardIds.length) {
			await addCardLinksToPullRequest(conf, cardIds)
			await addPullRequestLinkToCards(cardIds, pr)
			await moveOrArchiveCards(conf, cardIds, pr, action)
			await addLabelToCards(conf, cardIds, head)
			await updateCardMembers(conf, cardIds, pr)
		}
	} catch (error: any) {
		setFailed(error)
		throw error
	}
}

import { setFailed } from '@actions/core'
import { Conf, PR } from './types'
import getCardIds from './actions/getCardIds'
import addCardsLinkToPullRequest from './actions/addCardsLinkToPullRequest'
import addPullRequestLinkToCards from './actions/addPullRequestLinkToCards'
import moveOrArchiveCards from './actions/moveOrArchiveCards'
import addLabelToCards from './actions/addLabelToCards'
import updateCardMembers from './actions/updateCardMembers'

export async function run(pr: PR, conf: Conf = {}) {
	try {
		const cardIds = await getCardIds(conf, pr)

		if (cardIds.length) {
			await addCardsLinkToPullRequest(conf, cardIds, pr)
			await addPullRequestLinkToCards(cardIds, pr.html_url || pr.url)
			await moveOrArchiveCards(conf, cardIds, pr)
			await addLabelToCards(conf, cardIds, pr.head)
			await updateCardMembers(conf, cardIds)
		}
	} catch (error: any) {
		setFailed(error)
		throw error
	}
}

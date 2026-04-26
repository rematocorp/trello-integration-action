import { startGroup } from '@actions/core'

import { getPullRequest } from './api/github'
import { addAttachmentToCard, getCardAttachments } from './api/trello'
import logger from './utils/logger'

export default async function addPullRequestLinkToCards(cardIds: string[]) {
	startGroup('🔗 ADD PR LINK TO CARDS')

	const pr = await getPullRequest()
	const link = pr.html_url || pr.url

	return Promise.all(
		cardIds.map(async (cardId) => {
			const existingAttachments = await getCardAttachments(cardId)

			if (existingAttachments?.some((it) => it.url.includes(link))) {
				logger.log('Found existing attachment, skipping adding attachment', { cardId, link })

				return
			}

			return addAttachmentToCard(cardId, link)
		}),
	)
}

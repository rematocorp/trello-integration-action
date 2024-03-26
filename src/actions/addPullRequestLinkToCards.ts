import { PR } from '../types'
import { addAttachmentToCard, getCardAttachments } from './api/trello'

export default async function addPullRequestLinkToCards(cardIds: string[], pr: PR) {
	const link = pr.html_url || pr.url

	return Promise.all(
		cardIds.map(async (cardId) => {
			const existingAttachments = await getCardAttachments(cardId)

			if (existingAttachments?.some((it) => it.url.includes(link))) {
				console.log('Found existing attachment, skipping adding attachment', cardId, link)

				return
			}

			return addAttachmentToCard(cardId, link)
		}),
	)
}

import { Conf, PR } from '../types'
import { isPullRequestMerged, getPullRequestReviews } from './api/github'
import { archiveCard, getBoardLists, getCardInfo, moveCardToList } from './api/trello'
import isDraftPullRequest from './utils/isDraftPullRequest'

export default async function moveOrArchiveCards(conf: Conf, cardIds: string[], pr: PR) {
	const reviews = await getPullRequestReviews()

	console.log('Debugging reviews', reviews)

	const isChangesRequested = reviews?.some((review) => review.state === 'CHANGES_REQUESTED')
	const isApproved = reviews?.some((review) => review.state === 'APPROVED')
	const isDraft = isDraftPullRequest(pr)
	const isMerged = await isPullRequestMerged()

	if (pr.state === 'open' && isDraft && conf.trelloListIdPrDraft) {
		await moveCardsToList(cardIds, conf.trelloListIdPrDraft, conf.trelloBoardId)
		console.log('Moved cards to draft PR list')

		return
	}

	if (pr.state === 'open' && !isDraft && isChangesRequested && conf.trelloListIdPrChangesRequested) {
		await moveCardsToList(cardIds, conf.trelloListIdPrChangesRequested, conf.trelloBoardId)
		console.log('Moved cards to changes requested PR list')

		return
	}

	if (pr.state === 'open' && !isDraft && isApproved && conf.trelloListIdPrApproved) {
		await moveCardsToList(cardIds, conf.trelloListIdPrApproved, conf.trelloBoardId)
		console.log('Moved cards to approved PR list')

		return
	}

	if (pr.state === 'open' && !isDraft && conf.trelloListIdPrOpen) {
		await moveCardsToList(cardIds, conf.trelloListIdPrOpen, conf.trelloBoardId)
		console.log('Moved cards to opened PR list')

		return
	}

	if (pr.state === 'closed' && isMerged && conf.trelloArchiveOnMerge) {
		await archiveCards(cardIds)

		return
	}

	if (pr.state === 'closed' && conf.trelloListIdPrClosed) {
		await moveCardsToList(cardIds, conf.trelloListIdPrClosed, conf.trelloBoardId)
		console.log('Moved cards to closed PR list')

		return
	}

	console.log('Skipping moving and archiving the cards', { state: pr.state, isDraft, isMerged })
}

async function moveCardsToList(cardIds: string[], listId: string, boardId?: string) {
	const listIds = listId.split(';')

	return Promise.all(
		cardIds.map(async (cardId) => {
			if (listIds.length > 1) {
				const { idBoard } = await getCardInfo(cardId)
				const boardLists = await getBoardLists(idBoard)

				// Moves to the list on the board where the card is currently located
				await moveCardToList(
					cardId,
					listIds.find((listId) => boardLists.some((list) => list.id === listId)) || listIds[0],
				)
			} else {
				await moveCardToList(cardId, listId, boardId)
			}
		}),
	)
}

async function archiveCards(cardIds: string[]) {
	return Promise.all(cardIds.map((cardId) => archiveCard(cardId)))
}

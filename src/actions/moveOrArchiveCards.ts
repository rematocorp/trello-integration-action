import { Conf, PR } from '../types'
import { isPullRequestMerged } from './api/github'
import { archiveCard, getBoardLists, getCardInfo, moveCardToList } from './api/trello'
import isChangesRequestedInReview from './utils/isChangesRequestedInReview'
import isPullRequestInDraft from './utils/isPullRequestInDraft'
import isPullRequestApproved from './utils/isPullRequestApproved'
import logger from './utils/logger'

export default async function moveOrArchiveCards(conf: Conf, cardIds: string[], pr: PR) {
	logger.logStep('MOVE OR ARCHIVE CARDS')

	const isDraft = isPullRequestInDraft(pr)
	const isChangesRequested = await isChangesRequestedInReview()
	const isApproved = await isPullRequestApproved()
	const isMerged = await isPullRequestMerged()

	if (pr.state === 'open' && isDraft && conf.trelloListIdPrDraft) {
		await moveCardsToList(cardIds, conf.trelloListIdPrDraft, conf.trelloBoardId)
		logger.log('Moved cards to draft PR list')

		return
	}

	if (pr.state === 'open' && !isDraft && isChangesRequested && conf.trelloListIdPrChangesRequested) {
		await moveCardsToList(cardIds, conf.trelloListIdPrChangesRequested, conf.trelloBoardId)
		logger.log('Moved cards to changes requested PR list')

		return
	}

	if (pr.state === 'open' && !isDraft && !isChangesRequested && isApproved && conf.trelloListIdPrApproved) {
		await moveCardsToList(cardIds, conf.trelloListIdPrApproved, conf.trelloBoardId)
		logger.log('Moved cards to approved PR list')

		return
	}

	if (pr.state === 'open' && !isDraft && conf.trelloListIdPrOpen) {
		await moveCardsToList(cardIds, conf.trelloListIdPrOpen, conf.trelloBoardId)
		logger.log('Moved cards to opened PR list')

		return
	}

	if (pr.state === 'closed' && isMerged && conf.trelloArchiveOnMerge) {
		await archiveCards(cardIds)

		return
	}

	if (pr.state === 'closed' && conf.trelloListIdPrClosed) {
		await moveCardsToList(cardIds, conf.trelloListIdPrClosed, conf.trelloBoardId)
		logger.log('Moved cards to closed PR list')

		return
	}

	logger.log('Skipping moving and archiving the cards', { state: pr.state, isDraft, isMerged })
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

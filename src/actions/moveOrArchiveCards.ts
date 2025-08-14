import { startGroup } from '@actions/core'

import { Action, Conf, PR } from '../types'
import { getTargetBranchName, isPullRequestMerged } from './api/github'
import { archiveCard, getBoardLists, getCardInfo, moveCardToList } from './api/trello'
import isChangesRequestedInReview from './utils/isChangesRequestedInReview'
import isPullRequestApproved from './utils/isPullRequestApproved'
import isPullRequestInDraft from './utils/isPullRequestInDraft'
import logger from './utils/logger'

export default async function moveOrArchiveCards(conf: Conf, cardIds: string[], pr: PR, action: Action) {
	startGroup('🕺 MOVE OR ARCHIVE CARDS')

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

	if (pr.state === 'closed' && isMerged && conf.trelloListIdPrMerged && !conf.trelloArchiveOnMerge) {
		if (!conf.trelloMoveToMergedListOnlyOnMerge || action === 'closed') {
			await moveCardsToList(cardIds, conf.trelloListIdPrMerged, conf.trelloBoardId)
			logger.log('Moved cards to merged PR list')
		}

		return
	}

	if (pr.state === 'closed' && conf.trelloListIdPrClosed) {
		await moveCardsToList(cardIds, conf.trelloListIdPrClosed, conf.trelloBoardId)
		logger.log('Moved cards to closed PR list')

		return
	}

	logger.log('Skipping moving and archiving the cards', { state: pr.state, isDraft, isMerged })
}

async function archiveCards(cardIds: string[]) {
	return Promise.all(cardIds.map((cardId) => archiveCard(cardId)))
}

async function moveCardsToList(cardIds: string[], listId: string, boardId?: string) {
	const resolvedListId = await resolveListIdFromString(listId)
	const listIds = resolvedListId.split(';')

	return Promise.all(
		cardIds.map(async (cardId) => {
			try {
				if (listIds.length > 1) {
					const { idBoard } = await getCardInfo(cardId)
					const boardLists = await getBoardLists(idBoard)

					// Moves to the list on the board where the card is currently located
					await moveCardToList(
						cardId,
						listIds.find((listId) => boardLists.some((list) => list.id === listId)) || listIds[0],
					)
				} else {
					await moveCardToList(cardId, listIds[0], boardId)
				}
			} catch (error: any) {
				if (error.response?.data?.message === 'The card has moved to a different board.') {
					logger.log('Card has already been moved to board', cardId, boardId)
				} else {
					throw error
				}
			}
		}),
	)
}

async function resolveListIdFromString(raw: string): Promise<string> {
	const branchName = await getTargetBranchName()
	const lines = raw
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
	const looksLikeMap = lines.some((l) => l.includes(':'))

	if (!looksLikeMap) {
		return raw.trim()
	}

	const pairs = parseMapString(lines)

	for (const [pattern, value] of pairs) {
		if (pattern !== '*' && wildcardMatch(pattern, branchName)) {
			return value
		}
	}

	const star = pairs.find(([p]) => p === '*')

	if (star) {
		return star[1]
	}

	throw new Error(`No matching Trello list ID for branch "${branchName}" and no "*" fallback provided.`)
}

function parseMapString(lines: string[]): Array<[string, string]> {
	return lines
		.map((line) => line.split(':'))
		.filter(([key, val]) => key && val)
		.map(([key, val]) => [key.trim(), val.trim()])
}

function wildcardMatch(pattern: string, text: string): boolean {
	const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*')

	return new RegExp(`^${escaped}$`).test(text)
}

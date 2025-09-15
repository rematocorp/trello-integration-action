import { startGroup } from '@actions/core'

import type { BoardLabel, Conf, PRHead } from '../types'
import { getBranchName } from './api/github'
import { addLabelsToCard, getBoardLabels, getCardInfo } from './api/trello'
import logger from './utils/logger'

export default async function addLabelToCards(conf: Conf, cardIds: string[], head?: PRHead) {
	const wantBranchLabel = !!conf.trelloAddLabelsToCards
	const wantManualLabels = !!conf.trelloAddManualLabelsToCards

	if (!wantBranchLabel && !wantManualLabels) {
		return
	}
	startGroup('🏷️ ADD LABELS TO CARDS')

	const branchLabel = await getBranchLabel(head)
	const manualLabels = conf.trelloAddManualLabelsToCards

	if (wantBranchLabel && !branchLabel) {
		logger.log('Could not find branch label')

		if (!wantManualLabels) {
			return
		}
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)
			const hasConflictingLabel = cardInfo.labels.find(
				(label) => conf.trelloConflictingLabels?.includes(label.name) || label.name === branchLabel,
			)

			if (hasConflictingLabel) {
				logger.log('Skipping labels adding to a card as it has a conflicting label', cardInfo.labels)

				return
			}
			const boardLabels = await getBoardLabels(cardInfo.idBoard)
			const matchingLabels = findMatchingLabels(branchLabel, manualLabels, boardLabels)

			if (matchingLabels) {
				try {
					await addLabelsToCard(
						cardId,
						matchingLabels.map((label) => label.id),
					)
				} catch (error: any) {
					const errors = Array.isArray(error) ? error : [error]
					const allAlreadyOnCard = errors.every(
						({ response }) => response?.data === 'that label is already on the card',
					)
					if (allAlreadyOnCard) {
						logger.log('Label already exists on the card', cardId, matchingLabels)
					} else {
						throw error
					}
				}
			} else {
				logger.log('Could not find a matching label from the board', {
					branchLabel,
					manualLabels,
					boardLabels,
				})
			}
		}),
	)
}

async function getBranchLabel(prHead?: PRHead) {
	const branchName = prHead?.ref || (await getBranchName())
	const matches = branchName.match(/^([^/]*)\//)

	if (matches) {
		return matches[1]
	} else {
		logger.log('Did not find branch label', branchName)
	}
}

function findMatchingLabels(
	branchLabel: string | undefined,
	manualLabels: string[] | undefined,
	boardLabels: BoardLabel[],
) {
	const matches: BoardLabel[] = []

	const branchMatch = boardLabels.find((label) => label.name === branchLabel)
	if (branchMatch) {
		matches.push(branchMatch)
	}

	const manualMatches = boardLabels.filter((label) => manualLabels?.includes(label.name))
	if (manualMatches.length) {
		matches.push(...manualMatches)
	}

	const uniqueMatches = Array.from(new Map(matches.map((label) => [label.id, label])).values())

	if (uniqueMatches.length) {
		return uniqueMatches
	}

	logger.log('Could not match an exact label name, trying to find a partially matching label')

	const partialMatch = boardLabels.find((label) => branchLabel?.startsWith(label.name))

	return partialMatch ? [partialMatch] : undefined
}

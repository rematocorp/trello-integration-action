import { BoardLabel, Conf, PRHead } from '../types'
import { getBranchName } from './api/github'
import { addLabelToCard, getBoardLabels, getCardInfo } from './api/trello'
import logger from './utils/logger'

export default async function addLabelToCards(conf: Conf, cardIds: string[], head?: PRHead) {
	logger.log('--- ADD LABEL TO CARDS ---')

	if (!conf.trelloAddLabelsToCards) {
		logger.log('Skipping label adding')

		return
	}
	const branchLabel = await getBranchLabel(head)

	if (!branchLabel) {
		logger.log('Could not find branch label')

		return
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)
			const hasConflictingLabel = cardInfo.labels.find(
				(label) => conf.trelloConflictingLabels?.includes(label.name) || label.name === branchLabel,
			)

			if (hasConflictingLabel) {
				logger.log('Skipping label adding to a card as it has a conflicting label', cardInfo.labels)

				return
			}
			const boardLabels = await getBoardLabels(cardInfo.idBoard)
			const matchingLabel = findMatchingLabel(branchLabel, boardLabels)

			if (matchingLabel) {
				try {
					await addLabelToCard(cardId, matchingLabel.id)
				} catch (error: any) {
					if (error.response?.data === 'that label is already on the card') {
						logger.log('Label already exists on the card', cardId, matchingLabel)
					} else {
						throw error
					}
				}
			} else {
				logger.log('Could not find a matching label from the board', { branchLabel, boardLabels })
			}
		}),
	)
}

async function getBranchLabel(prHead?: PRHead) {
	const branchName = prHead?.ref || (await getBranchName())
	const matches = branchName.match(/^([^\/]*)\//)

	if (matches) {
		return matches[1]
	} else {
		logger.log('Did not find branch label', branchName)
	}
}

function findMatchingLabel(branchLabel: string, boardLabels: BoardLabel[]) {
	const match = boardLabels.find((label) => label.name === branchLabel)

	if (match) {
		return match
	}
	logger.log('Could not match the exact label name, trying to find partially matching label')

	return boardLabels.find((label) => branchLabel.startsWith(label.name))
}

import { BoardLabel, Conf, PRHead } from '../types'
import { getBranchName } from './api/github'
import { addLabelToCard, getBoardLabels, getCardInfo } from './api/trello'

export default async function addLabelToCards(conf: Conf, cardIds: string[], head?: PRHead) {
	if (!conf.trelloAddLabelsToCards) {
		console.log('Skipping label adding')

		return
	}
	console.log('Starting to add labels to cards')

	const branchLabel = await getBranchLabel(head)

	if (!branchLabel) {
		console.log('Could not find branch label')

		return
	}

	return Promise.all(
		cardIds.map(async (cardId) => {
			const cardInfo = await getCardInfo(cardId)
			const hasConflictingLabel = cardInfo.labels.find(
				(label) => conf.trelloConflictingLabels?.includes(label.name) || label.name === branchLabel,
			)

			if (hasConflictingLabel) {
				console.log('Skipping label adding to a card because it has a conflicting label', cardInfo.labels)

				return
			}
			const boardLabels = await getBoardLabels(cardInfo.idBoard)
			const matchingLabel = findMatchingLabel(branchLabel, boardLabels)

			if (matchingLabel) {
				await addLabelToCard(cardId, matchingLabel.id)
			} else {
				console.log('Could not find a matching label from the board', branchLabel, boardLabels)
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
		console.log('Did not find branch label', branchName)
	}
}

function findMatchingLabel(branchLabel: string, boardLabels: BoardLabel[]) {
	const match = boardLabels.find((label) => label.name === branchLabel)

	if (match) {
		return match
	}
	console.log('Could not match the exact label name, trying to find partially matching label')

	return boardLabels.find((label) => branchLabel.startsWith(label.name))
}

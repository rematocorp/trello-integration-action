import { CardId, Conf, PRHead } from '../types'
import { getBranchName, getLabels } from './api/github'
import { addLabelToCard, getBoardLabels, getCardInfo } from './api/trello'
import logger from './utils/logger'

export default async function addLabelsToCards(conf: Conf, cardIds: string[], head?: PRHead) {
	if (!conf.trelloAddLabelsToCards) {
		return
	}
	logger.log('🏷️ ADD LABELS TO CARDS')

	const labels = await getPullRequestLabels(conf, head)

	return Promise.all(cardIds.map((cardId) => addLabelsToCard(conf, labels, cardId)))
}

async function getPullRequestLabels(conf: Conf, head?: PRHead): Promise<string[]> {
	let labels: string[] = []

	const branchLabel = await getBranchLabel(conf, head)

	if (branchLabel) {
		labels = [...labels, branchLabel]
	}
	const issueLabels = await getIssueLabels(conf)

	if (issueLabels.length) {
		labels = [...labels, ...issueLabels]
	}

	return labels
}

async function getBranchLabel(conf: Conf, prHead?: PRHead) {
	if (!conf.trelloAddBranchCategoryLabel) {
		return
	}
	const branchName = prHead?.ref || (await getBranchName())
	const matches = branchName.match(/^([^\/]*)\//)

	if (matches) {
		logger.log('Found branch label', matches[1])

		return matches[1]
	} else {
		logger.log('Did not find branch label', branchName)
	}
}

async function getIssueLabels(conf: Conf) {
	if (!conf.trelloAddPrLabels) {
		return []
	}
	const issueLabels = await getLabels()

	if (issueLabels.length) {
		const issueLabelNames = issueLabels.map((label) => label.name)

		logger.log('Found labels assigned to the PR', issueLabels)

		return issueLabelNames
	} else {
		logger.log('Did not find labels assigned to the PR')

		return []
	}
}

async function addLabelsToCard(conf: Conf, prLabels: string[], cardId: CardId) {
	const filteredLabels = await filterLabels(conf, prLabels, cardId)

	return Promise.all(filteredLabels.map((labelId) => addLabelToCard(cardId, labelId)))
}

async function filterLabels(conf: Conf, prLabels: string[], cardId: CardId) {
	const card = await getCardInfo(cardId)

	const boardLabels = await getBoardLabels(card.idBoard)
	const boardLabelNames = boardLabels.map((label) => label.name)
	const cardLabels = card.labels.map((label) => label.name)
	const conflictingLabels = conf.trelloConflictingLabels?.map((labels) =>
		labels.split(';').map((label) => findMatchingLabel(conf, label)),
	)
	const newLabelIds = prLabels
		.filter((prLabel) => {
			if (!boardLabelNames.includes(prLabel)) {
				return false
			}
			if (cardLabels.includes(prLabel)) {
				return false
			}
			const hasConflict = conflictingLabels?.some(
				(cLabels) => cLabels.includes(prLabel) && cLabels.some((cLabel) => cardLabels.includes(cLabel)),
			)
			if (hasConflict) {
				return false
			}

			return true
		})
		.map((prLabel) => boardLabels.find((l) => l.name === prLabel)!.id)

	return [...new Set(newLabelIds)]
}

function findMatchingLabel(conf: Conf, cardLabel: string) {
	for (const line of conf.githubLabelsToTrelloLabels || []) {
		const parts = line.trim().split(':')

		if (parts.length < 2) {
			logger.error('Mapping of Github labels to Trello does not contain 2 label names separated by ":"', line)
			continue
		}
		if (parts[1].trim() === cardLabel && parts[0].trim() !== '') {
			return parts[1].trim()
		}
	}

	return cardLabel
}

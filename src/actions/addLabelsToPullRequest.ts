import { CardId, Conf } from '../types'
import { addLabels, getLabels, getRepoLabels } from './api/github'
import { getCardInfo } from './api/trello'
import logger from './utils/logger'

export default async function addLabelsToCards(conf: Conf, cardIds: CardId[]) {
	if (!conf.githubAddLabelsToPr) {
		return
	}
	logger.log('🏷️ ADD LABELS TO PULL REQUEST')

	const labels = await getCardLabels(conf, cardIds[0])

	return addLabelsToPullRequest(conf, labels)
}

async function getCardLabels(conf: Conf, cardId: CardId) {
	const card = await getCardInfo(cardId)

	return card.labels.map((label) => label.name)
}

async function addLabelsToPullRequest(conf: Conf, cardLabels: string[]) {
	const filteredLabels = await filterLabels(conf, cardLabels)

	return addLabels(filteredLabels)
}

async function filterLabels(conf: Conf, cardLabels: string[]) {
	const repoLabels = await getRepositoryLabels(conf)
	const prLabels = await getPrLabels(conf)
	const conflictingLabels = conf.githubConflictingLabels?.map((labels) =>
		labels.split(';').map((label) => findMatchingLabel(conf, label)),
	)

	return cardLabels.filter((cardLabel) => {
		if (!repoLabels.includes(cardLabel)) {
			return false
		}
		if (prLabels.includes(cardLabel)) {
			return false
		}
		const hasConflict = conflictingLabels?.some(
			(cLabels) => cLabels.includes(cardLabel) && cLabels.some((cLabel) => prLabels.includes(cLabel)),
		)
		if (hasConflict) {
			return false
		}

		return true
	})
}

async function getRepositoryLabels(conf: Conf) {
	const repoLabels = await getRepoLabels()

	return repoLabels.map((label) => findMatchingLabel(conf, label.name))
}

async function getPrLabels(conf: Conf) {
	const prLabels = await getLabels()

	return prLabels.map((label) => findMatchingLabel(conf, label.name))
}

function findMatchingLabel(conf: Conf, prLabel: string) {
	for (const line of conf.githubLabelsToTrelloLabels || []) {
		const parts = line.trim().split(':')

		if (parts.length < 2) {
			logger.error('Mapping of Github labels to Trello does not contain 2 label names separated by ":"', line)
			continue
		}
		if (parts[0].trim() === prLabel && parts[1].trim() !== '') {
			return parts[1].trim()
		}
	}

	return prLabel
}

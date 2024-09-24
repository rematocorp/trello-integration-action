import { setFailed } from '@actions/core'
import { Conf, PR, PRHead } from '../types'
import { getBranchName, getCommits, getPullRequest, getPullRequestComments, updatePullRequestBody } from './api/github'
import { createCard, getCardActions, getCardInfo, searchTrelloCards } from './api/trello'
import matchCardIds from './utils/matchCardIds'
import isPullRequestInDraft from './utils/isPullRequestInDraft'
import logger from './utils/logger'

export default async function getCardIds(conf: Conf, head?: PRHead) {
	logger.logStep('FIND CARDS')

	const pr = await getPullRequest()
	let cardIds = matchCardIds(conf, pr.body || '')

	if (conf.githubIncludeNewCardCommand) {
		const createdCardId = await createNewCard(conf, pr)

		if (createdCardId) {
			cardIds = [...cardIds, createdCardId]
		}
	}

	if (conf.githubIncludePrComments) {
		const comments = await getPullRequestComments()

		for (const comment of comments) {
			cardIds = [...cardIds, ...matchCardIds(conf, comment.body)]
		}
	}

	if (conf.githubIncludePrCommitMessages) {
		const commits = await getCommits()

		for (const commit of commits || []) {
			cardIds = [...cardIds, ...matchCardIds(conf, commit.commit.message)]
		}
	}

	if (conf.githubIncludePrBranchName) {
		const cardIdsFromBranch = await getCardIdsFromBranchName(conf, cardIds, head)

		cardIds = [...cardIds, ...cardIdsFromBranch]
	}

	if (cardIds.length) {
		logger.log('Found card IDs', cardIds)

		return [...new Set(cardIds)]
	} else {
		logger.log('Could not find card IDs')

		if (conf.githubRequireTrelloCard) {
			setFailed('The PR does not contain a link to a Trello card')
		}

		return []
	}
}

/**
 * Creates a new card when user has written "/new-trello-card" to the PR description
 */
async function createNewCard(conf: Conf, pr: PR) {
	const isDraft = isPullRequestInDraft(pr)
	const listId = pr.state === 'open' && isDraft ? conf.trelloListIdPrDraft : conf.trelloListIdPrOpen
	const commandRegex = /(^|\s)\/new-trello-card(\s|$)/ // Avoids matching URLs

	if (listId && pr.body && commandRegex.test(pr.body)) {
		await updatePullRequestBody(pr.body.replace('/new-trello-card', '/creating-new-trello-card..'))

		const card = await createCard(listId, pr.title, pr.body.replace('/new-trello-card', ''))
		const body = conf.githubRequireKeywordPrefix ? `Closes ${card.url}` : card.url

		await updatePullRequestBody(pr.body.replace('/new-trello-card', body))

		return card.shortLink
	}

	return
}

async function getCardIdsFromBranchName(conf: Conf, knownCardIds: string[], prHead?: PRHead) {
	const branchName = prHead?.ref || (await getBranchName())

	logger.log('Searching cards from branch name', branchName)

	// Try detecting multiple short IDs first
	if (conf.githubAllowMultipleCardsInPrBranchName) {
		const cardIds = await getMultipleCardIdsFromBranchName(conf, branchName)

		if (cardIds?.length) {
			return cardIds
		}
	}

	// Try finding only one card with short ID and title (e.g. 123-feature-title)
	const matches = branchName.match(/(?<=^|\/)(\d+)-(\S+)/i)

	if (matches) {
		const shortId = matches[1]
		const title = matches[2]

		logger.log('Matched one potential card from branch name', matches)

		// Try finding the card with short ID and title together
		const cardsWithExactMatch = await searchTrelloCards(matches[0])

		if (cardsWithExactMatch?.length) {
			return [cardsWithExactMatch[0].shortLink]
		}

		// Make sure the card is not already linked before wider, more inaccurate search
		const alreadyLinked = await isCardAlreadyLinked(knownCardIds, shortId)

		if (alreadyLinked) {
			logger.log('Card that is mentioned in the branch name is already linked', shortId)

			return []
		}

		// Try finding only with the title in case short ID has changed with a move
		const cardIdByTitle = await getTrelloCardByTitle(title, shortId)

		if (cardIdByTitle) {
			logger.log('Found a card with the title', { title, shortId })

			return [cardIdByTitle]
		}

		// Our last hope is to find the card with just a short ID
		const cardIdByShortId = await getTrelloCardByShortId(shortId)

		if (cardIdByShortId) {
			logger.log('Found a card with only the short ID', shortId)

			return [cardIdByShortId]
		}

		logger.log('Could not find correct Trello card with branch name')
	}

	return []
}

async function getMultipleCardIdsFromBranchName(conf: Conf, branchName: string) {
	const shortIdMatches = branchName.match(/(?<=^|\/)\d+(?:-\d+)+/gi)?.[0].split('-')

	if (shortIdMatches && shortIdMatches.length > 1) {
		logger.log('Matched multiple potential Trello short IDs from branch name', shortIdMatches)

		const potentialCardIds = await Promise.all(
			shortIdMatches.map((shortId: string) => getTrelloCardByShortId(shortId, conf.trelloBoardId)),
		)
		const cardIds = potentialCardIds.filter((c) => c) as string[]

		if (cardIds.length) {
			return cardIds
		}
	}
}

async function isCardAlreadyLinked(cardIds: string[], shortId: string) {
	return cardIds.some(async (cardId) => {
		const cardActions = await getCardActions(cardId)

		return cardActions.some((action) => action.data.card.idShort === parseInt(shortId))
	})
}

/**
 * Searches for a card with short ID ((from the branch name)) and then filters out cards
 * that are closed, sorts by last active and matches only the card that has the correct short ID.
 */
async function getTrelloCardByShortId(shortId: string, boardId?: string) {
	const cardsWithNumberMatch = await searchTrelloCards(shortId, boardId)

	return cardsWithNumberMatch
		?.filter((card) => !card.closed)
		.sort((a, b) => new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime())
		.find((card) => card.idShort === parseInt(shortId))?.shortLink
}

/**
 * Searches for a card with the branch title (e.g., add-new-feature-foo) and then filters out cards
 * that are closed, sorts by last active and matches only the card that has the correct short id (from the branch name).
 */
async function getTrelloCardByTitle(title: string, shortId: string) {
	const results = await searchTrelloCards(title)
	const cards = await Promise.all(
		results
			?.filter((card) => !card.closed)
			.sort((a, b) => new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime())
			.map(async (card) => {
				const cardInfo = await getCardInfo(card.id)
				const cardActions = await getCardActions(card.id)

				return { ...cardInfo, actions: cardActions }
			}),
	)

	return cards.find(
		(card) =>
			card.idShort === parseInt(shortId) ||
			card.actions.some((action) => action.data.card.idShort === parseInt(shortId)),
	)?.shortLink
}

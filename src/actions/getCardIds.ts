import { setFailed } from '@actions/core'
import { Conf, PR, PRHead } from '../types'
import { getBranchName, getCommits, getPullRequest, getPullRequestComments, updatePullRequestBody } from './api/github'
import { createCard, searchTrelloCards } from './api/trello'
import matchCardIds from './utils/matchCardIds'
import isDraftPullRequest from './utils/isDraftPullRequest'

export default async function getCardIds(conf: Conf, pr: PR) {
	console.log('Searching for card IDs')

	const latestPRInfo = (await getPullRequest()) || pr
	let cardIds = matchCardIds(conf, latestPRInfo.body || '')

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
		const cardIdsFromBranch = await getCardIdsFromBranchName(conf, pr.head)

		cardIds = [...cardIds, ...cardIdsFromBranch]
	}

	if (conf.githubIncludeNewCardCommand) {
		const createdCardId = await createNewCard(conf, latestPRInfo)

		if (createdCardId) {
			cardIds = [...cardIds, createdCardId]
		}
	}

	if (cardIds.length) {
		console.log('Found card IDs', cardIds)

		return [...new Set(cardIds)]
	} else {
		console.log('Could not find card IDs')

		if (conf.githubRequireTrelloCard) {
			setFailed('The PR does not contain a link to a Trello card')
		}

		return []
	}
}

async function createNewCard(conf: Conf, pr: PR) {
	const isDraft = isDraftPullRequest(pr)
	const listId = pr.state === 'open' && isDraft ? conf.trelloListIdPrDraft : conf.trelloListIdPrOpen
	const commandRegex = /(^|\s)\/new-trello-card(\s|$)/ // Avoids matching URLs

	if (listId && pr.body && commandRegex.test(pr.body)) {
		const card = await createCard(listId, pr.title, pr.body.replace('/new-trello-card', ''))
		const body = conf.githubRequireKeywordPrefix ? `Closes ${card.url}` : card.url

		await updatePullRequestBody(pr.body.replace('/new-trello-card', body))

		return card.id
	}

	return
}

async function getCardIdsFromBranchName(conf: Conf, prHead?: PRHead) {
	const branchName = prHead?.ref || (await getBranchName())

	console.log('Searching cards from branch name', branchName)

	if (conf.githubAllowMultipleCardsInPrBranchName) {
		const shortIdMatches = branchName.match(/(?<=^|\/)\d+(?:-\d+)+/gi)?.[0].split('-')

		if (shortIdMatches && shortIdMatches.length > 1) {
			console.log('Matched multiple potential Trello short IDs from branch name', shortIdMatches)

			const potentialCardIds = await Promise.all(
				shortIdMatches.map((shortId: string) => getTrelloCardByShortId(shortId, conf.trelloBoardId)),
			)
			const cardIds = potentialCardIds.filter((c) => c) as string[]

			if (cardIds.length) {
				return cardIds
			}
		}
	}
	const matches = branchName.match(/(?<=^|\/)(\d+)-\S+/i)

	if (matches) {
		console.log('Matched one potential card from branch name', matches)

		const cardsWithExactMatch = await searchTrelloCards(matches[0])

		if (cardsWithExactMatch?.length) {
			return [cardsWithExactMatch[0].id]
		}

		console.log('Could not find Trello card with branch name, trying only with short ID', matches[1])

		const cardId = await getTrelloCardByShortId(matches[1])

		if (cardId) {
			return [cardId]
		}
	}

	return []
}

async function getTrelloCardByShortId(shortId: string, boardId?: string) {
	const cardsWithNumberMatch = await searchTrelloCards(shortId, boardId)

	return cardsWithNumberMatch
		?.sort((a, b) => new Date(b.dateLastActivity).getTime() - new Date(a.dateLastActivity).getTime())
		.find((card) => card.idShort === parseInt(shortId))?.id
}

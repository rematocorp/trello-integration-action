import { setFailed } from '@actions/core'
import { getBranchName, getPullRequest, getPullRequestComments, updatePullRequestBody } from './api/github'
import { createCard, getCardInfo, moveCardToList, searchTrelloCards } from './api/trello'
import getCardIds from './getCardIds'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')

const getPullRequestMock = getPullRequest as jest.Mock
const getCardInfoMock = getCardInfo as jest.Mock
const getPullRequestCommentsMock = getPullRequestComments as jest.Mock
const getBranchNameMock = getBranchName as jest.Mock
const searchTrelloCardsMock = searchTrelloCards as jest.Mock
const createCardMock = createCard as jest.Mock

const pr = { number: 0, state: 'open', title: 'Title' }

it('fails the job when no cards found and githubRequireTrelloCard is enabled', async () => {
	await getCardIds({ githubRequireTrelloCard: true }, pr)

	expect(setFailed).toHaveBeenCalledWith('The PR does not contain a link to a Trello card')
	expect(moveCardToList).not.toHaveBeenCalled()
})

describe('Finding cards', () => {
	const conf = { trelloListIdPrOpen: 'open-list-id' }

	it('finds card from description', async () => {
		const cardIds = await getCardIds(conf, { ...pr, body: 'https://trello.com/c/card/title' })
		expect(cardIds).toEqual(['card'])
	})

	it('finds card from updated description', async () => {
		getPullRequestMock.mockResolvedValueOnce({ body: 'https://trello.com/c/card/title' })

		const cardIds = await getCardIds(conf, { ...pr, body: 'no card' })

		expect(cardIds).toEqual(['card'])
	})

	it('finds card from comments', async () => {
		getPullRequestCommentsMock.mockResolvedValueOnce([{ body: 'https://trello.com/c/card/title' }])

		const cardIds = await getCardIds({ ...conf, githubIncludePrComments: true }, pr)

		expect(cardIds).toEqual(['card'])
	})

	it('finds multiple cards', async () => {
		const cardIds = await getCardIds(conf, {
			...pr,
			body: 'https://trello.com/c/card1/title, https://trello.com/c/card2/title',
		})

		expect(cardIds).toEqual(['card1', 'card2'])
	})

	it('finds card with keyword prefix', async () => {
		const cardIds = await getCardIds(
			{ githubRequireKeywordPrefix: true },
			{
				...pr,
				body: 'Fixes https://trello.com/c/card/title',
			},
		)
		expect(cardIds).toEqual(['card'])
	})

	describe('from branch name', () => {
		it('finds basic card', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-card')
			getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })
			searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(searchTrelloCards).toHaveBeenCalledWith('1-card')
			expect(cardIds).toEqual(['card'])
		})

		it('finds categorized card', async () => {
			getBranchNameMock.mockResolvedValueOnce('feature/1-card')
			getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })
			searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(searchTrelloCards).toHaveBeenCalledWith('1-card')
			expect(cardIds).toEqual(['card'])
		})

		it('finds card with short ID', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-nan')
			searchTrelloCardsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'card', idShort: 1 }])
			getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(searchTrelloCards).toHaveBeenLastCalledWith('1', undefined)
			expect(cardIds).toEqual(['card'])
		})

		it('finds multiple cards', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-2-card')
			getCardInfoMock.mockResolvedValue({ shortUrl: 'short-url' })
			searchTrelloCardsMock
				.mockResolvedValueOnce([{ id: '1-card', idShort: 1 }])
				.mockResolvedValueOnce([{ id: '2-card', idShort: 2 }])

			const cardIds = await getCardIds(
				{
					...conf,
					githubIncludePrBranchName: true,
					githubAllowMultipleCardsInPrBranchName: true,
					trelloBoardId: 'board-id',
				},
				pr,
			)

			expect(searchTrelloCards).toHaveBeenNthCalledWith(1, '1', 'board-id')
			expect(searchTrelloCards).toHaveBeenNthCalledWith(2, '2', 'board-id')
			expect(cardIds).toEqual(['1-card', '2-card'])
		})

		it('ignores branch names that look similar to Trello card name', async () => {
			getBranchNameMock.mockResolvedValueOnce('not-1-card')

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(searchTrelloCards).not.toHaveBeenCalled()
			expect(cardIds).toEqual([])
		})
	})
})

describe('Creating new card', () => {
	const conf = { trelloListIdPrOpen: 'open-list-id', githubIncludeNewCardCommand: true }

	it('adds new card, updates PR body and adds to card ids list', async () => {
		createCardMock.mockResolvedValueOnce({ id: 'card-id', url: 'card-url' })

		const cardIds = await getCardIds(conf, { ...pr, body: '/new-trello-card Description' })

		expect(createCard).toHaveBeenCalledWith('open-list-id', 'Title', ' Description')
		expect(updatePullRequestBody).toHaveBeenCalledWith('card-url Description')
		expect(cardIds).toEqual(['card-id'])
	})

	it('skips when no command found', async () => {
		const cardIds = await getCardIds(conf, { ...pr, body: '' })
		expect(createCard).not.toHaveBeenCalled()
		expect(cardIds).toEqual([])
	})

	it('skips when list is missing', async () => {
		const cardIds = await getCardIds(
			{ ...conf, trelloListIdPrOpen: '' },
			{ ...pr, body: '/new-trello-card Description' },
		)
		expect(createCard).not.toHaveBeenCalled()
		expect(cardIds).toEqual([])
	})

	it('skips when turned off', async () => {
		const cardIds = await getCardIds(
			{ ...conf, githubIncludeNewCardCommand: false },
			{ ...pr, body: '/new-trello-card Description' },
		)
		expect(createCard).not.toHaveBeenCalled()
		expect(cardIds).toEqual([])
	})
})

import { setFailed } from '@actions/core'
import { getBranchName, getPullRequest, getPullRequestComments, updatePullRequestBody } from './api/github'
import { createCard, getCardInfo, moveCardToList, searchTrelloCards } from './api/trello'
import getCardIds from './getCardIds'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./actions/api/github')
jest.mock('./actions/api/trello')

const getPullRequestMock = getPullRequest as jest.Mock
const getCardInfoMock = getCardInfo as jest.Mock
const getPullRequestCommentsMock = getPullRequestComments as jest.Mock
const getBranchNameMock = getBranchName as jest.Mock
const searchTrelloCardsMock = searchTrelloCards as jest.Mock
const createCardMock = createCard as jest.Mock

const basePR = { number: 0, state: 'open', title: 'Title' }

describe('githubRequireTrelloCard is enabled', () => {
	it('fails the job', async () => {
		await getCardIds(pr, { ...conf, githubRequireTrelloCard: true })

		expect(setFailed).toHaveBeenCalledWith('The PR does not contain a link to a Trello card')
		expect(moveCardToList).not.toHaveBeenCalled()
	})
})

describe('Finding cards', () => {
	const pr = basePR
	const conf = { trelloListIdPrOpen: 'open-list-id' }

	it('finds card from description', async () => {
		await getCardIds({ ...pr, body: 'https://trello.com/c/card/title' }, conf)
		expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
	})

	it('finds card from updated description', async () => {
		getPullRequestMock.mockResolvedValueOnce({ body: 'https://trello.com/c/card/title' })

		await getCardIds({ ...pr, body: 'no card' }, conf)

		expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
	})

	it('finds card from comments', async () => {
		getPullRequestCommentsMock.mockResolvedValueOnce([{ body: 'https://trello.com/c/card/title' }])

		await getCardIds(pr, { ...conf, githubIncludePrComments: true })

		expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
	})

	it('finds multiple cards', async () => {
		await getCardIds({ ...pr, body: 'https://trello.com/c/card1/title, https://trello.com/c/card2/title' }, conf)
		expect(moveCardToList).toHaveBeenCalledWith('card1', 'open-list-id', undefined)
		expect(moveCardToList).toHaveBeenCalledWith('card2', 'open-list-id', undefined)
	})

	describe('from branch name', () => {
		it('finds basic card', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-card')
			getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })
			searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])

			await getCardIds(pr, { ...conf, githubIncludePrBranchName: true })

			expect(searchTrelloCards).toHaveBeenCalledWith('1-card')
			expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
		})

		it('finds categorized card', async () => {
			getBranchNameMock.mockResolvedValueOnce('feature/1-card')
			getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })
			searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])

			await getCardIds(pr, { ...conf, githubIncludePrBranchName: true })

			expect(searchTrelloCards).toHaveBeenCalledWith('1-card')
			expect(moveCardToList).toHaveBeenCalledWith('card', 'open-list-id', undefined)
		})

		it('finds multiple cards', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-2-card')
			getCardInfoMock.mockResolvedValue({ shortUrl: 'short-url' })
			searchTrelloCardsMock
				.mockResolvedValueOnce([{ id: '1-card', idShort: 1 }])
				.mockResolvedValueOnce([{ id: '2-card', idShort: 2 }])

			await getCardIds(pr, {
				...conf,
				githubIncludePrBranchName: true,
				githubAllowMultipleCardsInPrBranchName: true,
				trelloBoardId: 'board-id',
			})

			expect(searchTrelloCards).toHaveBeenNthCalledWith(1, '1', 'board-id')
			expect(searchTrelloCards).toHaveBeenNthCalledWith(2, '2', 'board-id')
			expect(moveCardToList).toHaveBeenNthCalledWith(1, '1-card', 'open-list-id', 'board-id')
			expect(moveCardToList).toHaveBeenNthCalledWith(2, '2-card', 'open-list-id', 'board-id')
		})

		it('ignores branch names that look similar to Trello card name', async () => {
			getBranchNameMock.mockResolvedValueOnce('not-1-card')

			await getCardIds(pr, { ...conf, githubIncludePrBranchName: true })

			expect(searchTrelloCards).not.toHaveBeenCalled()
			expect(moveCardToList).not.toHaveBeenCalled()
		})
	})
})

describe('Creating new card', () => {
	const pr = { ...basePR, body: '/new-trello-card Description' }
	const conf = { trelloListIdPrOpen: 'open-list-id', githubIncludeNewCardCommand: true }

	it('adds new card, updates PR body and adds to card ids list', async () => {
		createCardMock.mockResolvedValueOnce({ id: 'card-id', url: 'card-url' })

		await getCardIds(pr, conf)

		expect(createCard).toHaveBeenCalledWith('open-list-id', 'Title', ' Description')
		expect(updatePullRequestBody).toHaveBeenCalledWith('card-url Description')
		expect(moveCardToList).toHaveBeenCalledWith('card-id', 'open-list-id', undefined)
	})

	it('skips when no command found', async () => {
		await getCardIds({ ...pr, body: '' }, conf)
		expect(createCard).not.toHaveBeenCalled()
	})

	it('skips when list is missing', async () => {
		await getCardIds(pr, { ...conf, trelloListIdPrOpen: '' })
		expect(createCard).not.toHaveBeenCalled()
	})

	it('skips when turned off', async () => {
		await getCardIds(pr, { ...conf, githubIncludeNewCardCommand: false })
		expect(createCard).not.toHaveBeenCalled()
	})
})

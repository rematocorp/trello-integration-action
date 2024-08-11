import { setFailed } from '@actions/core'
import { getBranchName, getPullRequest, getPullRequestComments, updatePullRequestBody, getCommits } from './api/github'
import { createCard, moveCardToList, searchTrelloCards, getCardInfo, getCardActions } from './api/trello'
import getCardIds from './getCardIds'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')

const getCommitsMock = getCommits as jest.Mock
const getPullRequestMock = getPullRequest as jest.Mock
const getPullRequestCommentsMock = getPullRequestComments as jest.Mock
const getBranchNameMock = getBranchName as jest.Mock
const searchTrelloCardsMock = searchTrelloCards as jest.Mock
const createCardMock = createCard as jest.Mock
const getCardInfoMock = getCardInfo as jest.Mock
const getCardActionsMock = getCardActions as jest.Mock

const pr = { number: 0, state: 'open', title: 'Title' }

beforeEach(() => {
	getCardActionsMock.mockResolvedValue([])
})

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

	describe('related cards', () => {
		it('does not match related cards', async () => {
			const cardIds = await getCardIds(
				{ githubEnableRelatedKeywordPrefix: true },
				{
					...pr,
					body: 'Related https://trello.com/c/card/title',
				},
			)
			expect(cardIds).toEqual([])
		})

		it('does not match multiple related cards', async () => {
			const cardIds = await getCardIds(
				{ githubEnableRelatedKeywordPrefix: true },
				{
					...pr,
					body: 'Relates to https://trello.com/c/card1/title https://trello.com/c/card2/title',
				},
			)
			expect(cardIds).toEqual([])
		})

		it('matches related cards when feature is turned off', async () => {
			const cardIds = await getCardIds(
				{ githubEnableRelatedKeywordPrefix: false },
				{
					...pr,
					body: 'Related https://trello.com/c/card/title',
				},
			)
			expect(cardIds).toEqual(['card'])
		})
	})

	describe('from commit messages', () => {
		it('finds cards', async () => {
			getCommitsMock.mockResolvedValueOnce([
				{ commit: { message: 'https://trello.com/c/card1/title' } },
				{ commit: { message: 'Fix overflow\n\nhttps://trello.com/c/card2/title' } },
			])

			const cardIds = await getCardIds({ githubIncludePrCommitMessages: true }, pr)

			expect(cardIds).toEqual(['card1', 'card2'])
		})

		it('skips when no commits', async () => {
			getCommitsMock.mockResolvedValueOnce(undefined)

			const cardIds = await getCardIds({ githubIncludePrCommitMessages: true }, pr)

			expect(cardIds).toEqual([])
		})
	})

	describe('from branch name', () => {
		it('finds basic card', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-card')
			searchTrelloCardsMock.mockResolvedValueOnce([{ shortLink: 'card' }])

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(searchTrelloCards).toHaveBeenCalledWith('1-card')
			expect(cardIds).toEqual(['card'])
		})

		it('finds categorized card', async () => {
			getBranchNameMock.mockResolvedValueOnce('feature/1-card')
			searchTrelloCardsMock.mockResolvedValueOnce([{ shortLink: 'card' }])

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(searchTrelloCards).toHaveBeenCalledWith('1-card')
			expect(cardIds).toEqual(['card'])
		})

		it('finds card with title', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-funky-feature-title')
			searchTrelloCardsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
				{ id: '0', shortLink: 'card-0', idShort: 4, dateLastActivity: '2024-02-02', closed: true },
				{ id: '1', shortLink: 'card-1', idShort: 3, dateLastActivity: '2023-01-01' },
				{ id: '2', shortLink: 'card-2', idShort: 2, dateLastActivity: '2024-01-01' },
			])
			getCardInfoMock.mockImplementation((cardId) => {
				if (cardId === '0') {
					return { idShort: 4, shortLink: 'card-0' }
				} else if (cardId === '1') {
					return { idShort: 3, shortLink: 'card-1' }
				} else if (cardId === '2') {
					return { idShort: 2, shortLink: 'card-2' }
				}
			})
			getCardActionsMock.mockImplementation((cardId) => {
				if (cardId === '1') {
					return [{ data: { card: { idShort: 1 } } }]
				} else if (cardId === '2') {
					return [{ data: { card: { idShort: 2 } } }]
				}

				return []
			})

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(cardIds).toEqual(['card-1'])
		})

		it('finds card with short ID', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-nan')
			searchTrelloCardsMock
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([
					{ shortLink: 'card-1', idShort: 1, dateLastActivity: '2023-01-01' },
					{ shortLink: 'card-2', idShort: 1, dateLastActivity: '2024-01-01' },
				])

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(cardIds).toEqual(['card-2'])
		})

		it('finds multiple cards', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-2-card')
			searchTrelloCardsMock
				.mockResolvedValueOnce([{ shortLink: '1-card', idShort: 1 }])
				.mockResolvedValueOnce([{ shortLink: '2-card', idShort: 2 }])

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

		it('returns nothing when not correct card found', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-card')
			searchTrelloCardsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([])

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(cardIds).toEqual([])
		})

		it('skips searching wider when card is already linked', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-feature-nan')
			searchTrelloCardsMock
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ id: 'incorrect-card', shortLink: '1-incorrect-card', idShort: 1 }])
			getCardActionsMock.mockImplementation((id) => {
				if (id === 'card') {
					return [{ data: { card: { idShort: 1 } } }]
				} else if (id === 'incorrect-card') {
					return []
				}
			})

			const cardIds = await getCardIds(
				{ ...conf, githubIncludePrBranchName: true },
				{ ...pr, body: 'https://trello.com/c/card/title' },
			)

			expect(cardIds).toEqual(['card'])
		})

		it('ignores closed card when looking card with short ID', async () => {
			getBranchNameMock.mockResolvedValueOnce('1-nan')
			searchTrelloCardsMock
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([
					{ shortLink: 'card-1', idShort: 1, dateLastActivity: '2023-01-01', closed: true },
				])

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(cardIds).toEqual([])
		})

		it('ignores branch names that looks similar to Trello card name', async () => {
			getBranchNameMock.mockResolvedValueOnce('not-1-card')

			const cardIds = await getCardIds({ ...conf, githubIncludePrBranchName: true }, pr)

			expect(searchTrelloCards).not.toHaveBeenCalled()
			expect(cardIds).toEqual([])
		})
	})
})

describe('Creating new card', () => {
	const conf = {
		trelloListIdPrOpen: 'open-list-id',
		trelloListIdPrDraft: 'draft-list-id',
		githubIncludeNewCardCommand: true,
	}

	it('adds new card, updates PR body and adds to card ids list', async () => {
		createCardMock.mockResolvedValueOnce({ shortLink: 'card-id', url: 'card-url' })

		const cardIds = await getCardIds(conf, { ...pr, body: '/new-trello-card Description' })

		expect(createCard).toHaveBeenCalledWith('open-list-id', 'Title', ' Description')
		expect(updatePullRequestBody).toHaveBeenCalledWith('card-url Description')
		expect(cardIds).toEqual(['card-id'])
	})

	it('adds new card to draft list', async () => {
		createCardMock.mockResolvedValueOnce({ shortLink: 'card-id', url: 'card-url' })

		await getCardIds(conf, { ...pr, body: '/new-trello-card Description', draft: true })

		expect(createCard).toHaveBeenCalledWith('draft-list-id', 'Title', ' Description')
	})

	it('adds new card with "Closes" keyword', async () => {
		createCardMock.mockResolvedValueOnce({ shortLink: 'card-id', url: 'card-url' })

		await getCardIds({ ...conf, githubRequireKeywordPrefix: true }, { ...pr, body: '/new-trello-card Description' })

		expect(updatePullRequestBody).toHaveBeenCalledWith('Closes card-url Description')
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

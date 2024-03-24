import addCardLinksToPullRequest from './addCardLinksToPullRequest'
import { createComment, getBranchName, getPullRequestComments } from './api/github'
import { getCardInfo, searchTrelloCards } from './api/trello'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./actions/api/github')
jest.mock('./actions/api/trello')

const getCardInfoMock = getCardInfo as jest.Mock
const getPullRequestCommentsMock = getPullRequestComments as jest.Mock
const getBranchNameMock = getBranchName as jest.Mock
const searchTrelloCardsMock = searchTrelloCards as jest.Mock

const pr = { number: 0, state: 'open', title: 'Title' }
const conf = { githubIncludePrBranchName: true }

it('adds link', async () => {
	getBranchNameMock.mockResolvedValueOnce('1-card')
	searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])
	getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })

	await addCardLinksToPullRequest(pr, conf)

	expect(getCardInfo).toHaveBeenCalledWith('card')
	expect(createComment).toHaveBeenCalledWith('short-url')
})

it('adds multiple cards link', async () => {
	getBranchNameMock.mockResolvedValue('1-2-card')
	searchTrelloCardsMock
		.mockResolvedValueOnce([{ id: '1-card', idShort: 1 }])
		.mockResolvedValueOnce([{ id: '2-card', idShort: 2 }])
	getCardInfoMock
		.mockResolvedValueOnce({ shortUrl: '1-short-url' })
		.mockResolvedValueOnce({ shortUrl: '2-short-url' })

	await addCardLinksToPullRequest(pr, { ...conf, githubAllowMultipleCardsInPrBranchName: true })

	expect(getCardInfo).toHaveBeenNthCalledWith(1, '1-card')
	expect(getCardInfo).toHaveBeenNthCalledWith(2, '2-card')
	expect(createComment).toHaveBeenCalledWith('1-short-url\n2-short-url')
})

it('skips link adding when already in PR description', async () => {
	getBranchNameMock.mockResolvedValueOnce('1-card')
	searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])

	await addCardLinksToPullRequest({ ...pr, body: 'https://trello.com/c/card/title' }, conf)

	expect(createComment).not.toHaveBeenCalled()
})

it('skips link adding when already in PR comment', async () => {
	getBranchNameMock.mockResolvedValueOnce('1-card')
	searchTrelloCardsMock.mockResolvedValueOnce([{ id: 'card' }])
	getPullRequestCommentsMock.mockResolvedValueOnce([{ body: 'https://trello.com/c/card/title' }])

	await addCardLinksToPullRequest(pr, conf)

	expect(createComment).not.toHaveBeenCalled()
})

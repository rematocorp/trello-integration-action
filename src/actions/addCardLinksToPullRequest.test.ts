import addCardLinksToPullRequest from './addCardLinksToPullRequest'
import { createComment, getPullRequest, getPullRequestComments } from './api/github'
import { getCardInfo } from './api/trello'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')

const getCardInfoMock = getCardInfo as jest.Mock
const getPullRequestCommentsMock = getPullRequestComments as jest.Mock
const getPullRequestMock = getPullRequest as jest.Mock

const conf = { githubIncludePrBranchName: true }
const pr = { number: 0, state: 'open', title: 'Title' }

beforeEach(() => {
	getPullRequestMock.mockResolvedValueOnce(pr)
})

it('adds link', async () => {
	getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })

	await addCardLinksToPullRequest(conf, ['card'])

	expect(getCardInfo).toHaveBeenCalledWith('card')
	expect(createComment).toHaveBeenCalledWith('short-url')
})

it('adds multiple cards link', async () => {
	getCardInfoMock
		.mockResolvedValueOnce({ shortUrl: '1-short-url' })
		.mockResolvedValueOnce({ shortUrl: '2-short-url' })

	await addCardLinksToPullRequest(conf, ['1-card', '2-card'])

	expect(getCardInfo).toHaveBeenNthCalledWith(1, '1-card')
	expect(getCardInfo).toHaveBeenNthCalledWith(2, '2-card')
	expect(createComment).toHaveBeenCalledWith('1-short-url\n2-short-url')
})

it('adds only unlinked card', async () => {
	getPullRequestMock.mockReset().mockResolvedValueOnce({ ...pr, body: 'https://trello.com/c/card1/title' })
	getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'https://trello.com/c/card2/title' })

	await addCardLinksToPullRequest(conf, ['card1', 'card2'])

	expect(getCardInfo).toHaveBeenCalledWith('card2')
	expect(createComment).toHaveBeenCalledWith('https://trello.com/c/card2/title')
})

it('adds with Closes keyword', async () => {
	getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })

	await addCardLinksToPullRequest({ ...conf, githubRequireKeywordPrefix: true }, ['card'])

	expect(getCardInfo).toHaveBeenCalledWith('card')
	expect(createComment).toHaveBeenCalledWith('Closes short-url')
})

it('skips when already in PR description', async () => {
	getPullRequestMock.mockReset().mockResolvedValueOnce({ ...pr, body: 'https://trello.com/c/card/title' })

	await addCardLinksToPullRequest(conf, ['card'])

	expect(createComment).not.toHaveBeenCalled()
})

it('skips when already in PR comment', async () => {
	getPullRequestCommentsMock.mockResolvedValueOnce([{ body: 'https://trello.com/c/card/title' }])

	await addCardLinksToPullRequest(conf, ['card'])

	expect(createComment).not.toHaveBeenCalled()
})

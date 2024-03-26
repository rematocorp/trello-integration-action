import addCardLinksToPullRequest from './addCardLinksToPullRequest'
import { createComment, getPullRequestComments } from './api/github'
import { getCardInfo } from './api/trello'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')

const getCardInfoMock = getCardInfo as jest.Mock
const getPullRequestCommentsMock = getPullRequestComments as jest.Mock

const conf = { githubIncludePrBranchName: true }
const pr = { number: 0, state: 'open', title: 'Title' }

it('adds link', async () => {
	getCardInfoMock.mockResolvedValueOnce({ shortUrl: 'short-url' })

	await addCardLinksToPullRequest(conf, ['card'], pr)

	expect(getCardInfo).toHaveBeenCalledWith('card')
	expect(createComment).toHaveBeenCalledWith('short-url')
})

it('adds multiple cards link', async () => {
	getCardInfoMock
		.mockResolvedValueOnce({ shortUrl: '1-short-url' })
		.mockResolvedValueOnce({ shortUrl: '2-short-url' })

	await addCardLinksToPullRequest({ ...conf, githubAllowMultipleCardsInPrBranchName: true }, ['1-card', '2-card'], pr)

	expect(getCardInfo).toHaveBeenNthCalledWith(1, '1-card')
	expect(getCardInfo).toHaveBeenNthCalledWith(2, '2-card')
	expect(createComment).toHaveBeenCalledWith('1-short-url\n2-short-url')
})

it('skips link adding when already in PR description', async () => {
	await addCardLinksToPullRequest(conf, ['card'], { ...pr, body: 'https://trello.com/c/card/title' })
	expect(createComment).not.toHaveBeenCalled()
})

it('skips link adding when already in PR comment', async () => {
	getPullRequestCommentsMock.mockResolvedValueOnce([{ body: 'https://trello.com/c/card/title' }])

	await addCardLinksToPullRequest(conf, ['card'], pr)

	expect(createComment).not.toHaveBeenCalled()
})

it('skips when turned off', async () => {
	await addCardLinksToPullRequest({ githubIncludePrBranchName: false }, ['card'], pr)

	expect(createComment).not.toHaveBeenCalled()
})

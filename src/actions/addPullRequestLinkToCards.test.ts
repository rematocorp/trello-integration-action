import addPullRequestLinkToCards from './addPullRequestLinkToCards'
import { addAttachmentToCard, getCardAttachments } from './api/trello'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./actions/api/github')
jest.mock('./actions/api/trello')

const getCardAttachmentsMock = getCardAttachments as jest.Mock

const pr = { number: 0, state: 'open', title: 'Title', body: 'https://trello.com/c/card/title', url: 'pr-url' }

it('adds link', async () => {
	await addPullRequestLinkToCards({ ...pr, url: 'pr-url' })
	expect(addAttachmentToCard).toHaveBeenCalledWith('card', 'pr-url')

	await addPullRequestLinkToCards({ ...pr, html_url: 'pr-html-url' })
	expect(addAttachmentToCard).toHaveBeenCalledWith('card', 'pr-html-url')
})

it('skips link adding when already exists', async () => {
	getCardAttachmentsMock.mockResolvedValueOnce([{ url: 'pr-url' }])

	await addPullRequestLinkToCards({ ...pr, url: 'pr-url' })

	expect(addAttachmentToCard).not.toHaveBeenCalled()
})

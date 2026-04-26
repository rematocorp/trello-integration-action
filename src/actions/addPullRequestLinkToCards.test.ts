import addPullRequestLinkToCards from './addPullRequestLinkToCards'
import { getPullRequest } from './api/github'
import { addAttachmentToCard, getCardAttachments } from './api/trello'

vi.mock('@actions/core')
vi.mock('@actions/github')
vi.mock('./api/github')
vi.mock('./api/trello')

const getCardAttachmentsMock = vi.mocked<any>(getCardAttachments)
const getPullRequestMock = vi.mocked<any>(getPullRequest)

const pr = { number: 0, state: 'open', title: 'Title' }

it('adds link', async () => {
	getPullRequestMock.mockResolvedValueOnce({ ...pr, html_url: 'html_url' })
	await addPullRequestLinkToCards(['card'])
	expect(addAttachmentToCard).toHaveBeenCalledWith('card', 'html_url')

	getPullRequestMock.mockResolvedValueOnce({ ...pr, url: 'url' })
	await addPullRequestLinkToCards(['card'])
	expect(addAttachmentToCard).toHaveBeenCalledWith('card', 'url')
})

it('skips link adding when already exists', async () => {
	getCardAttachmentsMock.mockResolvedValueOnce([{ url: 'pr-url' }])
	getPullRequestMock.mockResolvedValueOnce({ ...pr, url: 'pr-url' })

	await addPullRequestLinkToCards(['card'])

	expect(addAttachmentToCard).not.toHaveBeenCalled()
})

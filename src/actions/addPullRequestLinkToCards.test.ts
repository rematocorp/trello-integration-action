import addPullRequestLinkToCards from './addPullRequestLinkToCards'
import { addAttachmentToCard, getCardAttachments } from './api/trello'

vi.mock('@actions/core')
vi.mock('@actions/github')
vi.mock('./api/github')
vi.mock('./api/trello')

const getCardAttachmentsMock = vi.mocked<any>(getCardAttachments)

const pr = { number: 0, state: 'open', title: 'Title' }

it('adds link', async () => {
	await addPullRequestLinkToCards(['card'], { ...pr, html_url: 'html_url' })
	expect(addAttachmentToCard).toHaveBeenCalledWith('card', 'html_url')

	await addPullRequestLinkToCards(['card'], { ...pr, url: 'url' })
	expect(addAttachmentToCard).toHaveBeenCalledWith('card', 'url')
})

it('skips link adding when already exists', async () => {
	getCardAttachmentsMock.mockResolvedValueOnce([{ url: 'pr-url' }])

	await addPullRequestLinkToCards(['card'], { ...pr, url: 'pr-url' })

	expect(addAttachmentToCard).not.toHaveBeenCalled()
})

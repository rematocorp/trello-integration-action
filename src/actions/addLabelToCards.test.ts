import addLabelToCards from './addLabelToCards'
import { addLabelToCard, getBoardLabels, getCardInfo } from './api/trello'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./actions/api/github')
jest.mock('./actions/api/trello')

const getCardInfoMock = getCardInfo as jest.Mock
const getBoardLabelsMock = getBoardLabels as jest.Mock

const pr = {
	number: 0,
	state: 'open',
	title: 'Title',
	body: 'https://trello.com/c/card/title',
	head: { ref: 'chore/clean-code' },
}
const conf = { trelloAddLabelsToCards: true }

it('adds branch category as a card label', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(pr, conf)

	expect(addLabelToCard).toHaveBeenCalledWith('card', 'chore-id')
})

it('adds partially matching branch category as a card label', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'bug-id', name: 'bug' }])

	await addLabelToCards({ ...pr, head: { ref: 'bugfix/stupid-bug' } }, conf)

	expect(addLabelToCard).toHaveBeenCalledWith('card', 'bug-id')
})

it('skips when turned off', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(pr, { trelloAddLabelsToCards: false })

	expect(addLabelToCard).not.toHaveBeenCalled()
})

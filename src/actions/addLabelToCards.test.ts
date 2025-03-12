import addLabelToCards from './addLabelToCards'
import { getBranchName } from './api/github'
import { addLabelToCard, getBoardLabels, getCardInfo } from './api/trello'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')

const getCardInfoMock = getCardInfo as jest.Mock
const getBoardLabelsMock = getBoardLabels as jest.Mock
const getBranchNameMock = getBranchName as jest.Mock
const addLabelToCardMock = addLabelToCard as jest.Mock

const head = { ref: 'chore/clean-code' }
const conf = { trelloAddLabelsToCards: true }

it('adds branch category as a card label', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(conf, ['card'], head)

	expect(addLabelToCard).toHaveBeenCalledWith('card', 'chore-id')
})

it('adds requested branch category as a card label', async () => {
	getBranchNameMock.mockResolvedValueOnce('chore/clean-code')
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(conf, ['card'])

	expect(addLabelToCard).toHaveBeenCalledWith('card', 'chore-id')
})

it('adds partially matching branch category as a card label', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'bug-id', name: 'bug' }])

	await addLabelToCards(conf, ['card'], { ref: 'bugfix/stupid-bug' })

	expect(addLabelToCard).toHaveBeenCalledWith('card', 'bug-id')
})

it('skips when branch category is not found', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(conf, ['card'], { ref: 'clean-code' })

	expect(addLabelToCard).not.toHaveBeenCalled()
})

it('skips when branch category does not match existing labels', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'feature-id', name: 'feature' }])

	await addLabelToCards(conf, ['card'], head)

	expect(addLabelToCard).not.toHaveBeenCalled()
})

it('skips when has conflicting label', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [{ name: 'bugfix' }] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards({ ...conf, trelloConflictingLabels: ['bugfix'] }, ['card'], head)

	expect(addLabelToCard).not.toHaveBeenCalled()
})

it('skips when correct label is already assigned', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [{ name: 'chore' }] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(conf, ['card'], head)

	expect(addLabelToCard).not.toHaveBeenCalled()
})

it('skips when correct label was just assigned moments ago', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])
	addLabelToCardMock.mockRejectedValue({ response: { data: 'that label is already on the card' } })

	await addLabelToCards(conf, ['card'], head)
})

it('throws error when unexpected rejection comes from Trello', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	addLabelToCardMock.mockRejectedValue({ response: { status: 500 } })

	await expect(addLabelToCards(conf, ['card'], head)).rejects.toMatchObject({ response: { status: 500 } })
})

it('skips when turned off', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards({ trelloAddLabelsToCards: false }, ['card'], head)

	expect(addLabelToCard).not.toHaveBeenCalled()
})

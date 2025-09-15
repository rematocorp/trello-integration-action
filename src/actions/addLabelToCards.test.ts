import addLabelToCards from './addLabelToCards'
import { getBranchName } from './api/github'
import { addLabelsToCard, getBoardLabels, getCardInfo } from './api/trello'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')

const getCardInfoMock = getCardInfo as jest.Mock
const getBoardLabelsMock = getBoardLabels as jest.Mock
const getBranchNameMock = getBranchName as jest.Mock
const addLabelsToCardMock = addLabelsToCard as jest.Mock

const head = { ref: 'chore/clean-code' }
const conf = { trelloAddLabelsToCards: true }

it('adds branch category as a card label', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(conf, ['card'], head)

	expect(addLabelsToCard).toHaveBeenCalledWith('card', ['chore-id'])
})

it('adds requested branch category as a card label', async () => {
	getBranchNameMock.mockResolvedValueOnce('chore/clean-code')
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(conf, ['card'])

	expect(addLabelsToCard).toHaveBeenCalledWith('card', ['chore-id'])
})

it('adds manual labels as card labels', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([
		{ id: 'someId', name: 'some label' },
		{ id: 'anotherId', name: 'another label' },
	])
	await addLabelToCards(
		{
			trelloAddManualLabelsToCards: ['some label', 'another label'],
		},
		['card'],
		head,
	)

	expect(addLabelsToCard).toHaveBeenCalledWith('card', ['someId', 'anotherId'])
})

it('adds partially matching branch category as a card label', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'bug-id', name: 'bug' }])

	await addLabelToCards(conf, ['card'], { ref: 'bugfix/stupid-bug' })

	expect(addLabelsToCard).toHaveBeenCalledWith('card', ['bug-id'])
})

it('skips when branch category is not found', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(conf, ['card'], { ref: 'clean-code' })

	expect(addLabelsToCard).not.toHaveBeenCalled()
})

it('skips when branch category does not match existing labels', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'feature-id', name: 'feature' }])

	await addLabelToCards(conf, ['card'], head)

	expect(addLabelsToCard).not.toHaveBeenCalled()
})

it('skips when has conflicting label', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [{ name: 'bugfix' }] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards({ ...conf, trelloConflictingLabels: ['bugfix'] }, ['card'], head)

	expect(addLabelsToCard).not.toHaveBeenCalled()
})

it('skips when correct label is already assigned', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [{ name: 'chore' }] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards(conf, ['card'], head)

	expect(addLabelsToCard).not.toHaveBeenCalled()
})

it('skips when correct label was just assigned moments ago', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])
	addLabelsToCardMock.mockRejectedValue({ response: { data: 'that label is already on the card' } })

	await addLabelToCards(conf, ['card'], head)
})

it('throws error when unexpected rejection comes from Trello', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	addLabelsToCardMock.mockRejectedValue({ response: { status: 500 } })

	await expect(addLabelToCards(conf, ['card'], head)).rejects.toMatchObject({ response: { status: 500 } })
})

it('skips when turned off', async () => {
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', labels: [] })
	getBoardLabelsMock.mockResolvedValueOnce([{ id: 'chore-id', name: 'chore' }])

	await addLabelToCards({ trelloAddLabelsToCards: false }, ['card'], head)

	expect(addLabelsToCard).not.toHaveBeenCalled()
})

import { getCommits, getPullRequest } from './api/github'
import { addMemberToCard, getCardInfo, getMemberInfo, removeMemberFromCard } from './api/trello'
import updateCardMembers from './updateCardMembers'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')

const getPullRequestMock = getPullRequest as jest.Mock
const getCommitsMock = getCommits as jest.Mock
const getMemberInfoMock = getMemberInfo as jest.Mock
const getCardInfoMock = getCardInfo as jest.Mock

const conf = { githubUsersToTrelloUsers: 'jack: jones\namy: amy1993', trelloRemoveUnrelatedMembers: true }
const prResponse = {
	user: { login: 'phil' },
	body: 'https://trello.com/c/card/title',
}

it('adds PR author and assignees to the card and removes unrelated members', async () => {
	getPullRequestMock.mockResolvedValue({ ...prResponse, assignees: [{ login: 'amy' }] })
	getCommitsMock.mockResolvedValue([{ author: { login: 'john' } }])
	getMemberInfoMock.mockImplementation((username) => {
		if (username === 'amy1993') {
			return { id: 'amy-id' }
		} else if (username === 'john') {
			return { id: 'john-id' }
		} else {
			return { id: 'phil-id' }
		}
	})
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', idMembers: ['jones-id'] })

	await updateCardMembers(conf, ['card'])

	expect(addMemberToCard).toHaveBeenCalledWith('card', 'phil-id')
	expect(addMemberToCard).toHaveBeenCalledWith('card', 'amy-id')
	expect(addMemberToCard).toHaveBeenCalledWith('card', 'john-id')
	expect(removeMemberFromCard).toHaveBeenCalledWith('card', 'jones-id')
})

it('skips removing unrelated members when none found', async () => {
	getPullRequestMock.mockResolvedValue(prResponse)
	getMemberInfoMock.mockResolvedValueOnce({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', idMembers: [] })

	await updateCardMembers(conf, ['card'])

	expect(removeMemberFromCard).not.toHaveBeenCalled()
})

it('skips removing unrelated members when turned off', async () => {
	getPullRequestMock.mockResolvedValue(prResponse)
	getMemberInfoMock.mockResolvedValueOnce({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', idMembers: ['jones-id'] })

	await updateCardMembers({ trelloRemoveUnrelatedMembers: false }, ['card'])

	expect(removeMemberFromCard).not.toHaveBeenCalled()
})

it('skips adding when all members are already assigned to the card', async () => {
	getPullRequestMock.mockResolvedValue(prResponse)
	getMemberInfoMock.mockResolvedValueOnce({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValueOnce({ id: 'card', idMembers: ['phil-id'] })

	await updateCardMembers({}, ['card'])

	expect(addMemberToCard).not.toHaveBeenCalled()
})

it('skips adding when member not found with GitHub username', async () => {
	getPullRequestMock.mockResolvedValue(prResponse)
	getMemberInfoMock.mockResolvedValue(undefined)

	await updateCardMembers({}, ['card'])

	expect(addMemberToCard).not.toHaveBeenCalled()
})

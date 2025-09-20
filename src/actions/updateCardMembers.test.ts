import { Conf } from 'src/types'

import { getCommits, getPullRequest, getPullRequestRequestedReviewers, getPullRequestReviews } from './api/github'
import { addMemberToCard, getCardInfo, getMemberInfo, removeMemberFromCard } from './api/trello'
import updateCardMembers from './updateCardMembers'
import isChangesRequestedInReview from './utils/isChangesRequestedInReview'
import isPullRequestApproved from './utils/isPullRequestApproved'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('./api/github')
jest.mock('./api/trello')
jest.mock('./utils/isPullRequestApproved')
jest.mock('./utils/isChangesRequestedInReview')

const getPullRequestMock = getPullRequest as jest.Mock
const getPullRequestReviewsMock = getPullRequestReviews as jest.Mock
const isPullRequestApprovedMock = isPullRequestApproved as jest.Mock
const isChangesRequestedInReviewMock = isChangesRequestedInReview as jest.Mock
const getPullRequestRequestedReviewersMock = getPullRequestRequestedReviewers as jest.Mock
const getCommitsMock = getCommits as jest.Mock
const getMemberInfoMock = getMemberInfo as jest.Mock
const getCardInfoMock = getCardInfo as jest.Mock
const addMemberToCardMock = addMemberToCard as jest.Mock
const removeMemberFromCardMock = removeMemberFromCard as jest.Mock

let pr = { title: 'Test PR', state: 'open', draft: true }
let conf: Conf = {
	githubUsersToTrelloUsers: 'jack: jones\namy: amy1993',
	trelloAddMembersToCards: true,
	trelloRemoveUnrelatedMembers: true,
}
const prResponse = {
	user: { login: 'phil' },
	body: 'https://trello.com/c/card/title',
}

beforeEach(() => {
	getPullRequestMock.mockResolvedValue(prResponse)
})

it('adds PR author and assignees to the card and removes unrelated members', async () => {
	getPullRequestMock.mockResolvedValue({ ...prResponse, assignees: [{ login: 'amy' }] })
	getCommitsMock.mockResolvedValue([{ author: { login: 'john' } }])
	getMemberInfoMock.mockImplementation((username) => {
		if (username === 'amy1993') {
			return { id: 'amy-id', organizations: [{ name: 'remato' }] }
		} else if (username === 'john') {
			return { id: 'john-id', organizations: [{ name: 'remato' }] }
		} else {
			return { id: 'phil-id', organizations: [{ name: 'remato' }] }
		}
	})
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['jones-id'] })

	await updateCardMembers({ ...conf, trelloOrganizationName: 'remato' }, ['card'], pr)

	expect(addMemberToCard).toHaveBeenCalledWith('card', 'phil-id')
	expect(addMemberToCard).toHaveBeenCalledWith('card', 'amy-id')
	expect(addMemberToCard).toHaveBeenCalledWith('card', 'john-id')
	expect(removeMemberFromCard).toHaveBeenCalledWith('card', 'jones-id')
})

it('adds committer to the card', async () => {
	getCommitsMock.mockResolvedValue([{ committer: { login: 'john' } }])
	getMemberInfoMock.mockResolvedValue({ id: 'john-id' })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: [] })

	await updateCardMembers(conf, ['card'], pr)

	expect(addMemberToCard).toHaveBeenCalledWith('card', 'john-id')
})

it('ignores incorrectly configured usernames mapping', async () => {
	await updateCardMembers({ ...conf, githubUsersToTrelloUsers: 'phil' }, ['card'], pr)

	expect(getMemberInfoMock).toHaveBeenCalledWith('phil')
})

it('removes only reviewers when unrelated members removing is turned off but switching members in review is on', async () => {
	getPullRequestRequestedReviewersMock.mockResolvedValue({ users: [] })
	getPullRequestReviewsMock.mockResolvedValue([{ state: 'ACTIVE', user: { login: 'amy' } }])
	getMemberInfoMock.mockImplementation((username) => ({ id: username }))
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['amy1993', 'jones'] })

	await updateCardMembers(
		{ ...conf, trelloRemoveUnrelatedMembers: false, trelloSwitchMembersInReview: true },
		['card'],
		pr,
	)

	expect(removeMemberFromCard).toHaveBeenCalledTimes(1)
	expect(removeMemberFromCard).toHaveBeenCalledWith('card', 'amy1993')
})

it('throws error when fetching member info fails for unknown reason', async () => {
	getMemberInfoMock.mockRejectedValue({ response: { status: 500 } })

	await expect(updateCardMembers(conf, ['card'], pr)).rejects.toMatchObject({ response: { status: 500 } })
	expect(addMemberToCard).not.toHaveBeenCalled()
})

it('throws error when assigning member fails for unknown reason', async () => {
	getMemberInfoMock.mockResolvedValue({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: [] })
	addMemberToCardMock.mockRejectedValue({ response: { status: 500 } })

	await expect(updateCardMembers(conf, ['card'], pr)).rejects.toMatchObject({ response: { status: 500 } })
})

it('throws error when removing member fails for unknown reason', async () => {
	getMemberInfoMock.mockResolvedValue({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['jones-id'] })
	removeMemberFromCardMock.mockRejectedValue({ response: { status: 500 } })

	await expect(updateCardMembers(conf, ['card'], pr)).rejects.toMatchObject({ response: { status: 500 } })
})

it('skips removing unrelated members when none found', async () => {
	getMemberInfoMock.mockResolvedValue({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: [] })

	await updateCardMembers(conf, ['card'], pr)

	expect(removeMemberFromCard).not.toHaveBeenCalled()
})

it('skips removing reviewers when none found', async () => {
	getPullRequestRequestedReviewersMock.mockResolvedValue({ users: [] })
	getPullRequestReviewsMock.mockResolvedValue([])
	getMemberInfoMock.mockImplementation((username) => ({ id: username }))
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['amy', 'jones'] })

	await updateCardMembers(
		{ ...conf, trelloRemoveUnrelatedMembers: false, trelloSwitchMembersInReview: true },
		['card'],
		pr,
	)

	expect(removeMemberFromCard).not.toHaveBeenCalled()
})

it('skips removing unrelated members when turned off', async () => {
	getMemberInfoMock.mockResolvedValue({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['jones-id'] })

	await updateCardMembers({ ...conf, trelloRemoveUnrelatedMembers: false }, ['card'], pr)

	expect(removeMemberFromCard).not.toHaveBeenCalled()
})

it('skips adding when all members are already assigned to the card', async () => {
	getMemberInfoMock.mockResolvedValue({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['phil-id'] })

	await updateCardMembers(conf, ['card'], pr)

	expect(addMemberToCard).not.toHaveBeenCalled()
})

it('skips adding when member not found with GitHub username', async () => {
	getMemberInfoMock.mockRejectedValue({ response: { status: 404 } })

	await updateCardMembers(conf, ['card'], pr)

	expect(addMemberToCard).not.toHaveBeenCalled()
})

it('skips adding when member is already assigned to the card', async () => {
	getMemberInfoMock.mockResolvedValue({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: [] })
	addMemberToCardMock.mockRejectedValue({ response: { data: 'member is already on the card' } })

	await expect(updateCardMembers(conf, ['card'], pr)).resolves.not.toThrow()
})

it('skips removing when member is already removed from the card', async () => {
	getMemberInfoMock.mockResolvedValue({ id: 'phil-id' })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['jones-id'] })
	removeMemberFromCardMock.mockRejectedValue({ response: { data: 'member is not on the card' } })

	await expect(updateCardMembers(conf, ['card'], pr)).resolves.not.toThrow()
})

it('skips adding when member not part of the org', async () => {
	getMemberInfoMock.mockResolvedValue({ id: 'phil-id', organizations: [{ name: 'foo' }] })
	getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['phil-id'] })

	await updateCardMembers({ ...conf, trelloOrganizationName: 'remato' }, ['card'], pr)

	expect(addMemberToCard).not.toHaveBeenCalled()
})

it('skips adding when PR not found', async () => {
	getPullRequestMock.mockResolvedValue(null)

	await updateCardMembers({ ...conf, trelloOrganizationName: 'remato' }, ['card'], pr)

	expect(addMemberToCard).not.toHaveBeenCalled()
})

it('skips adding when turned off', async () => {
	getPullRequestMock.mockResolvedValue({ ...prResponse, assignees: [{ login: 'amy' }] })
	getMemberInfoMock.mockImplementation(() => ({ id: 'amy-id' }))

	await updateCardMembers({ ...conf, trelloAddMembersToCards: false }, ['card'], pr)

	expect(addMemberToCard).not.toHaveBeenCalled()
})

describe('switching card members with reviewers when PR is in review', () => {
	beforeEach(() => {
		pr = { ...pr, draft: false }
		conf = { ...conf, githubUsersToTrelloUsers: undefined, trelloSwitchMembersInReview: true }

		getMemberInfoMock.mockImplementation((username) => (username !== 'phil' ? { id: username } : null))
		getCardInfoMock.mockResolvedValue({ id: 'card', idMembers: ['phil'] })
		getPullRequestRequestedReviewersMock.mockResolvedValue({ users: [{ login: 'amy' }] })
		getPullRequestReviewsMock.mockResolvedValue([
			{ state: 'PENDING', user: { login: 'john' } },
			{ state: 'ACTIVE', user: { login: 'mike' } },
		])
	})

	it('removes all existing members and adds reviewers to the card', async () => {
		await updateCardMembers(conf, ['card'], pr)

		expect(removeMemberFromCard).toHaveBeenCalledWith('card', 'phil')
		expect(addMemberToCard).toHaveBeenCalledTimes(2)
		expect(addMemberToCard).toHaveBeenCalledWith('card', 'amy')
		expect(addMemberToCard).toHaveBeenCalledWith('card', 'mike')
	})

	it('only removes all existing members when reviewers missing', async () => {
		getMemberInfoMock.mockImplementation(() => null)

		await updateCardMembers(conf, ['card'], pr)

		expect(removeMemberFromCard).toHaveBeenCalledWith('card', 'phil')
		expect(addMemberToCard).not.toHaveBeenCalled()
	})

	it('skips when PR not open', async () => {
		await updateCardMembers(conf, ['card'], { ...pr, state: 'closed' })

		expect(removeMemberFromCard).not.toHaveBeenCalled()
		expect(addMemberToCard).not.toHaveBeenCalled()
	})

	it('skips when PR is in draft', async () => {
		await updateCardMembers(conf, ['card'], { ...pr, draft: true })

		expect(removeMemberFromCard).not.toHaveBeenCalled()
		expect(addMemberToCard).not.toHaveBeenCalled()
	})

	it('skips when card is moved to changes requested list', async () => {
		isChangesRequestedInReviewMock.mockResolvedValue(true)

		await updateCardMembers({ ...conf, trelloListIdPrChangesRequested: '1' }, ['card'], pr)

		expect(removeMemberFromCard).not.toHaveBeenCalled()
		expect(addMemberToCard).not.toHaveBeenCalled()
	})

	it('skips when card is moved to approved list', async () => {
		isPullRequestApprovedMock.mockResolvedValue(true)

		await updateCardMembers({ ...conf, trelloListIdPrApproved: '1' }, ['card'], { ...pr, draft: false })

		expect(removeMemberFromCard).not.toHaveBeenCalled()
		expect(addMemberToCard).not.toHaveBeenCalled()
	})

	it('skips when turned off', async () => {
		await updateCardMembers({ ...conf, trelloSwitchMembersInReview: false }, ['card'], pr)

		expect(removeMemberFromCard).not.toHaveBeenCalled()
		expect(addMemberToCard).not.toHaveBeenCalled()
	})
})

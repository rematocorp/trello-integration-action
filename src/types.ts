import { context } from '@actions/github'

export interface Conf {
	githubRequireTrelloCard?: boolean
	githubIncludePrComments?: boolean
	githubIncludePrBranchName?: boolean
	githubIncludeNewCardCommand?: boolean
	githubRequireKeywordPrefix?: boolean
	githubUsersToTrelloUsers?: string
	trelloListIdPrDraft?: string
	trelloListIdPrOpen?: string
	trelloListIdPrClosed?: string
	trelloBoardId?: string
	trelloOrganizationName?: string
	trelloConflictingLabels?: string[]
	trelloRemoveUnrelatedMembers?: boolean
	trelloAddLabelsToCards?: boolean
}

export type PR = Omit<
	Exclude<typeof context.payload.pull_request | typeof context.payload.issue, undefined>,
	'body'
> & {
	body?: string | null
}
export type PRHead = { ref: string }

export type BoardLabel = { id: string; name: string }

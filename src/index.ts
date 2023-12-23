import * as core from '@actions/core'
import { context } from '@actions/github'
import { run } from './main'
import { PR } from './types'

run((context.payload.pull_request || context.payload.issue) as PR, {
	githubRequireKeywordPrefix: core.getBooleanInput('github-require-keyword-prefix'),
	githubRequireTrelloCard: core.getBooleanInput('github-require-trello-card'),
	githubIncludePrComments: core.getBooleanInput('github-include-pr-comments'),
	githubIncludePrBranchName: core.getBooleanInput('github-include-pr-branch-name'),
	githubIncludeNewCardCommand: core.getBooleanInput('github-include-new-card-command'),
	githubUsersToTrelloUsers: core.getInput('github-users-to-trello-users'),
	trelloOrganizationName: core.getInput('trello-organization-name'),
	trelloListIdPrDraft: core.getInput('trello-list-id-pr-draft'),
	trelloListIdPrOpen: core.getInput('trello-list-id-pr-open'),
	trelloListIdPrClosed: core.getInput('trello-list-id-pr-closed'),
	trelloConflictingLabels: core.getInput('trello-conflicting-labels')?.split(';'),
	trelloBoardId: core.getInput('trello-board-id'),
	trelloAddLabelsToCards: core.getBooleanInput('trello-add-labels-to-cards'),
	trelloRemoveUnrelatedMembers: core.getBooleanInput('trello-remove-unrelated-members'),
})

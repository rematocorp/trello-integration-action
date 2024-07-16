import * as core from '@actions/core'
import { context } from '@actions/github'
import { run } from './main'
import { PR } from './types'

run((context.payload.pull_request || context.payload.issue) as PR, {
	githubRequireKeywordPrefix: core.getBooleanInput('github-require-keyword-prefix'),
	githubRequireTrelloCard: core.getBooleanInput('github-require-trello-card'),
	githubEnableRelatedKeywordPrefix: core.getBooleanInput('github-enable-related-keyword-prefix'),
	githubIncludePrComments: core.getBooleanInput('github-include-pr-comments'),
	githubIncludePrBranchName: core.getBooleanInput('github-include-pr-branch-name'),
	githubIncludePrCommitMessages: core.getBooleanInput('github-include-pr-commit-messages'),
	githubAllowMultipleCardsInPrBranchName: core.getBooleanInput('github-allow-multiple-cards-in-pr-branch-name'),
	githubIncludeNewCardCommand: core.getBooleanInput('github-include-new-card-command'),
	githubUsersToTrelloUsers: core.getInput('github-users-to-trello-users'),
	trelloOrganizationName: core.getInput('trello-organization-name'),
	trelloListIdPrDraft: core.getInput('trello-list-id-pr-draft'),
	trelloListIdPrOpen: core.getInput('trello-list-id-pr-open'),
	trelloListIdPrChangesRequested: core.getInput('trello-list-id-pr-changes-requested'),
	trelloListIdPrApproved: core.getInput('trello-list-id-pr-approved'),
	trelloListIdPrClosed: core.getInput('trello-list-id-pr-closed'),
	trelloBoardId: core.getInput('trello-board-id'),
	trelloConflictingLabels: core.getInput('trello-conflicting-labels')?.split(';'),
	trelloAddLabelsToCards: core.getBooleanInput('trello-add-labels-to-cards'),
	trelloAddMembersToCards: core.getBooleanInput('trello-add-members-to-cards'),
	trelloSwitchMembersInReview: core.getBooleanInput('trello-switch-members-in-review'),
	trelloRemoveUnrelatedMembers: core.getBooleanInput('trello-remove-unrelated-members'),
	trelloArchiveOnMerge: core.getBooleanInput('trello-archive-on-merge'),
})

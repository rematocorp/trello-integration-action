# Trello Card & GitHub PR Integration

[![Build](https://img.shields.io/github/actions/workflow/status/rematocorp/trello-integration-action/ci.yml)](https://github.com/rematocorp/trello-integration-action/actions/workflows/ci.yml)
[![Codecov](https://img.shields.io/codecov/c/github/rematocorp/trello-integration-action?token=NDT35FM2LG&style=flat)](https://codecov.io/gh/rematocorp/trello-integration-action)

This GitHub action integrates GitHub and Trello, automatically updating Trello cards with pull request information to minimize redundant manual work.

The action looks for:

- Trello card URLs from PR description, comments and commit messages,
- Trello card short ID from PR branch name,

and:

- links a PR to a Trello card and vice versa,
- moves a Trello card when PR is opened, moved back to draft or closed,
- adds a label to a Trello card based on the branch name (e.g. `feature/foo`),
- assigns a PR author and fellow contributors to a Trello card,
- and more...

## Basic configuration

```yaml
name: Trello integration
on:
    pull_request:
        types: [opened, edited, closed, reopened, ready_for_review, converted_to_draft]
    issue_comment:
        types: [created, edited]
jobs:
    trello:
        runs-on: ubuntu-latest
        steps:
            - uses: rematocorp/trello-integration-action@v9
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  trello-api-key: ${{ secrets.TRELLO_API_KEY }}
                  trello-auth-token: ${{ secrets.TRELLO_AUTH_TOKEN }}
                  trello-list-id-pr-open: 6603333cf96e4419a590d9ab
                  trello-list-id-pr-closed: 66025544a40b6a11a12233de
                  # For more options look below
```

## All options

<details>
<summary>Tokens</summary>

#### 1. `github-token`

**Required**: Needed for Octokit API.

Example:

```yaml
github-token: ${{ secrets.GITHUB_TOKEN }}
```

#### 2. `trello-api-key` & `trello-auth-token`

**Required**: Needed for Trello API, visit https://trello.com/app-key.

Example:

```yaml
trello-api-key: ${{ secrets.TRELLO_API_KEY }}
trello-auth-token: ${{ secrets.TRELLO_AUTH_TOKEN }}
```

</details>

<details>
<summary>Linking Trello cards with GitHub PR</summary>

#### 1. `github-include-pr-comments`

Scans PR comments to find Trello card URLs.

Default: `true`

#### 2. `github-include-pr-commit-messages`

Scans PR commit messages to find Trello card URLs and comments card URL to the PR if found.

Default: `false`

#### 3. `github-include-pr-branch-name`

Uses the branch name to find card id (e.g. feature/38-card-title) and comments card URL to the PR if found.

NB! Make sure you set `pull-requests: write` permission for the job. [Learn more.](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)

Default: `false`

#### 4. `github-allow-multiple-cards-in-pr-branch-name`

Allows to reference multiple card short IDs in the branch name (e.g. feature/38-39-40-foo-bar).

NB! Option `github-include-pr-branch-name` needs to be true and it is recommended to set `trello-board-id` to avoid moving wrong cards.

Default: `false`

#### 5. `github-require-keyword-prefix`

Only matches Trello URLs prefixed with "Closes" etc. Just like [GitHub Issues + PR work.](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword)

Default: `false`

#### 6. `github-enable-related-keyword-prefix`

Ignores Trello URLs prefixed with "Related". Alternative to `github-require-keyword-prefix`.

Default: `false`

#### 7. `github-require-trello-card`

Throws an error if no Trello card can be found in the PR.

Default: `false`

</details>

<details>
<summary>Creating a Trello card from a GitHub PR</summary>

#### 1. `github-include-new-card-command`

Creates a new Trello card from PR details if "/new-trello-card" is written in the PR description. Replaces "/new-trello-card" with the card link.

NB! Make sure you set `pull-requests: write` permission for the job. [Learn more.](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)

Default: `false`

#### 2. `github-create-new-card-on-merge`

Creates a new Trello card from PR details if no card is linked and the PR is merged. Adds card link to the PR description.

NB! Make sure you set `pull-requests: write` permission for the job. [Learn more.](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)

Default: `false`

</details>

<details>
<summary>Moving Trello cards</summary>

#### 1. `trello-list-id-pr-draft`

Trello list ID for draft pull request. [How to find list ID.](https://stackoverflow.com/a/50908600/2311110) Useful when you want to move the card back to "In progress" when ready PR is converted to draft.

#### 2. `trello-list-id-pr-open`

Trello list ID for open pull request. [How to find list ID.](https://stackoverflow.com/a/50908600/2311110)

#### 3. `trello-list-id-pr-changes-requested`

Trello list ID for a pull request which has at least one review requesting for changes. [How to find list ID.](https://stackoverflow.com/a/50908600/2311110)

NB! Add `pull_request_review` trigger and modify `pull_request` trigger with `review_requested` and `review_request_removed`. [Learn more.](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)

#### 4. `trello-list-id-pr-approved`

Trello list ID for a pull request which has at least one approve and no reviews requesting for changes. [How to find list ID.](https://stackoverflow.com/a/50908600/2311110)

NB! Add `pull_request_review` trigger and modify `pull_request` trigger with `review_requested` and `review_request_removed`. [Learn more.](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)

#### 5. `trello-list-id-pr-merged`

Trello list ID for merged pull request. [How to find list ID.](https://stackoverflow.com/a/50908600/2311110)

NB! `trello-archive-on-merge` set to `true` will override this.

#### 6. `trello-list-id-pr-closed`

Trello list ID for closed pull request. [How to find list ID.](https://stackoverflow.com/a/50908600/2311110)

NB! If card is merged and `trello-list-id-pr-merged` is set, then it will override this.

#### 7. `trello-board-id`

Trello board ID where to move the cards. [How to find board ID.](https://stackoverflow.com/a/50908600/2311110) Useful when you want the action to move the card out from a backlog board.

#### 8. `trello-archive-on-merge`

Archives Trello cards when PR is merged.

Default: `false`

#### 9. `trello-card-position`

Position of the card after being moved to a list.

Options: `'top' | 'bottom'`

Default: `'top'`

</details>

<details>
<summary>Assigning members to Trello cards</summary>

#### 1. `github-users-to-trello-users`

Newline-separated list of mapping between GitHub username and Trello username. Use it for people who have different usernames in GitHub and Trello. If the current username is not in the list, we still try to find a Trello user with GitHub username.

Example:

```yaml
github-users-to-trello-users: |-
    GithubUser1:TrelloUser1
    GithubUser2:TrelloUser2
```

#### 2. `trello-add-members-to-cards`

Adds PR author, contributors and assignees to Trello card members list. This affects also `trello-switch-members-in-review` and `trello-remove-unrelated-members` when turned off.

Default: `true`

#### 3. `trello-switch-members-in-review`

Replaces Trello card members with PR reviewers when PR is opened. It reassigns the PR author, contributors and assignees when the card is moved away from `trello-list-id-pr-open`.

Default: `false`

#### 4. `trello-remove-unrelated-members`

Removes card members who are not authors, contributors or assignees of the PR.

Default: `true`

#### 5. `trello-organization-name`

Your organization name to avoid assigning cards to outside members. Edit your workspace details and look for the short name.

Example:

```yaml
trello-organization-name: remato
```

</details>

<details>
<summary>Assigning labels to Trello cards</summary>

#### 1. `trello-add-labels-to-cards`

Assigns branch category (e.g. feature/foo) label to Trello card.

Default: `true`

#### 2. `trello-conflicting-labels`

When a card already has one of these labels then branch category label is not assigned.

Example:

```yaml
trello-conflicting-labels: 'feature;bug;chore'
```

</details>

## Advanced use cases

<details>
<summary>Move to different list depending on target branch</summary>

Map target branch names to Trello list IDs so cards move automatically to the right list. Use branch patterns (e.g. release/_, hotfix/_) to match multiple branches, and always define a \* fallback list to catch anything unmatched. [Learn more.](https://github.com/rematocorp/trello-integration-action/pull/140#issuecomment-2641019842)

```yaml
trello-list-id-pr-closed: |-
    release/*:65e9cd42133cce03db170000
    *:65e9cd42133cce03db172222
```

</details>

<details>
<summary>Move to list according to current board</summary>

Separate list IDs with a semicolon to support multiple boards. [Learn more.](https://github.com/rematocorp/trello-integration-action/issues/68)

```yaml
trello-list-id-pr-closed: 65e9cd42133cce03db170000;65e9cd42133cce03db172222
```

</details>

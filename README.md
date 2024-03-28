# Trello Card & GitHub PR Integration

This GitHub action seamlessly integrates GitHub with Trello by scanning:

-   Trello card URLs from PR description and comments,
-   Trello card short ID from PR branch name,

and triggering following actions:

-   links a PR to a Trello card and vice versa,
-   moves a Trello card when PR is opened, moved back to draft or merged/closed,
-   adds a label to a Trello card based on the branch name (e.g. `feature/foo`),
-   assigns a PR author and fellow contributors/assignees to a Trello card,
-   and more...

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
```

## All options

```yaml
# REQUIRED
github-token: ${{ secrets.GITHUB_TOKEN }}

# REQUIRED: Visit https://trello.com/app-key
trello-api-key: ${{ secrets.TRELLO_API_KEY }}

# REQUIRED: Visit https://trello.com/app-key and click "Generate a token".
trello-auth-token: ${{ secrets.TRELLO_AUTH_TOKEN }}

# Scans PR comments to find Trello card URLs.
# DEFAULT: true
github-include-pr-comments: true

# Uses the branch name to find card id (e.g. feature/38-card-title).
# Comments card URL to the PR if found.
# DEFAULT: false
github-include-pr-branch-name: false

# Allows to reference multiple card short IDs in the branch name (e.g. feature/38-39-40-foo-bar).
# Option github-include-pr-branch-name needs to be true and it is recommended to set trello-board-id to avoid moving wrong cards
# DEFAULT: false
github-allow-multiple-cards-in-pr-branch-name: false

# Creates a new Trello card from PR details if "/new-trello-card" is written in the PR description.
# Replaces "/new-trello-card" with the card link.
# DEFAULT: false
github-include-new-card-command: false

# Only matches Trello URLs prefixed with "Closes" etc.
# Just like https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
# DEFAULT: false
github-require-keyword-prefix: false

# Throws an error if no Trello card can be found in the PR.
# DEFAULT: false
github-require-trello-card: false

# Trello list ID for draft pull request.
# Useful when you want to move the card back to "In progress" when ready PR is converted to draft.
# How to find list ID: https://stackoverflow.com/a/50908600/2311110
trello-list-id-pr-draft: xxx

# Trello list ID for open pull request.
# How to find list ID: https://stackoverflow.com/a/50908600/2311110
trello-list-id-pr-open: xxx

# Trello list ID for closed pull request.
# How to find list ID: https://stackoverflow.com/a/50908600/2311110
trello-list-id-pr-closed: xxx

# Trello board ID where to move the cards.
# Useful when you want the action to move the card out from the backlog.
# How to find board ID: https://stackoverflow.com/a/50908600/2311110
trello-board-id: xxx

# Position of the card after being moved to a list.
# OPTIONS: 'top' or 'bottom'
# DEFAULT: 'top'
trello-card-position: 'top'

# Newline-separated list of mapping between GitHub username and Trello username.
# Use it for people who have different usernames in GitHub and Trello.
# If the current username is not in the list, we still try to find a Trello user with GitHub username.
github-users-to-trello-users: |-
    GithubUser1:TrelloUser1
    GithubUser2:TrelloUser2

# Your organization name to avoid assigning cards to outside members,
# edit your workspace details and look for the short name.
trello-organization-name: remato

# Assigns branch category (e.g. feature/foo) label to Trello card.
# DEFAULT: true
trello-add-labels-to-cards: true

# When a card already has one of these labels then branch category label is not assigned.
trello-conflicting-labels: 'feature;bug;chore'

# Removes card members who are not authors, contributors or assignees of the PR.
# DEFAULT: true
trello-remove-unrelated-members: true

# Archives Trello cards when PR is merged.
# DEFAULT: false
trello-archive-on-merge: false
```

## Advanced use cases

### Multiple boards support

Use `;` to separate multiple board list IDs. The action will transfer the card to an existing list on its current board.

```yaml
trello-list-id-pr-closed: '6603333cf96e4419a590d9ab;66025544a40b6a11a12233de;77788894a40b6a11a12233de'
```

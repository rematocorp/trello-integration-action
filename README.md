# Trello integration action

Connects GitHub PRs and Trello cards:

-   attaches PR link to a Trello card ([works best with GitHub Power-up](https://trello.com/power-ups/55a5d916446f517774210004/github)),
-   adds PR comment with Trello card URL when using Trello card number in the branch name,
-   moves Trello card when PR is opened or closed,
-   adds an appropriate board label to a Trello card when branch name is categorised (e.g. `feature/foo`),
-   exclusively assigns the PR author and fellow assignees to the Trello card (but only when they own the same usernames in Github and Trello).

The action looks for Trello card URL within the PR description and comments. If found, it will integrate the two worlds.

```yaml
name: Trello integration
on:
    pull_request:
        types: [opened, edited, closed, reopened, ready_for_review, converted_to_draft]
    issue_comment:
        types: [created, edited]
jobs:
    build:
        runs-on: ubuntu-latest
        steps:
            - uses: rematocorp/trello-integration-action@v7
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  github-require-keyword-prefix: false # When true match only URLs prefixed with “Closes” etc just like https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
                  github-require-trello-card: false # Throw an error if no Trello cards can be found in the PR description
                  trello-api-key: ${{ secrets.TRELLO_API_KEY }} # https://trello.com/app-key
                  trello-auth-token: ${{ secrets.TRELLO_AUTH_TOKEN }} # https://trello.com/app-key then click generate a token
                  trello-organization-name: remato # Your organization name to avoid assigning cards to outside members, edit your workspace details and look for the short name
                  trello-board-id: xxx # Trello board ID where to move the cards
                  trello-list-id-pr-draft: xxx # Trello list ID for draft pull request (useful when you want to move the card back to In progress when ready PR is converted to draft)
                  trello-list-id-pr-open: xxx # Trello list ID for open pull request
                  trello-list-id-pr-closed: xxx # Trello list ID for closed pull request
                  trello-conflicting-labels: 'feature;bug;chore' # When a card has one of these labels then branch category label is not assigned
                  trello-card-in-branch-name: false # When true search for card name (e.g. "1234-card-title") in the branch name if card URL is not found in PR description or comments. If card id is found from branch then adds a comment with the card URL.
```

[Here is how you can find out your board and list IDs](https://stackoverflow.com/a/50908600/2311110).

Inspired by [dalezak/github-commit-to-trello-card](https://github.com/dalezak/github-commit-to-trello-card) and [delivered/attach-to-trello-card-action](https://github.com/delivered/attach-to-trello-card-action).

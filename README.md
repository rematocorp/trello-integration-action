# Trello integration action

Connects GitHub PRs and Trello cards:

-   attaches PR link to a Trello card ([works best with GitHub Power-up](https://trello.com/power-ups/55a5d916446f517774210004/github)),
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
            - uses: rematocorp/trello-integration-action@v6
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  trello-api-key: ${{ secrets.TRELLO_API_KEY }} # https://trello.com/app-key
                  trello-auth-token: ${{ secrets.TRELLO_AUTH_TOKEN }} # https://trello.com/app-key then click generate a token
                  trello-organization-name: remato # Your organization name to avoid assigning cards to outside members, edit your workspace details and look for the short name
                  trello-board-id: ${{ secrets.TRELLO_BOARD_ID }} # Trello board ID where to move the cards, visit a board then append .json to url to find id
                  trello-list-id-pr-open: ${{ secrets.TRELLO_PR_OPEN_LIST_ID }} # Trello list ID for open pull request, visit a board then append .json to url to find id
                  trello-list-id-pr-closed: ${{ secrets.TRELLO_PR_CLOSED_LIST_ID }} # Trello list ID for closed pull request, visit a board then append .json to url to find id
                  trello-conflicting-labels: 'feature;bug;chore' # When a card has one of these labels then branch category label is not assigned
```

Inspired by [dalezak/github-commit-to-trello-card](https://github.com/dalezak/github-commit-to-trello-card) and [delivered/attach-to-trello-card-action](https://github.com/delivered/attach-to-trello-card-action).

# Trello integration action

Connects GitHub PRs and Trello cards:

-   attaches PR link to a Trello card ([works best with GitHub Power-up](https://trello.com/power-ups/55a5d916446f517774210004/github)),
-   moves Trello card when PR is opened or closed,
-   adds an appropriate board label to a Trello card when branch name is categorised (e.g. `feature/foo`) and Trello card already doesn't have a label,
-   exclusively assigns PR owner and fellow assignees to the Trello card when they own same usernames in Github and Trello.

The action looks for Trello card URL within the PR description and comments. If found, it will integrate the two worlds.

```yaml
name: Trello integration
on:
    pull_request:
        types: [opened, edited, closed]
    issue_comment:
        types: [created, edited]
jobs:
    build:
        runs-on: ubuntu-latest
        steps:
            - uses: rematocorp/trello-integration-action@v5
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
                  trello-api-key: ${{ secrets.TRELLO_API_KEY }} # https://trello.com/app-key
                  trello-auth-token: ${{ secrets.TRELLO_AUTH_TOKEN }} # https://trello.com/app-key then click generate a token
                  trello-list-id-pr-open: ${{ secrets.TRELLO_PR_OPEN_LIST_ID }} # Trello list ID for open pull request, visit a board then append .json to url to find id
                  trello-list-id-pr-closed: ${{ secrets.TRELLO_PR_CLOSED_LIST_ID }} # Trello list ID for closed pull request, visit a board then append .json to url to find id
```

Inspired by [dalezak/github-commit-to-trello-card](https://github.com/dalezak/github-commit-to-trello-card) and [delivered/attach-to-trello-card-action](https://github.com/delivered/attach-to-trello-card-action).

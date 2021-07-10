# Trello integration action

The action looks for Trello card URL within the Pull Request description. If found, it will add the Pull Reuqest URL as an attachment to the Trello card. Once PR is opened or closed, it will also move the card to a correct list.

```
name: Trello integration
on: [push, pull_request]
jobs:
build:
runs-on: ubuntu-latest
    steps:
      - uses: rematocorp/github-commit-to-trello-card@main
        with:
          trello-api-key: ${{ secrets.TRELLO_API_KEY }}
          trello-auth-token: ${{ secrets.TRELLO_API_TOKEN }}
          trello-board-id: ${{ secrets.TRELLO_BOARD }}
          trello-list-name-pr-open: "In Review"
          trello-list-name-pr-closed: "Done"
```

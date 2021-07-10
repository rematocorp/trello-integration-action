# Trello integration action

The action looks for Trello card URL within the Pull Request description. If found, it will add the Pull Request URL as an attachment to the Trello card. Once PR is opened or closed, it will also move the card to a correct list.

```
name: Trello integration
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: rematocorp/trello-integration-action@main
        with:
          trello-api-key: ${{ secrets.TRELLO_API_KEY }}
          trello-auth-token: ${{ secrets.TRELLO_API_TOKEN }}
          trello-board-id: ${{ secrets.TRELLO_BOARD }}
          trello-list-name-pr-open: "In Review"
          trello-list-name-pr-closed: "Done"
```

Inspired by https://github.com/dalezak/github-commit-to-trello-card and https://github.com/delivered/attach-to-trello-card-action

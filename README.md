# conventional-version-bump-check

A github action to check that the current version of your app matches the version bump required by conventional commit. 

## Requirements

You must use the conventional commits message format for you commit log.

You must already have an existing first tag.

Since the actions needs the list of tags, you need to instruct the checkout action to fetch all the history, using the
following parameter:

```
- uses: actions/checkout@v2
  with:
    fetch-depth: 0
```

By default, Github action checkout doesn't fetch the whole history.

Here is a complete example for a nodejs application:
```
  - uses: actions/checkout@v2
    with:
      fetch-depth: 0
  - name: Read package.json
    uses: tyankatsu0105/read-package-version-actions@v1
    id: package-version
  - name: Validate semantic versionning
    uses: matdurand/conventional-version-bump-check@v1
    with:
      current-version: ${{ steps.package-version.outputs.version }}
```

## Inputs

****

### `current-version`
**Required** The current application version. You should read your package.json, pom.xml, or whatever you use to track your version.

### `verbose`
**Optional** Output additional information about the validation process. (default: true)

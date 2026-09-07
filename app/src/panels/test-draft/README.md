# Temporary test draft mode

The Test draft mode tab renders the actual BoardPanel: recommendations, 5,000-run forecasts, player board, roster, practice controls and the same Sleeper polling code. Its endpoint is fixed to https://sleeper.app/draft/nfl/1402785901897109504.

Entering or leaving this tab reloads the page. The query parameter selects the context before simulation modules load. All test storage keys use `fd26-test-1402785901897109504:`; production keys stay unchanged. This isolates picks, seat, practice backups, player blocks, intel pins and opponent tendencies.

Polling matches the real draft room: 10 seconds after picks, 60 seconds while empty, 30 seconds after an error. Empty snapshots retain existing local marks, matching production behavior.

Run `node src/panels/test-draft/context.test.mjs` from app/ to check isolation and navigation.

To remove: delete this folder, remove the test tab/context wiring in App.tsx, restore plain storage keys in lib/store.ts, lib/intel.ts and lib/tendency.ts, remove the optional fixedSleeperUrl prop from BoardPanel.tsx, then rebuild. Test-prefixed browser keys may be deleted independently of real draft data.

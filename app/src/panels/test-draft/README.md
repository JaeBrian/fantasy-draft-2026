# Disposable Test draft mode

Hard-coded test draft: `1402785901897109504` (12-team snake, 16 rounds).

This folder owns the test panel, styles, poller and poller tests. The real Draft room is unchanged. This harness imports the existing snapshot parser and pure roster helpers without changing them. It does not call the advisor or read saved draft assumptions. Its only persisted value is the selected seat under `fd26-test-1402785901897109504-seat`. Synced picks live only in component memory. Leaving the tab cancels its polling. There are no writes to Sleeper.

The test poller runs every 3 seconds after responses, including an empty board. Errors retry after 5 seconds; requests time out after 10 seconds. Complete snapshots replace prior picks, including commissioner resets to zero. Invalid snapshots retain the last valid board and show an error. These polling changes apply only to this harness; the real Draft room still uses its existing 10/60/30-second intervals.

Run the isolated test from `app/`:

```sh
node src/panels/test-draft/sleeper-sync.test.mjs
```

To remove: delete this folder, remove its import, navigation entry and render line from `src/App.tsx`, then run `npm run build` to regenerate the root artifact. The unused seat key can be left in storage or removed.

Live rehearsal: choose your actual test seat; make your and opponents' picks in Sleeper; check ownership, totals and roster updates. Test several rapid picks, K/DST, refresh, reconnect, commissioner undo and reset. Automated poller checks use mocked network responses; a live rehearsal remains separate evidence.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchPlayerNews } from './news-source.mjs';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('retries throttling and a timeout before accepting news', async () => {
  let calls = 0;
  const delays = [], items = [{ published: 1788890000000, metadata: { title: 'IR update' } }];
  const result = await fetchPlayerNews('pacheco', {
    wait: async ms => { delays.push(ms); },
    fetcher: async () => {
      if (++calls === 1) return new Response('', { status: 429, headers: { 'retry-after': '2' } });
      if (calls === 2) throw new Error('timeout');
      return Response.json(items);
    },
  });
  assert.deepEqual(result, items);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [2000, 1000]);
});

test('rejects a failed or malformed feed instead of calling it empty news', async () => {
  for (const response of [new Response('', { status: 503 }), Response.json({ error: 'busy' })]) {
    let calls = 0;
    await assert.rejects(fetchPlayerNews('pacheco', {
      wait: async () => {},
      fetcher: async () => { calls++; return response.clone(); },
    }));
    assert.equal(calls, 3);
  }
  assert.deepEqual(await fetchPlayerNews('no-news', { fetcher: async () => Response.json([]) }), []);
});

test('stops on a long server cooldown without issuing an early retry', async () => {
  let calls = 0;
  await assert.rejects(fetchPlayerNews('pacheco', {
    wait: async () => { assert.fail('must not retry before the server cooldown'); },
    fetcher: async () => { calls++; return new Response('', { status: 429, headers: { 'retry-after': '60' } }); },
  }), /longer cooldown/);
  assert.equal(calls, 1);
});

test('collector preserves published news when requests or player lookup fail', () => {
  const root = mkdtempSync(join(tmpdir(), 'draft-news-test-'));
  try {
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'src'));
    for (const name of ['fetch-news.mjs', 'news-source.mjs', 'player-name.mjs'])
      copyFileSync(new URL(name, import.meta.url), join(root, 'scripts', name));
    writeFileSync(join(root, 'src/data.ts'), '["Isiah Pacheco", "RB"]\n');
    for (const mode of ['failed-news', 'empty-catalog', 'failed-catalog']) {
      writeFileSync(join(root, 'src/news.ts'), 'previous IR report');
      writeFileSync(join(root, 'mock.mjs'), `
        globalThis.fetch = async url => url.endsWith('/v1/players/nfl')
          ? Response.json(${mode === 'empty-catalog' ? '{}' : JSON.stringify({ 9509: { full_name: 'Isiah Pacheco', position: 'RB' } })}, {status:${mode === 'failed-catalog' ? 503 : 200}})
          : new Response('', {status:503});
      `);
      const result = spawnSync(process.execPath, ['--import', join(root, 'mock.mjs'), join(root, 'scripts/fetch-news.mjs')], { encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /keeping the previous/);
      assert.equal(readFileSync(join(root, 'src/news.ts'), 'utf8'), 'previous IR report');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

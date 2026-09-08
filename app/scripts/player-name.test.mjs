import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skillPosition, skillDepthOrder } from './player-name.mjs';

test('collects offensive eligibility when Sleeper lists defense first', () => {
  const hunter = { position: 'DB', fantasy_positions: ['DB', 'WR'], depth_chart_position: 'SWR', depth_chart_order: 4 };
  assert.equal(skillPosition(hunter), 'WR');
  assert.equal(skillDepthOrder(hunter), 4);
  assert.equal(skillDepthOrder({ ...hunter, depth_chart_position: 'CB' }), undefined);
});

test('keeps ordinary skill players and excludes defensive namesakes', () => {
  assert.equal(skillPosition({ position: 'WR', full_name: 'Justin Jefferson' }), 'WR');
  assert.equal(skillPosition({ position: 'LB', full_name: 'Justin Jefferson', fantasy_positions: ['LB'] }), undefined);
  assert.equal(skillPosition({ position: 'RB', fantasy_positions: ['WR', 'RB'] }), 'RB');
  assert.equal(skillDepthOrder({ position: 'RB', depth_chart_order: 2 }), 2);
  assert.equal(skillDepthOrder({ position: 'RB' }), undefined);
  assert.equal(skillPosition(null), undefined);
});

import type { DraftState, Mark } from './advisor';

export function parseDraftState(raw: string): DraftState {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, mark]) => mark === 'mine' || mark === 'gone'));
  } catch { return {}; }
}

export function parseNames(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter((n): n is string => typeof n === 'string' && n.length > 0))] : [];
  } catch { return []; }
}

export function parseDraftOrder(raw: string, state: DraftState): string[] {
  const order = parseNames(raw).filter(name => Object.hasOwn(state, name));
  Object.keys(state).forEach(name => { if (!order.includes(name)) order.push(name); });
  return order;
}

export function markDraft(state: DraftState, order: string[], name: string, mark: Mark | '', restoreIndex = -1) {
  const next = { ...state };
  if (mark) {
    if (!next[name]) {
      order = order.slice();
      order.splice(restoreIndex < 0 ? order.length : restoreIndex, 0, name);
    }
    next[name] = mark;
  } else {
    delete next[name];
    order = order.filter(n => n !== name);
  }
  return { DS: next, ord: order };
}

// Preserve board display names while joining provider aliases to one player.
export const playerNameKey = s => s.toLowerCase().replace(/[.'-]/g, ' ')
  .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim()
  .replace(/^kenneth gainwell$/, 'kenny gainwell');

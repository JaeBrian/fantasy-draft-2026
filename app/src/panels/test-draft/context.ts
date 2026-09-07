// A page reload isolates module-level simulation settings as well as saved state.
export const TEST_DRAFT_ID = "1402814176023322624";
export const TEST_DRAFT_URL = `https://sleeper.app/draft/nfl/${TEST_DRAFT_ID}`;
export const IS_TEST_DRAFT = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("test-draft") === TEST_DRAFT_ID;

export function draftStorageKey(key: string): string {
  return IS_TEST_DRAFT ? `fd26-test-${TEST_DRAFT_ID}:${key}` : key;
}

export function switchDraftContext(tab: string): boolean {
  if ((tab === "test-draft") === IS_TEST_DRAFT) return false;
  const url = new URL(window.location.href);
  if (tab === "test-draft") url.searchParams.set("test-draft", TEST_DRAFT_ID);
  else url.searchParams.delete("test-draft");
  url.hash = tab;
  window.location.assign(url.href);
  return true;
}

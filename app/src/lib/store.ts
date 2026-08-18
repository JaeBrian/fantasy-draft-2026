import { useEffect, useState } from "react";

function read<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

export function usePersistent<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T,
  serialize: (v: T) => string
) {
  const [value, setValue] = useState<T>(() => read(key, fallback, parse));
  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(value));
    } catch {
      /* storage unavailable — state still works for the session */
    }
  }, [key, value, serialize]);
  return [value, setValue] as const;
}

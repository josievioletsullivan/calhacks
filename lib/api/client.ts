/**
 * Thin fetch wrapper for the 511 SF Bay Open Data API.
 * Docs: https://511.org/open-data/transit
 *
 * The key is read from EXPO_PUBLIC_511_API_KEY (see .env.example). Expo inlines
 * EXPO_PUBLIC_* variables at build time, so the key ships in the app bundle —
 * acceptable for a hackathon, but rotate it before any public release.
 */

const BASE_URL = 'https://api.511.org/transit';
export const CALTRAIN_AGENCY = 'CT';

export class Api511Error extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'Api511Error';
  }
}

export function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_511_API_KEY;
  if (!key) {
    throw new Api511Error('EXPO_PUBLIC_511_API_KEY is not set. Copy .env.example to .env and add your 511 key.');
  }
  return key;
}

export async function fetch511<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ api_key: getApiKey(), format: 'json', ...params });
  const response = await fetch(`${BASE_URL}/${path}?${query}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const hint = response.status === 429 ? ' (rate limited — 511 allows 60 requests/hour per key)' : '';
    throw new Api511Error(`511 ${path} failed: HTTP ${response.status}${hint}`, response.status);
  }
  // 511 prefixes JSON with a UTF-8 BOM, which JSON.parse rejects.
  const text = (await response.text()).replace(/^﻿/, '');
  return JSON.parse(text) as T;
}

import type { NoblemanItem } from '@commons/shared';

/**
 * An outside source of articles to talk about (the Nobleman, later others).
 * An adapter only ever returns a headline and a link. It never scrapes pages.
 */
export interface SourceAdapter {
  readonly name: string;
  fetchLatest(limit: number): Promise<NoblemanItem[]>;
}

/**
 * A stand-in until the real Nobleman feed (RSS or API) is connected.
 * Every item is marked `sample: true`, and the app labels them as samples.
 *
 * To connect the real feed: write a class that implements SourceAdapter,
 * fetch the feed URL from configuration (never from user input), map each
 * entry to { title, url, minutes, sample: false }, and return it from
 * `noblemanSource()` below.
 */
export class StubNoblemanAdapter implements SourceAdapter {
  readonly name = 'nobleman-stub';

  async fetchLatest(limit: number): Promise<NoblemanItem[]> {
    const items: NoblemanItem[] = [
      { title: 'Lacrosse opens the season with a one-goal win', url: '', minutes: 4, sample: true },
      { title: 'Inside the new student-run film festival', url: '', minutes: 6, sample: true },
      { title: 'Club fair moves to the Gleason lobby', url: '', minutes: 3, sample: true },
    ];
    return items.slice(0, limit);
  }
}

/** Domains that count as "From the Nobleman" for link posts. Empty until the real address is confirmed. */
export const NOBLEMAN_DOMAINS: string[] = [];

export function noblemanSource(): SourceAdapter {
  return new StubNoblemanAdapter();
}

import type { NoblemanItem } from '@commons/shared';

/** An outside source of articles. Returns headlines and links only, and never scrapes pages. */
export interface SourceAdapter {
  readonly name: string;
  fetchLatest(limit: number): Promise<NoblemanItem[]>;
}

/**
 * Nothing is connected yet, so this returns no headlines and the sidebar and
 * the Gleason TV leave the Nobleman section out.
 *
 * To connect the real feed: implement SourceAdapter, read the feed URL from
 * configuration (never from user input), map each entry to { title, url },
 * and return the new adapter from `noblemanSource()`.
 */
class NotConnectedAdapter implements SourceAdapter {
  readonly name = 'nobleman-not-connected';

  async fetchLatest(): Promise<NoblemanItem[]> {
    return [];
  }
}

export function noblemanSource(): SourceAdapter {
  return new NotConnectedAdapter();
}

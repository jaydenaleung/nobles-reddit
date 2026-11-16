export type ParsedContentKey =
  | { kind: 'post'; postId: string; commentId?: undefined }
  | { kind: 'comment'; postId: string; commentId: string };

export function postKey(postId: string): string {
  return `post:${postId}`;
}
export function commentKey(postId: string, commentId: string): string {
  return `comment:${postId}:${commentId}`;
}

const ID = '[A-Za-z0-9_-]{1,64}';
const POST_RE = new RegExp(`^post:(${ID})$`);
const COMMENT_RE = new RegExp(`^comment:(${ID}):(${ID})$`);

export function parseContentKey(key: string): ParsedContentKey | null {
  const post = POST_RE.exec(key);
  if (post) return { kind: 'post', postId: post[1]! };
  const comment = COMMENT_RE.exec(key);
  if (comment) return { kind: 'comment', postId: comment[1]!, commentId: comment[2]! };
  return null;
}

/** The Firestore path of the content a key points at. */
export function contentPath(key: ParsedContentKey): string {
  return key.kind === 'post' ? `posts/${key.postId}` : `posts/${key.postId}/comments/${key.commentId}`;
}

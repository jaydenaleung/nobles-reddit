import {
  LIMITS,
  type ContentStatusResult,
  type IdentityMode,
  type WellbeingResources,
} from '@commons/shared';
import { useId, useState, type FormEvent } from 'react';
import { api, errorMessage, waitForOutcome } from '../api';
import { useMember } from '../auth/AuthContext';
import { IdentityToggle } from './Identity';
import { Count } from './Ui';

export function WellbeingPanel({ resources }: { resources: WellbeingResources }) {
  return (
    <div className="notice" role="status">
      <div>
        <p style={{ margin: 0 }}>{resources.message}</p>
        <ul className="plain-list">
          {resources.items.map((item) => (
            <li key={item.label}>
              <b>{item.label}.</b> {item.detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function HeldNotice() {
  return (
    <div className="notice" role="status">
      <div>
        A mod has to look at this before it goes up. Only you can see it for now. Usually that’s the same day.
      </div>
    </div>
  );
}

export interface PendingComment {
  key: string;
  parentId: string | null;
  body: string;
  mode: IdentityMode;
}

export function ReplyComposer({
  postId,
  parentId,
  onSent,
  onPending,
  onSettled,
  onCancel,
  autoFocus = false,
}: {
  postId: string;
  parentId: string | null;
  onSent?: (outcome: ContentStatusResult, commentId: string) => void;
  onPending?: (pending: PendingComment) => void;
  onSettled?: (key: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const member = useMember();
  const id = useId();
  const [mode, setMode] = useState<IdentityMode | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needMode, setNeedMode] = useState(false);
  const [outcome, setOutcome] = useState<ContentStatusResult | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!mode) {
      setNeedMode(true);
      return;
    }
    const text = body.trim();
    if (!text) {
      setError('Write something first.');
      return;
    }
    if (text.length > LIMITS.commentMax) {
      setError(`Replies can be ${LIMITS.commentMax} characters at most.`);
      return;
    }
    const pendingKey = `pending-${Date.now()}`;
    setBusy(true);
    onPending?.({ key: pendingKey, parentId, body: text, mode });
    try {
      const created = await api.createComment({ postId, parentId, identityMode: mode, body: text });
      setBody('');
      setMode(null);
      const result = await waitForOutcome(created.contentKey);
      if (result.outcome === 'held' || result.outcome === 'wellbeing') setOutcome(result);
      onSent?.(result, created.commentId ?? '');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      onSettled?.(pendingKey);
      setBusy(false);
    }
  };

  return (
    <form className="reply-form" onSubmit={(event) => void submit(event)} noValidate>
      <IdentityToggle
        value={mode}
        onChange={(next) => {
          setMode(next);
          setNeedMode(false);
        }}
        firstName={member.profile.firstName}
        displayName={member.profile.displayName}
        label="Reply as"
        invalid={needMode}
      />
      <div className="field">
        <label className="label" htmlFor={`${id}-body`}>
          {parentId ? 'Your reply' : 'Reply'}
        </label>
        <textarea
          className="textarea"
          id={`${id}-body`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          autoFocus={autoFocus}
          rows={3}
        />
      </div>
      {error && (
        <p className="err" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      <div className="reply-form__row">
        <Count value={body.trim().length} max={LIMITS.commentMax} />
        <div className="row">
          {onCancel && (
            <button className="btn btn--quiet" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Posting' : 'Post'}
          </button>
        </div>
      </div>
      {outcome?.outcome === 'held' && <HeldNotice />}
      {outcome?.outcome === 'wellbeing' && outcome.resources && (
        <WellbeingPanel resources={outcome.resources} />
      )}
    </form>
  );
}

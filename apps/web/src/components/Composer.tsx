import {
  LIMITS,
  isStaffRole,
  type ContentStatusResult,
  type IdentityMode,
  type WellbeingResources,
} from '@commons/shared';
import { useId, useState, type FormEvent } from 'react';
import { api, errorMessage, waitForOutcome } from '../api';
import { useMember } from '../auth/AuthContext';
import { Icon } from './Icon';
import { IdentityToggle } from './Identity';
import { Count } from './Ui';

/** Shown to an author whose post raised a wellbeing flag. Caring, plain, and never a telling-off. */
export function WellbeingPanel({ resources }: { resources: WellbeingResources }) {
  return (
    <div className="nb-notice nb-notice--kind" role="status">
      <Icon name="check" />
      <div>
        {resources.message}
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
    <div className="nb-notice" role="status">
      <div>
        <b>A mod has to check this first.</b> It’s saved, and nobody else can see it until then.
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

/**
 * The reply box. It asks "Reply as" every time, with nothing preselected, and
 * shows the notice about what the administration can see every time.
 */
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
  /** Called with the outcome once the screening check has finished. */
  onSent?: (outcome: ContentStatusResult, commentId: string) => void;
  /** Optimistic UI: show the comment at once... */
  onPending?: (pending: PendingComment) => void;
  /** ...and take the optimistic copy away when it is published, held or failed. */
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
      setError(`Comments can be up to ${LIMITS.commentMax} characters.`);
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
      // Roll back: the optimistic comment goes away and the words stay in the box.
      setError(errorMessage(err));
    } finally {
      onSettled?.(pendingKey);
      setBusy(false);
    }
  };

  return (
    <form className="reply" onSubmit={(event) => void submit(event)} noValidate>
      <IdentityToggle
        value={mode}
        onChange={(next) => {
          setMode(next);
          setNeedMode(false);
        }}
        firstName={member.profile.firstName}
        displayName={member.profile.displayName}
        staff={isStaffRole(member.role)}
        label="Reply as"
        invalid={needMode}
      />
      <div className="field">
        <label className="nb-label" htmlFor={`${id}-body`}>
          {parentId ? 'Your reply' : 'Add a comment'}
        </label>
        <textarea
          className="nb-textarea"
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
      <div className="reply__row">
        <Count value={body.trim().length} max={LIMITS.commentMax} />
        <div className="row">
          {onCancel && (
            <button className="nb-btn nb-btn--quiet" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="nb-btn nb-btn--primary" type="submit" disabled={busy}>
            {busy ? 'Posting' : parentId ? 'Post reply' : 'Post comment'}
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

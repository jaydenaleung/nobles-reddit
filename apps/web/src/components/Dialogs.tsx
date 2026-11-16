import {
  LIMITS,
  REPORT_REASONS,
  type ModAction,
  type ReportReason,
  type RevealAuthorResult,
} from '@commons/shared';
import { useId, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api';
import { Icon } from './Icon';
import { Dialog, useToast } from './Ui';

/** "Report": anyone can ask a moderator to look at something. */
export function ReportDialog({ contentKey, onClose }: { contentKey: string | null; onClose: () => void }) {
  const toast = useToast();
  const id = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason(null);
    setNote('');
    setError(null);
    onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!contentKey) return;
    if (!reason) {
      setError('Choose what is wrong first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.reportContent({ contentKey, reason, note: note.trim() || undefined });
      toast('Thank you. A moderator will take a look.');
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!contentKey} onClose={close} title="Report this to a moderator">
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <fieldset className="radio-list">
          <legend>What is wrong with it?</legend>
          {REPORT_REASONS.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name={`${id}-reason`}
                checked={reason === option.id}
                onChange={() => setReason(option.id)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label className="nb-label" htmlFor={`${id}-note`}>
            Anything a moderator should know (optional)
          </label>
          <textarea
            className="nb-textarea"
            id={`${id}-note`}
            value={note}
            maxLength={LIMITS.reportNoteMax}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
          />
        </div>
        <p className="nb-help">
          Moderators see your report, not your name. If someone is in danger right now, tell an adult at
          school or call 911.
        </p>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="row row--between">
          <button className="nb-btn nb-btn--quiet" type="button" onClick={close}>
            Cancel
          </button>
          <button className="nb-btn nb-btn--primary" type="submit" disabled={busy}>
            {busy ? 'Sending' : 'Send report'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const MOD_LABELS: Record<ModAction, string> = {
  hold: 'Hold for review (hide it for now)',
  remove: 'Remove',
  restore: 'Restore (make it visible)',
  pin: 'Pin to the top of its space',
  unpin: 'Unpin',
  approveForBoard: 'Show on the hall screen',
  removeFromBoard: 'Take off the hall screen',
};

export interface ModTarget {
  contentKey: string;
  kind: 'post' | 'comment';
  status: string;
  pinned?: boolean;
  onBoard?: boolean;
}

/** What a moderator can do with a post or comment. It never shows who wrote it. */
export function ModDialog({
  target,
  onClose,
  onDone,
}: {
  target: ModTarget | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const id = useId();
  const [action, setAction] = useState<ModAction | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: ModAction[] = !target
    ? []
    : [
        ...(target.status === 'visible' ? (['hold', 'remove'] as ModAction[]) : (['restore'] as ModAction[])),
        ...(target.status === 'held' ? (['remove'] as ModAction[]) : []),
        ...(target.kind === 'post' && target.status === 'visible'
          ? ([target.pinned ? 'unpin' : 'pin'] as ModAction[])
          : []),
        ...(target.status === 'visible'
          ? ([target.onBoard ? 'removeFromBoard' : 'approveForBoard'] as ModAction[])
          : []),
      ];

  const close = () => {
    setAction(null);
    setNote('');
    setError(null);
    onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    if (!action) {
      setError('Choose what to do first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.modAction({ contentKey: target.contentKey, action, note: note.trim() });
      toast('Done. It has been written to the audit log.');
      onDone?.();
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!target}
      onClose={close}
      title={target?.kind === 'post' ? 'Moderate this thread' : 'Moderate this comment'}
    >
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <fieldset className="radio-list">
          <legend>What should happen?</legend>
          {options.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name={`${id}-action`}
                checked={action === option}
                onChange={() => setAction(option)}
              />
              {MOD_LABELS[option]}
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label className="nb-label" htmlFor={`${id}-note`}>
            Note for the audit log
          </label>
          <input
            className="nb-input"
            id={`${id}-note`}
            value={note}
            maxLength={LIMITS.reasonMax}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <p className="nb-help">
          Moderators cannot see who wrote something. If you need to know, ask an administrator; their lookup
          is logged.
        </p>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="row row--between">
          <button className="nb-btn nb-btn--quiet" type="button" onClick={close}>
            Cancel
          </button>
          <button className="nb-btn nb-btn--primary" type="submit" disabled={busy}>
            {busy ? 'Working' : 'Confirm'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * "Who wrote this?" For administrators only. A reason is required, and the
 * page says plainly that the lookup was logged.
 */
export function RevealForm({ contentKey, onClose }: { contentKey: string; onClose?: () => void }) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RevealAuthorResult | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < LIMITS.revealReasonMin) {
      setError(`Give a reason of at least ${LIMITS.revealReasonMin} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await api.revealAuthor({ contentKey, reason: reason.trim() }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="stack">
        <dl className="kv">
          <dt>Name</dt>
          <dd>{result.author.displayName}</dd>
          <dt>Email</dt>
          <dd>{result.author.email}</dd>
          <dt>Class year</dt>
          <dd>{result.author.classYear ?? 'None'}</dd>
          <dt>Role</dt>
          <dd>{result.author.role}</dd>
          {result.author.accountDeleted && (
            <>
              <dt>Account</dt>
              <dd>Deleted by its owner</dd>
            </>
          )}
        </dl>
        <div className="nb-notice nb-notice--staff" role="status">
          <Icon name="shield" />
          <div>
            <b>This view was logged.</b> Your name, the time and your reason are in the audit log.
          </div>
        </div>
        {onClose && (
          <div className="row">
            <button className="nb-btn" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <p className="muted">
        Looking up an author is for safety and serious rule-breaking. Every lookup is recorded with your name
        and your reason.
      </p>
      <div className="field">
        <label className="nb-label" htmlFor={`${id}-reason`}>
          Why do you need to know? (required)
        </label>
        <textarea
          className="nb-textarea"
          id={`${id}-reason`}
          value={reason}
          maxLength={LIMITS.reasonMax}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={!!error || undefined}
          rows={2}
        />
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <div className="row row--between">
        {onClose && (
          <button className="nb-btn nb-btn--quiet" type="button" onClick={onClose}>
            Cancel
          </button>
        )}
        <button className="nb-btn nb-btn--primary" type="submit" disabled={busy}>
          {busy ? 'Looking up' : 'Show the author and log it'}
        </button>
      </div>
    </form>
  );
}

export function RevealDialog({ contentKey, onClose }: { contentKey: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!contentKey} onClose={onClose} title="Who wrote this?">
      {contentKey && <RevealForm key={contentKey} contentKey={contentKey} onClose={onClose} />}
    </Dialog>
  );
}

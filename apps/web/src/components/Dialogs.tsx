import {
  LIMITS,
  REPORT_REASONS,
  type ModAction,
  type ReportReason,
  type RevealAuthorResult,
} from '@commons/shared';
import { useId, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api';
import { Dialog, useToast } from './Ui';

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
      setError('Pick a reason.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.reportContent({ contentKey, reason, note: note.trim() || undefined });
      toast('Sent. A mod will look at it.');
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!contentKey} onClose={close} title="Report">
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <fieldset className="radio-list">
          <legend>What’s wrong with it?</legend>
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
          <label className="label" htmlFor={`${id}-note`}>
            Anything else a mod should know (optional)
          </label>
          <textarea
            className="textarea"
            id={`${id}-note`}
            value={note}
            maxLength={LIMITS.reportNoteMax}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
          />
        </div>
        <p className="help">
          Mods see the report but not your name. If someone is in danger right now, find an adult or call 911.
        </p>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="row row--between">
          <button className="btn btn--quiet" type="button" onClick={close}>
            Cancel
          </button>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Sending' : 'Send'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const MOD_LABELS: Record<ModAction, string> = {
  hold: 'Hide it for now',
  remove: 'Remove',
  restore: 'Put it back',
  pin: 'Pin to the top',
  unpin: 'Unpin',
  approveForBoard: 'Put it on the Gleason TV',
  removeFromBoard: 'Take it off the Gleason TV',
};

export interface ModTarget {
  contentKey: string;
  kind: 'post' | 'comment';
  status: string;
  pinned?: boolean;
  onBoard?: boolean;
}

/** Mods never see who wrote what, and nothing here shows it. */
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

  const options: ModAction[] = [];
  if (target) {
    if (target.status === 'visible') options.push('hold', 'remove');
    else options.push('restore');
    if (target.status === 'held') options.push('remove');
    if (target.kind === 'post' && target.status === 'visible') options.push(target.pinned ? 'unpin' : 'pin');
    if (target.status === 'visible') options.push(target.onBoard ? 'removeFromBoard' : 'approveForBoard');
  }

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
      setError('Pick what to do.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.modAction({ contentKey: target.contentKey, action, note: note.trim() });
      toast('Done. It’s in the log.');
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
      title={target?.kind === 'post' ? 'Moderate post' : 'Moderate reply'}
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
          <label className="label" htmlFor={`${id}-note`}>
            Note for the log
          </label>
          <input
            className="input"
            id={`${id}-note`}
            value={note}
            maxLength={LIMITS.reasonMax}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <p className="help">You can’t see who wrote this. If you need to know, ask an admin.</p>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="row row--between">
          <button className="btn btn--quiet" type="button" onClick={close}>
            Cancel
          </button>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Saving' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Admins only. A reason is required and every lookup goes in the log. */
export function RevealForm({ contentKey, onClose }: { contentKey: string; onClose?: () => void }) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RevealAuthorResult | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < LIMITS.revealReasonMin) {
      setError(`Write at least ${LIMITS.revealReasonMin} characters.`);
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
          <dt>Class of</dt>
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
        <p className="notice" role="status">
          This lookup is in the log, along with your reason.
        </p>
        {onClose && (
          <div className="row">
            <button className="btn" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <p className="muted" style={{ margin: 0 }}>
        Only for safety or serious rule breaking. Your name and reason go in the log.
      </p>
      <div className="field">
        <label className="label" htmlFor={`${id}-reason`}>
          Why do you need to know?
        </label>
        <textarea
          className="textarea"
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
          <button className="btn btn--quiet" type="button" onClick={onClose}>
            Cancel
          </button>
        )}
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Looking up' : 'Show who wrote it'}
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

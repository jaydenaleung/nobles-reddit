import {
  APP_NAME,
  LIMITS,
  createPostSchema,
  type ContentStatusResult,
  type CreatePostInput,
  type IdentityMode,
} from '@commons/shared';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage, waitForOutcome } from '../api';
import { useMember } from '../auth/AuthContext';
import { HeldNotice, WellbeingPanel } from '../components/Composer';
import { Icon } from '../components/Icon';
import { IdentityToggle } from '../components/Identity';
import { Page } from '../components/Layout';
import { Count } from '../components/Ui';
import { useMine, useSpaces } from '../data/hooks';
import { clearDraft, loadDraft, saveDraft, type Draft } from '../lib/storage';

type Kind = Draft['kind'];
const KIND_LABELS: Record<Kind, string> = { text: 'Text', link: 'Link', poll: 'Poll' };

export default function NewPost() {
  const member = useMember();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { spaces, bySlug } = useSpaces();
  const mine = useMine();
  const id = useId();
  const draft = useRef(loadDraft()).current;

  const [kind, setKind] = useState<Kind>(draft?.kind ?? 'text');
  const [spaceId, setSpaceId] = useState(draft?.spaceId ?? '');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [url, setUrl] = useState(draft?.url ?? '');
  const [options, setOptions] = useState<string[]>(draft?.options?.length ? draft.options : ['', '']);
  // Never preselected, and never restored from a draft: you choose each time.
  const [mode, setMode] = useState<IdentityMode | null>(null);
  const [needMode, setNeedMode] = useState(false);
  const [busy, setBusy] = useState<'idle' | 'sending' | 'checking'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ContentStatusResult | null>(null);

  useEffect(() => {
    document.title = `New post | ${APP_NAME}`;
  }, []);

  // Preselect the space from ?space=slug, or the first one the person can post in.
  const allowed = spaces.filter((s) => s.postingRoles.includes(member.role));
  useEffect(() => {
    if (spaceId && allowed.some((s) => s.id === spaceId)) return;
    const wanted = bySlug(params.get('space') ?? '');
    if (wanted && allowed.some((s) => s.id === wanted.id)) setSpaceId(wanted.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces]);

  // The draft is kept on this device only. Nothing is sent until you press Post.
  useEffect(() => {
    if (outcome) return;
    saveDraft({ kind, spaceId, title, body, url, options });
  }, [kind, spaceId, title, body, url, options, outcome]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!mode) {
      setNeedMode(true);
      setError('Pick your name or Anonymous.');
      return;
    }
    if (!spaceId) {
      setError('Pick a space.');
      return;
    }
    const base = { spaceId, identityMode: mode, title };
    const input: CreatePostInput =
      kind === 'text'
        ? { ...base, kind, body }
        : kind === 'link'
          ? { ...base, kind, body, url }
          : { ...base, kind, body, options: options.map((o) => o.trim()).filter(Boolean) };
    // The same checks the server runs, so mistakes are caught before anything is sent.
    const checked = createPostSchema.safeParse(input);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? 'Something in the form isn’t right.');
      return;
    }
    setBusy('sending');
    try {
      const created = await api.createPost(input);
      clearDraft();
      setBusy('checking');
      const result = await waitForOutcome(created.contentKey);
      mine.refresh();
      if (result.outcome === 'visible') {
        navigate(`/t/${created.postId}`);
        return;
      }
      setOutcome(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('idle');
    }
  };

  if (outcome) {
    return (
      <Page>
        <div className="page">
          <h1 className="page-h">{outcome.outcome === 'wellbeing' ? 'Thanks for writing this' : 'Saved'}</h1>
          {outcome.outcome === 'wellbeing' && outcome.resources ? (
            <WellbeingPanel resources={outcome.resources} />
          ) : outcome.outcome === 'held' ? (
            <HeldNotice />
          ) : (
            <p className="notice" role="status">
              Still being checked. It shows up in the feed in a minute, and it’s under You.
            </p>
          )}
          <div className="row">
            <Link className="btn btn--primary" to="/">
              Back to the feed
            </Link>
            <Link className="btn" to="/me">
              Your posts
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <form className="composer" onSubmit={(event) => void submit(event)} noValidate>
        <div className="row row--between">
          <h1 className="page-h">New post</h1>
          <Link className="btn btn--quiet btn--sm" to="/">
            Cancel
          </Link>
        </div>

        <IdentityToggle
          value={mode}
          onChange={(next) => {
            setMode(next);
            setNeedMode(false);
          }}
          firstName={member.profile.firstName}
          displayName={member.profile.displayName}
          invalid={needMode}
        />

        <div className="field" style={{ maxWidth: 360 }}>
          <label className="label" htmlFor={`${id}-space`}>
            Space
          </label>
          <select
            className="select"
            id={`${id}-space`}
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
          >
            <option value="">Pick a space</option>
            {allowed.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </div>

        <div className="tabs" role="tablist" aria-label="Post type">
          {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="field">
          <div className="row row--between">
            <label className="label" htmlFor={`${id}-title`}>
              {kind === 'poll' ? 'Question' : 'Title'}
            </label>
            <Count value={title.trim().length} max={LIMITS.titleMax} />
          </div>
          <input
            className="input"
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {kind === 'link' && (
          <div className="field">
            <label className="label" htmlFor={`${id}-url`}>
              Link
            </label>
            <input
              className="input"
              id={`${id}-url`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="help">
              Links must start with https://. We show the link; we never open it for you.
            </p>
          </div>
        )}

        {kind === 'poll' && (
          <fieldset className="opts">
            <legend className="label">Options (2 to {LIMITS.pollMaxOptions})</legend>
            {options.map((option, i) => (
              <div className="opts__row" key={i}>
                <input
                  className="input"
                  aria-label={`Option ${i + 1}`}
                  value={option}
                  maxLength={LIMITS.pollOptionMax}
                  onChange={(e) =>
                    setOptions((current) => current.map((o, j) => (j === i ? e.target.value : o)))
                  }
                />
                {options.length > LIMITS.pollMinOptions && (
                  <button
                    className="btn btn--quiet btn--sm"
                    type="button"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => setOptions((current) => current.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {options.length < LIMITS.pollMaxOptions && (
              <div>
                <button
                  className="btn btn--sm"
                  type="button"
                  onClick={() => setOptions((current) => [...current, ''])}
                >
                  <Icon name="plus" />
                  Add option
                </button>
              </div>
            )}
          </fieldset>
        )}

        <div className="field">
          <div className="row row--between">
            <label className="label" htmlFor={`${id}-body`}>
              {kind === 'text' ? 'Text' : 'Text (optional)'}
            </label>
            <Count value={body.trim().length} max={LIMITS.bodyMax} />
          </div>
          <textarea
            className="textarea"
            id={`${id}-body`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
          />
          <p className="help">
            *italic* and **bold** work, and https links turn into links. Your draft stays on this device.
          </p>
        </div>

        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="composer__foot">
          <span className="muted" role="status">
            {busy === 'checking' ? 'Checking it. A few seconds.' : ''}
          </span>
          <button className="btn btn--primary" type="submit" disabled={busy !== 'idle'}>
            {busy === 'sending' ? 'Posting' : busy === 'checking' ? 'Checking' : 'Post'}
          </button>
        </div>
      </form>
    </Page>
  );
}

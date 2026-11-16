import { APP_NAME, initials, isStaffRole } from '@commons/shared';
import { useEffect, useState } from 'react';
import { joinUrl, qrPath, qrSize } from 'virtual:join-qr';
import { Icon, IconSprite } from '../components/Icon';
import { Wordmark } from '../components/Identity';
import { pollPercents } from '../components/Post';
import { useBoardFeed } from '../data/hooks';

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })
    .format(now)
    .replace(/\s?(AM|PM)$/i, '');
}

/** The design is 1280x720. On a TV it is scaled up to fill the screen; on a phone it reads like a page. */
function useBoardScale(): number {
  const compute = () => Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  const [scale, setScale] = useState(compute);
  useEffect(() => {
    const onResize = () => setScale(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}

function JoinQr() {
  return (
    <svg
      viewBox={`0 0 ${qrSize} ${qrSize}`}
      role="img"
      aria-label={`QR code that opens ${joinUrl}`}
      shapeRendering="crispEdges"
    >
      <path d={qrPath} fill="#000" />
    </svg>
  );
}

/**
 * The Gleason Hall screen. Public, no login, and it reads exactly one
 * document: boardFeed/current, which holds no uid and no authorship.
 */
export default function Board() {
  const { feed, load } = useBoardFeed();
  const clock = useClock();
  const scale = useBoardScale();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    document.title = `Hall screen · ${APP_NAME}`;
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const hasQuestion = !!feed?.questionPostId && !!feed.questionText;
  const options = feed?.pollOptions ?? [];
  const percents = pollPercents(options);
  const length = feed?.questionText.length ?? 0;
  const qClass = length > 95 ? 'q q--xlong' : length > 60 ? 'q q--long' : 'q';
  const headlines = feed?.nobleman ?? [];
  const anySample = headlines.some((item) => item.sample);

  return (
    <div className="nb bd-root" data-theme="board">
      <IconSprite />
      <div className="bd" style={{ ['--bd-scale' as string]: scale }}>
        <header className="bd-head">
          <Wordmark asText />
          <div className="clock">
            <span className="nb-badge nb-badge--live">
              <Icon name="tv" /> Live on Gleason Hall
            </span>
            <span>{clock}</span>
          </div>
        </header>

        <main className="bd-main">
          <section aria-live="polite">
            {load === 'loading' ? (
              <p className="quiet">Getting today’s question…</p>
            ) : !hasQuestion ? (
              <>
                <span className="nb-eyebrow">Today’s question</span>
                <h1 className="q">A new question is on its way.</h1>
                <p className="quiet">Scan the code to see what people are talking about right now.</p>
              </>
            ) : (
              <>
                <span className="nb-eyebrow">Today’s question · {feed!.spaceName}</span>
                <h1 className={qClass}>{feed!.questionText}</h1>
                <div className="counts">
                  <div>
                    <b>{feed!.counts.weighedIn}</b>
                    <span>
                      {feed!.counts.weighedIn === 1 ? 'person has weighed in' : 'people have weighed in'}
                    </span>
                  </div>
                  <div>
                    <b>{feed!.counts.replies}</b>
                    <span>{feed!.counts.replies === 1 ? 'reply' : 'replies'}</span>
                  </div>
                  <div>
                    <b>{feed!.counts.anonymousPercent}%</b>
                    <span>chose to stay anonymous</span>
                  </div>
                </div>
                {options.length > 0 && (
                  <div
                    className="bars"
                    role="img"
                    aria-label={`Poll: ${options.map((o, i) => `${o.label} ${percents[i]} percent`).join(', ')}`}
                  >
                    {options.slice(0, 4).map((option, i) => (
                      <div className="bar" key={option.id}>
                        <span>{option.label}</span>
                        <div className="t">
                          <i
                            className={i % 2 === 1 ? 'hatch' : undefined}
                            style={{ width: `${percents[i]}%` }}
                          />
                        </div>
                        <span className="p">{percents[i]}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {(!online || load === 'error') && (
              <p className="offline">Reconnecting. The numbers will catch up.</p>
            )}
          </section>

          <aside className="side" aria-label="Join in">
            <div className="join">
              <JoinQr />
              <div>
                <b>Join in</b>
                <span>Scan with your phone camera to reply.</span>
              </div>
            </div>
            {(feed?.approvedReplies ?? []).slice(0, 2).map((reply, i) => {
              return (
                <div className="reply" key={i}>
                  <div className={`nb-byline${reply.anonymous ? ' nb-byline--anon' : ''}`}>
                    {reply.anonymous ? (
                      <span className="nb-avatar nb-avatar--anon" aria-hidden="true">
                        <Icon name="mask" />
                      </span>
                    ) : (
                      <span
                        className={`nb-avatar${isStaffRole(reply.role) ? ' nb-avatar--staff' : ''}`}
                        aria-hidden="true"
                      >
                        {initials(reply.displayName)}
                      </span>
                    )}
                    <b>{reply.anonymous ? 'Anonymous' : reply.displayName}</b>
                    {!reply.anonymous && isStaffRole(reply.role) && (
                      <span className="nb-badge nb-badge--staff">
                        <Icon name="shield" /> Faculty
                      </span>
                    )}
                  </div>
                  <p>{reply.text}</p>
                </div>
              );
            })}
          </aside>
        </main>

        <footer className="tick">
          <b>From the Nobleman</b>
          {headlines.map((item) => (
            <span key={item.title} style={{ display: 'contents' }}>
              <span className="dot" aria-hidden="true" />
              <span>{item.title}</span>
            </span>
          ))}
          {anySample && (
            <>
              <span className="dot" aria-hidden="true" />
              <span>Sample headlines</span>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

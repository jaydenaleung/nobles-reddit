import { APP_NAME } from '@commons/shared';
import { useEffect, useState } from 'react';
import { joinUrl, qrPath, qrSize } from 'virtual:join-qr';
import { Icon, IconSprite } from '../components/Icon';
import { Byline, Wordmark } from '../components/Identity';
import { pollDescription, pollPercents } from '../components/Post';
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

/** Laid out at 1280x720 and scaled to the TV. On a phone it reads like a normal page instead. */
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

/** The Gleason TV. No login. It reads one document, boardFeed/current, which has no author info in it. */
export default function Board() {
  const { feed, load } = useBoardFeed();
  const clock = useClock();
  const scale = useBoardScale();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    document.title = `Gleason TV | ${APP_NAME}`;
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
  const options = (feed?.pollOptions ?? []).slice(0, 4);
  const percents = pollPercents(options);
  const length = feed?.questionText.length ?? 0;
  const qClass = length > 95 ? 'bd-q bd-q--xlong' : length > 60 ? 'bd-q bd-q--long' : 'bd-q';
  const headlines = feed?.nobleman ?? [];

  return (
    <div className="bd-root" data-theme="board">
      <IconSprite />
      <div className="bd" style={{ ['--bd-scale' as string]: scale }}>
        <header className="bd-head">
          <Wordmark asText />
          <div className="bd-clock">
            <Icon name="tv" />
            <span>Gleason Hall</span>
            <b>{clock}</b>
          </div>
        </header>

        <main className="bd-main">
          <section aria-live="polite">
            {load === 'loading' ? (
              <p className="bd-quiet">Loading</p>
            ) : !hasQuestion ? (
              <>
                <span className="bd-label">Question of the day</span>
                <h1 className="bd-q">No question up yet.</h1>
                <p className="bd-quiet">Scan the code to see what people are posting.</p>
              </>
            ) : (
              <>
                <span className="bd-label">Question of the day, in {feed!.spaceName}</span>
                <h1 className={qClass}>{feed!.questionText}</h1>
                <div className="bd-counts">
                  <div>
                    <b>{feed!.counts.weighedIn}</b>
                    <span>{options.length > 0 ? 'votes' : 'people weighed in'}</span>
                  </div>
                  <div>
                    <b>{feed!.counts.replies}</b>
                    <span>{feed!.counts.replies === 1 ? 'reply' : 'replies'}</span>
                  </div>
                  <div>
                    <b>{feed!.counts.anonymousPercent}%</b>
                    <span>of replies anonymous</span>
                  </div>
                </div>
                {options.length > 0 && (
                  <div className="bd-bars" role="img" aria-label={pollDescription(options)}>
                    {options.map((option, i) => (
                      <div className="bd-bar" key={option.id}>
                        <span>{option.label}</span>
                        <span className="bd-bar__track">
                          <span className="bd-bar__fill" style={{ width: `${percents[i]}%` }} />
                        </span>
                        <span>{percents[i]}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {(!online || load === 'error') && (
              <p className="bd-offline">Reconnecting. Numbers will catch up.</p>
            )}
          </section>

          <aside className="bd-side" aria-label="Reply">
            <div className="bd-join">
              <JoinQr />
              <div>
                <b>Reply from your phone</b>
                <span>Point your camera at the code.</span>
              </div>
            </div>
            {(feed?.approvedReplies ?? []).slice(0, 2).map((reply, i) => (
              <div className="reply" key={i}>
                <Byline
                  author={
                    reply.anonymous
                      ? { mode: 'anonymous', anonLabel: 'Anonymous' }
                      : { mode: 'named', name: reply.displayName, role: reply.role }
                  }
                />
                <p>{reply.text}</p>
              </div>
            ))}
          </aside>
        </main>

        {headlines.length > 0 && (
          <footer className="tick">
            <b>In the Nobleman</b>
            {headlines.map((item) => (
              <span key={item.url}>{item.title}</span>
            ))}
          </footer>
        )}
      </div>
    </div>
  );
}

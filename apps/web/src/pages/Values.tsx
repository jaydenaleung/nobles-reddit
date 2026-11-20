import { APP_NAME, CORE_VALUES, DEI_COMMITMENT, MISSION, NEDDIT_QUOTE, NEDDIT_TIPS } from '@commons/shared';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PublicFrame } from '../components/Layout';

/** The Nobles community values: the mission, the five core values, and a few tips for Neddit. */
export default function Values() {
  const { state } = useAuth();
  useEffect(() => {
    document.title = `Community values | ${APP_NAME}`;
  }, []);
  return (
    <PublicFrame>
      <div className="page values">
        <h1 className="page-h">Nobles Community Values</h1>

        <section className="values__mission" aria-labelledby="v-mission">
          <h2 className="th-h" id="v-mission">
            Mission
          </h2>
          <blockquote>
            <p>{MISSION}</p>
          </blockquote>
        </section>

        <section className="stack" aria-labelledby="v-core">
          <h2 className="th-h" id="v-core">
            Core values
          </h2>
          <dl className="values__list">
            {CORE_VALUES.map((value) => (
              <div key={value.name}>
                <dt>{value.name}</dt>
                <dd>{value.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="prose" aria-labelledby="v-dei">
          <h2 id="v-dei">Commitment to Diversity, Equity, and Inclusion</h2>
          <p>{DEI_COMMITMENT}</p>
        </section>

        <section className="prose" aria-labelledby="v-tips">
          <h2 id="v-tips">A few tips</h2>
          <ul>
            {NEDDIT_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
            <li>
              <i>{NEDDIT_QUOTE.text}</i> — {NEDDIT_QUOTE.by}
            </li>
          </ul>
        </section>

        <div className="row">
          {state.status === 'member' ? (
            <Link className="nb-btn nb-btn--primary" to="/">
              Back to the front page
            </Link>
          ) : (
            <Link className="nb-btn nb-btn--primary" to="/sign-in">
              Sign in with your Nobles Google account
            </Link>
          )}
        </div>
      </div>
    </PublicFrame>
  );
}

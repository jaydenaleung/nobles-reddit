import { ANONYMITY_NOTICE, APP_NAME, GROUND_RULES, SCHOOL_NAME } from '@commons/shared';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { PublicFrame } from '../components/Layout';

export default function About() {
  const { state } = useAuth();
  useEffect(() => {
    document.title = `How it works · ${APP_NAME}`;
  }, []);
  return (
    <PublicFrame>
      <div className="page">
        <h1 className="page-h">How {APP_NAME} works</h1>
        <p className="page-lede">
          A discussion board for the whole {SCHOOL_NAME} community. Students and faculty talk about school
          news, current events and anything else, in spaces for different parts of school life. The aim is
          open discussion that is both kind and honest.
        </p>

        <section className="stack" aria-labelledby="about-anon">
          <h2 className="th-h" id="about-anon">
            How anonymity works
          </h2>
          <ol className="steps">
            <li className="step">
              <div className="n">1</div>
              <h3>You choose</h3>
              <p>
                Every post and reply starts with “Post as”: your name or Anonymous. It is never preselected to
                Anonymous.
              </p>
            </li>
            <li className="step">
              <div className="n">2</div>
              <h3>Students see your choice</h3>
              <p>
                Anonymous shows a masked avatar and the word “Anonymous”. Nothing about your account leaks
                into the page.
              </p>
            </li>
            <li className="step">
              <div className="n">3</div>
              <h3>Administration can always see</h3>
              <p>
                The author of every message is recorded and visible to the administration. The notice appears
                on the composer, every time.
              </p>
            </li>
          </ol>
          <div className="nb-notice nb-notice--staff">
            <Icon name="shield" />
            <div>
              <b>In one sentence.</b> {ANONYMITY_NOTICE}
            </div>
          </div>
        </section>

        <div className="prose">
          <h2>Who can see what</h2>
          <ul>
            <li>
              <b>Other students and faculty</b> see your name, class year and a Faculty badge only when you
              post under your name. When you post as Anonymous they see “Anonymous” and a letter that is the
              same for you within one thread (so a conversation can be followed) and different in every other
              thread.
            </li>
            <li>
              <b>Moderators</b> are faculty chosen by the administration. They can hold, remove, restore and
              pin posts and read reports. They cannot see who wrote an anonymous post.
            </li>
            <li>
              <b>The administration</b> can look up the author of any post or comment. They have to give a
              reason, and every lookup is written to a log with their name and the time.
            </li>
            <li>
              <b>Faculty who post anonymously</b> show as “Anonymous” too, with no Faculty badge. That is on
              purpose.
            </li>
          </ul>

          <h2>Honest limits</h2>
          <ul>
            <li>
              This is a small community. People can sometimes guess who wrote something from how it is written
              or what it is about. Anonymous hides your name; it cannot hide your voice.
            </li>
            <li>The school can see authors. Anonymous here never means anonymous to the school.</li>
            <li>Anyone can take a screenshot. Deleting a post does not delete someone’s picture of it.</li>
            <li>
              A computer program checks new posts for things like harassment or signs that someone may be in
              danger, and may hold a post for a person to read first. It makes mistakes in both directions.
              People, not the program, make the decisions.
            </li>
          </ul>

          <h2>Ground rules</h2>
          <ol className="fp-rules">
            {GROUND_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>

          <h2>What we collect</h2>
          <p>
            Your name, your school email, your class year (you tell us) and your role. That is all. There are
            no ads, no trackers, no outside analytics and no photo uploads. You can download your data or
            delete your account from the You page. If you delete your account, your named posts stop showing
            your name; the school keeps its record of who wrote each post, as its policy requires.
          </p>

          <h2>Computer-written text is labelled</h2>
          <p>
            Long threads can have a short “Auto-summary”. It is written by a model, not by a person, it is
            always labelled, and it can be wrong. The model is never told who wrote anything. The question of
            the day is suggested by a model and chosen, or rewritten, by a moderator before anyone sees it.
          </p>

          <h2>If you are worried about someone</h2>
          <p>
            Use Report on any post and choose “I am worried about someone’s safety”, or talk to an adult at
            school. If someone is in danger right now, call 911. You can call or text 988 at any time.
          </p>
        </div>

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

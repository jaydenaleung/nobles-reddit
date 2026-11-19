import { ANONYMITY_NOTICE, APP_NAME, GROUND_RULES, SCHOOL_NAME } from '@commons/shared';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { PublicFrame } from '../components/Layout';

export default function About() {
  const { state } = useAuth();
  useEffect(() => {
    document.title = `How it works | ${APP_NAME}`;
  }, []);
  return (
    <PublicFrame>
      <div className="page">
        <h1 className="page-h">How {APP_NAME} works</h1>
        <p className="page-lede">
          {APP_NAME} is a message board for {SCHOOL_NAME} students and teachers. Post about something from
          school or something in the news, and people reply.
        </p>

        <section className="stack" aria-labelledby="about-anon">
          <h2 className="th-h" id="about-anon">
            Anonymous posts
          </h2>
          <ol className="steps">
            <li className="step">
              <div className="n">1</div>
              <h3>You pick</h3>
              <p>Every time you post, you pick your name or Anonymous. Nothing is picked for you.</p>
            </li>
            <li className="step">
              <div className="n">2</div>
              <h3>Students see “Anonymous”</h3>
              <p>They see a mask and the word Anonymous. Nothing about your account is in the page.</p>
            </li>
            <li className="step">
              <div className="n">3</div>
              <h3>The school can see it’s you</h3>
              <p>Every post is saved with who wrote it. The post form says so every time.</p>
            </li>
          </ol>
          <div className="nb-notice nb-notice--staff">
            <Icon name="shield" />
            <div>{ANONYMITY_NOTICE}</div>
          </div>
        </section>

        <div className="prose">
          <h2>Who can see what</h2>
          <ul>
            <li>
              <b>Other students and teachers</b> see your name and class year when you post under your name.
              When you post as Anonymous they see “Anonymous” plus a letter, like Anonymous B. You keep the
              same letter inside one thread so people can follow along, and get a new one in the next thread.
            </li>
            <li>
              <b>Mods</b> are teachers the administration picks. They read reports and can hide or remove
              posts. They can’t see who wrote an anonymous post.
            </li>
            <li>
              <b>Admins</b> can look up who wrote any post or comment. They have to type a reason first, and
              the lookup goes in a log nobody can edit.
            </li>
            <li>
              <b>Teachers who post anonymously</b> show up as Anonymous too, with no Faculty badge.
            </li>
          </ul>

          <h2>What anonymous can’t hide</h2>
          <ul>
            <li>Nobles is small. People can sometimes guess who wrote something from how it’s written.</li>
            <li>Anonymous here never means anonymous to the school.</li>
            <li>Screenshots. Deleting a post doesn’t delete a screenshot someone took.</li>
            <li>
              A computer model reads new posts before they go up and can hold one for a mod to check. It gets
              it wrong sometimes. A person makes every actual decision.
            </li>
          </ul>

          <h2>Ground rules</h2>
          <ol className="fp-rules">
            {GROUND_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>

          <h2>What gets stored</h2>
          <p>
            Your name, school email, class year and whether you’re a student or a teacher. No ads or trackers,
            and you can’t upload photos.
          </p>
          <p>
            You can download your data or delete your account from the You page. If you delete it, your named
            posts say “Former member”. The school still keeps its record of who wrote them.
          </p>

          <h2>Computer-written stuff</h2>
          <p>
            Long threads can get a short summary. It’s labeled, and the model is never told who wrote
            anything. A model also suggests the question of the day, but a mod picks one or writes their own
            before anyone sees it.
          </p>

          <h2>Worried about someone?</h2>
          <p>
            Hit Report on the post and pick “I’m worried someone isn’t safe”, or talk to an adult at school.
            If someone is in danger right now, call 911. You can call or text 988 any time.
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

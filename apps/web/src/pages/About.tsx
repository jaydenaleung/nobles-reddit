import { APP_NAME, GROUND_RULES } from '@commons/shared';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PublicFrame } from '../components/Layout';

export default function About() {
  const { state } = useAuth();
  useEffect(() => {
    document.title = `How this works | ${APP_NAME}`;
  }, []);
  return (
    <PublicFrame>
      <div className="page">
        <h1 className="page-h">How this works</h1>
        <p className="page-lede">
          {APP_NAME} is a message board for Nobles students and teachers. Post about something from school or
          something in the news, and people reply.
        </p>

        <div className="prose">
          <h2>Anonymous posts</h2>
          <p>Every time you post, you pick your name or Anonymous. Nothing is picked for you.</p>
          <p>
            Other students see “Anonymous” and a mask. In one post’s replies you keep the same letter, like
            Anonymous B, so people can follow along. In a different post you get a new letter.
          </p>
          <p>
            The school can always find out who wrote something. An admin has to type a reason, and every
            lookup goes in a log nobody can edit. Mods are the teachers who check reports. They can’t see who
            wrote anything.
          </p>
          <p>Teachers who post anonymously show up as Anonymous too, with no faculty label.</p>

          <h2>What anonymous can’t hide</h2>
          <ul>
            <li>People can sometimes guess from how you write or what you know.</li>
            <li>The school. Anonymous here never means anonymous to Nobles.</li>
            <li>Screenshots. Deleting a post doesn’t delete a screenshot of it.</li>
            <li>
              A computer model reads new posts before they go up. It can hold a fine post or miss a bad one. A
              person makes every actual decision.
            </li>
          </ul>

          <h2>Rules</h2>
          <ol className="rules">
            {GROUND_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>

          <h2>What gets stored</h2>
          <p>
            Your name, school email, class year and whether you’re a student or a teacher. No ads or trackers.
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
            <Link className="btn btn--primary" to="/">
              Back to the feed
            </Link>
          ) : (
            <Link className="btn btn--primary" to="/sign-in">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </PublicFrame>
  );
}

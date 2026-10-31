import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoginSheet } from '../components/LoginSheet';
import { BackHeader, HeroBow, pillOutline, pillWhite, Sheet } from '../components/ui';
import { campaign } from '../config/campaign';
import { useAsset } from '../lib/assets';
import { unlockAudio } from '../lib/audio';
import { useSession } from '../lib/session';
import { share } from '../lib/share';
import { track } from '../lib/track';

export function Landing() {
  const { landing } = campaign;
  const { session, setSession, copy, campaignOpen, ready } = useSession();
  const navigate = useNavigate();
  const logo = useAsset('logo');
  const [details, setDetails] = useState(false);
  const [login, setLogin] = useState(false);

  useEffect(() => track('landing_view'), []);

  const noAttempts = session?.attemptsLeft === 0;
  const play = () => {
    unlockAudio();
    track('play_click');
    if (session) navigate('/play');
    else setLogin(true);
  };

  let label: string = landing.letsPlay;
  if (noAttempts) label = landing.noAttempts;
  else if (!campaignOpen) label = landing.closed;

  const rules = landing.rules(campaign.bossName, copy.rewardShort, copy.rewardConditions);
  const shareButton = (
    <button
      aria-label={landing.share}
      onClick={() => void share()}
      className="flex min-h-11 items-center px-3 font-medium"
    >
      {landing.share}
    </button>
  );

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#4a160c_0%,#0b0705_60%)] pb-32">
      <BackHeader trailing={shareButton} />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-5">
        <section className="flex flex-col items-center text-center">
          {logo && <img src={logo} alt="" width={160} height={60} className="h-14 w-auto" />}
          <HeroBow />
          <h1 className="font-display text-4xl font-bold text-gold">{campaign.gameTitle}</h1>
          <p className="mt-2 text-neutral-200">{campaign.tagline}</p>
        </section>

        {session && session.lastScore !== null && (
          <section className="card">
            <h2 className="text-lg font-bold">{landing.welcome}</h2>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p>{landing.lastScore(session.lastScore)}</p>
              <button
                onClick={() => void share(session.lastScore!)}
                className="min-h-11 shrink-0 px-2 font-semibold text-gold underline"
              >
                {landing.share}
              </button>
            </div>
            <p className="mt-1 text-sm text-neutral-200">{landing.hitAll(copy.rewardShort)}</p>
            <div className="mt-3 flex justify-between font-semibold">
              <span>{landing.best(session.bestScore)}</span>
              <span>{landing.attempts(session.attemptsLeft)}</span>
            </div>
          </section>
        )}

        <section className="card">
          <p className="text-sm text-neutral-200">{landing.rewardSmall}</p>
          <p className="mt-1 text-2xl font-bold">{copy.rewardTitle}</p>
          <button
            onClick={() => setDetails(true)}
            className="mt-1 min-h-11 font-semibold text-gold underline"
          >
            {landing.viewDetails}
          </button>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold tracking-widest text-neutral-200">
            {landing.rulesTitle}
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </section>

        <nav className="flex flex-col divide-y divide-white/15 border-y border-white/15">
          <Link to="/terms" className="flex min-h-12 items-center justify-between">
            {landing.terms} <span aria-hidden="true">›</span>
          </Link>
          <button
            onClick={() => void share()}
            className="flex min-h-12 items-center justify-between text-left"
          >
            {landing.shareFriends} <span aria-hidden="true">›</span>
          </button>
        </nav>
      </main>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/90 to-transparent p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <button
          onClick={play}
          disabled={!ready || noAttempts || !campaignOpen}
          className={`${pillWhite} mx-auto w-full max-w-md`}
        >
          {label}
        </button>
      </div>

      {details && (
        <Sheet title={landing.detailsTitle} onClose={() => setDetails(false)}>
          <p>{copy.rewardConditions}</p>
          <button onClick={() => setDetails(false)} className={`${pillOutline} mt-4 w-full`}>
            {landing.close}
          </button>
        </Sheet>
      )}
      {login && (
        <LoginSheet
          onClose={() => setLogin(false)}
          onDone={(next) => {
            setSession(next);
            navigate('/play');
          }}
        />
      )}
    </div>
  );
}

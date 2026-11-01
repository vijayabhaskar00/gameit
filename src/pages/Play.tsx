import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { pillWhite } from '../components/ui';
import { campaign } from '../config/campaign';
import { createGame, type RoundEnd } from '../game';
import { SIM_CONFIG } from '../game/config';
import { api, ApiError, isTransient, withRetry, type RoundStart } from '../lib/api';
import { useSession } from '../lib/session';
import { track } from '../lib/track';

const TALLY_MIN_MS = 800;
// With a 10 s timeout on each try, the last one still lands inside the server's 120 s limit.
const FINISH_RETRY_MS = [1000, 3000, 7000];
const BLOCKED_GESTURES = ['gesturestart', 'touchmove', 'contextmenu'];
const blockGesture = (e: Event) => e.preventDefault();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Phase = 'playing' | 'tally' | 'tallyFailed' | 'busy';

export default function Play() {
  const copy = campaign.game;
  const host = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, setSession, ready } = useSession();
  const [phase, setPhase] = useState<Phase>('playing');
  const [end, setEnd] = useState<RoundEnd | null>(null);
  const [round, setRound] = useState<RoundStart | null>(null);
  const debug = params.get('debug') === '1';
  const seedParam = params.get('seed');

  useEffect(() => {
    document.documentElement.classList.add('game-lock');
    for (const name of BLOCKED_GESTURES) {
      document.addEventListener(name, blockGesture, { passive: false });
    }
    return () => {
      document.documentElement.classList.remove('game-lock');
      for (const name of BLOCKED_GESTURES) document.removeEventListener(name, blockGesture);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const client = await api();
        const started = await client.roundStart(seedParam ? Number(seedParam) : undefined);
        if (cancelled) return;
        track('round_start');
        setRound(started);
      } catch (error) {
        if (error instanceof ApiError && error.message === 'round_in_progress') setPhase('busy');
        else navigate('/', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // A round costs an attempt, so it starts once per mount and never on a session change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const tally = useCallback(
    async (started: RoundStart, ended: RoundEnd) => {
      setPhase('tally');
      const client = await api();
      const shots = ended.shotLog.length;
      track('round_end', {
        score: ended.score,
        reason: ended.reason,
        durationMs: Math.round(ended.durationMs),
        accuracy: shots ? ended.score / shots : 0,
      });
      try {
        const [result] = await Promise.all([
          withRetry(
            () => client.roundFinish(started.roundId, ended.shotLog, ended.score),
            FINISH_RETRY_MS,
          ),
          wait(TALLY_MIN_MS),
        ]);
        setSession(await client.session());
        if (result.reward && result.score === started.heads) {
          track('reward_issued');
          navigate('/win', { replace: true });
        } else {
          navigate(`/result/${started.roundId}`, { replace: true, state: result });
        }
      } catch (error) {
        if (isTransient(error)) {
          track('error', { message: String(error) });
          setPhase('tallyFailed');
          return;
        }
        // The round is settled: an earlier try landed and only its reply was lost, or the
        // server refused it. Retrying cannot change either.
        const fresh = await client.session().catch(() => null);
        if (fresh) setSession(fresh);
        const won = fresh?.reward && ended.score === started.heads;
        navigate(won ? '/win' : `/result/${started.roundId}`, { replace: true });
      }
    },
    [navigate, setSession],
  );

  useEffect(() => {
    if (!round) return;
    const game = createGame(host.current!, {
      seed: round.seed,
      config: {
        ...SIM_CONFIG,
        roundSeconds: round.roundSeconds,
        arrows: round.arrows,
        heads: round.heads,
      },
      debug,
      onShot: () => track('shot'),
      onEnd: (ended) => {
        setEnd(ended);
        void tally(round, ended);
      },
    });
    return () => game.destroy(true);
  }, [round, debug, tally]);

  return (
    <div className="fixed inset-0 bg-ink pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <div ref={host} className="h-full w-full" />
      {phase !== 'playing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/80 p-6 text-center">
          {phase === 'tally' && (
            <>
              <div className="size-12 animate-spin rounded-full border-4 border-white/20 border-t-gold" />
              <p className="text-lg">{copy.tally}</p>
              {debug && end && (
                <p className="text-sm text-neutral-300" data-testid="replay">
                  seed {end.seed} · score {end.score} · {copy.shotLabel} {end.shotLog.length} ·
                  replay {end.replayMatches ? 'OK' : 'MISMATCH'}
                </p>
              )}
            </>
          )}
          {phase === 'tallyFailed' && (
            <>
              <p className="text-lg">{copy.tallyFailed}</p>
              <button className={pillWhite} onClick={() => void tally(round!, end!)}>
                {copy.retry}
              </button>
            </>
          )}
          {phase === 'busy' && (
            <>
              <p className="text-lg">{copy.roundBusy}</p>
              <Link to="/" className={pillWhite}>
                {copy.home}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

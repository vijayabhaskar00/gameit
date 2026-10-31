import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { campaign } from '../config/campaign';
import { api, type Copy, type Session } from './api';

interface SessionState {
  session: Session | null;
  setSession: (session: Session) => void;
  /** Server copy when known, otherwise the campaign.ts defaults. */
  copy: Copy;
  campaignOpen: boolean;
  ready: boolean;
}

const defaults: Copy = {
  rewardShort: campaign.rewardShort,
  rewardTitle: campaign.rewardTitle,
  rewardConditions: campaign.rewardConditions,
};

const Context = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<{ copy: Copy; campaignOpen: boolean } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const client = await api();
        const url = new URL(location.href);
        const token = url.searchParams.get('token');
        if (token) {
          await client.loginWithToken(token);
          // The token must not stay in history, or in a link the player shares.
          url.searchParams.delete('token');
          history.replaceState(null, '', url);
        }
        setConfig(await client.publicConfig());
        if (await client.isLoggedIn()) setSession(await client.session());
      } catch (error) {
        console.error(error);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      session,
      setSession,
      copy: session?.copy ?? config?.copy ?? defaults,
      campaignOpen: session?.campaignOpen ?? config?.campaignOpen ?? true,
      ready,
    }),
    [session, config, ready],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSession(): SessionState {
  return useContext(Context)!;
}

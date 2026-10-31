import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { campaign } from '../config/campaign';
import { api, type Session } from '../lib/api';
import { track } from '../lib/track';
import { pillWhite, Sheet } from './ui';

const field =
  'mt-1 min-h-12 w-full rounded-xl border border-white/30 bg-black/30 px-3 text-white outline-none focus:border-gold';

export function LoginSheet(props: { onClose: () => void; onDone: (session: Session) => void }) {
  const copy = campaign.login;
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const phone = `${campaign.phonePrefix}${mobile}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      const client = await api();
      if (!sent) {
        await client.sendOtp(phone);
        setSent(true);
      } else {
        await client.verifyOtp(phone, otp);
        const session = await client.session(name);
        track('login_success');
        props.onDone(session);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={copy.title} onClose={props.onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label>
          {copy.name}
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={60}
            className={field}
          />
        </label>
        <label>
          {copy.phone}
          <input
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            autoComplete="tel-national"
            pattern="[0-9]{10}"
            maxLength={10}
            disabled={sent}
            className={field}
          />
        </label>
        {sent && (
          <label>
            {copy.otp}
            <input
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              className={field}
            />
          </label>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            required
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="size-5"
          />
          <span>
            {copy.consentStart}
            <Link to="/terms" className="underline">
              {copy.terms}
            </Link>
            {copy.consentAnd}
            <Link to="/privacy" className="underline">
              {copy.privacy}
            </Link>
          </span>
        </label>
        {failed && (
          <p role="alert" className="text-sm text-ember">
            {copy.failed}
          </p>
        )}
        <button disabled={busy} className={pillWhite}>
          {sent ? copy.verify : copy.sendOtp}
        </button>
      </form>
    </Sheet>
  );
}

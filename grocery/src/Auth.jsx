import React, { useEffect, useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { backend } from "./backend";
export function useSession() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(Boolean(backend));
  useEffect(() => {
    if (!backend) return;
    let active = true;
    backend.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    const {
      data: { subscription },
    } = backend.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return { session, loading };
}
export default function Auth({ title = "Verify your email", onBack }) {
  const [email, setEmail] = useState(""),
    [token, setToken] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function send(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error } = await backend.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setSent(true);
      setCooldown(60);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error } = await backend.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (error) throw error;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-white p-7">
      <ShieldCheck size={28} className="mb-5 text-forest" />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mb-6 mt-2 text-sm leading-6 text-muted">
        {sent
          ? `Enter the code sent to ${email}.`
          : "We’ll send a one-time code to your email. No password to remember."}
      </p>
      <form onSubmit={sent ? verify : send}>
        <label className="text-sm font-semibold">
          {sent ? "Verification code" : "Email address"}
          <input
            required
            autoComplete={sent ? "one-time-code" : "email"}
            type={sent ? "text" : "email"}
            inputMode={sent ? "numeric" : "email"}
            pattern={sent ? "[0-9]{6,8}" : undefined}
            maxLength={sent ? 8 : 254}
            value={sent ? token : email}
            onChange={(e) =>
              sent ? setToken(e.target.value) : setEmail(e.target.value)
            }
            className="mt-2 w-full rounded-md border px-3 py-3 font-normal"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-forest py-3 text-sm font-semibold text-white"
        >
          {busy ? "Please wait…" : sent ? "Verify code" : "Send code"}
        </button>
      </form>
      {sent && (
        <div className="mt-4 flex justify-between text-xs">
          <button disabled={busy || cooldown > 0} onClick={send}>
            {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
          <button
            onClick={() => {
              setSent(false);
              setToken("");
              setError("");
            }}
          >
            Change email
          </button>
        </div>
      )}
      {onBack && (
        <button
          onClick={onBack}
          className="mt-6 flex items-center gap-2 text-xs text-muted"
        >
          <ArrowLeft size={14} /> Back to store
        </button>
      )}
    </div>
  );
}

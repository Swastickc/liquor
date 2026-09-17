import React, { useEffect, useState } from "react";
import Auth, { useSession } from "./Auth";
import Admin from "./Admin";
import { backend, isLive } from "./backend";
export default function Studio(props) {
  const { session, loading } = useSession();
  const [allowed, setAllowed] = useState(false),
    [checking, setChecking] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    if (!backend || !session) {
      setAllowed(false);
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    backend
      .from("store_admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active) {
          setAllowed(Boolean(data));
          setError(
            error ? "Could not verify admin access. Reload to retry." : "",
          );
          setChecking(false);
        }
      });
    return () => {
      active = false;
    };
  }, [session]);
  if (!isLive) return <Admin {...props} />;
  if (loading || checking)
    return <p className="p-10 text-center">Checking admin access…</p>;
  if (!session)
    return (
      <div className="min-h-screen bg-cream px-5 py-14">
        <Auth title="Store admin sign-in" onBack={props.onBack} />
      </div>
    );
  if (!allowed)
    return (
      <div className="mx-auto max-w-lg p-10">
        <h1 className="text-2xl font-semibold">Admin access required</h1>
        <p className="my-4 text-sm text-muted">
          {error ||
            "This verified account has not been granted store administrator access."}
        </p>
        <button
          onClick={() => backend.auth.signOut()}
          className="mr-5 underline"
        >
          Sign out
        </button>
        <button onClick={props.onBack} className="underline">
          Back to store
        </button>
      </div>
    );
  return <Admin {...props} />;
}

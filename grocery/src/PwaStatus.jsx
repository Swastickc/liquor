import React, { useEffect, useState } from "react";
import { Download, WifiOff, X } from "lucide-react";
export default function PwaStatus() {
  const [offline, setOffline] = useState(!navigator.onLine),
    [install, setInstall] = useState(null),
    [help, setHelp] = useState(false);
  useEffect(() => {
    const online = () => setOffline(false),
      off = () => setOffline(true),
      ready = (e) => {
        e.preventDefault();
        setInstall(e);
      },
      done = () => setInstall(null);
    window.addEventListener("online", online);
    window.addEventListener("offline", off);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function installApp() {
    if (install) {
      await install.prompt();
      await install.userChoice;
      setInstall(null);
    } else setHelp(true);
  }
  return (
    <>
      {offline && (
        <div role="alert" className="network-status">
          <WifiOff size={15} /> You’re offline. Reconnect for current stock and
          checkout.
        </div>
      )}
      <div className="pwa-install">
        <button onClick={installApp}>
          <Download size={14} /> Install Kalna Daily
        </button>
        {help && (
          <p role="status">
            On iPhone: Safari → Share → Add to Home Screen. On Android: your
            browser menu → Install app / Add to Home screen.{" "}
            <button
              aria-label="Dismiss installation instructions"
              onClick={() => setHelp(false)}
            >
              <X size={14} />
            </button>
          </p>
        )}
      </div>
    </>
  );
}

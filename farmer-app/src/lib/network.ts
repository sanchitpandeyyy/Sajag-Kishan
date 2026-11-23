import * as Network from "expo-network";
import { useEffect, useState } from "react";

/** Best current guess; starts optimistic so the first request is always tried. */
let online = true;
const listeners = new Set<(online: boolean) => void>();

function set(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l(next));
}

const fromState = (s: Network.NetworkState) => s.isConnected !== false && s.isInternetReachable !== false;

try {
  Network.getNetworkStateAsync()
    .then((s) => set(fromState(s)))
    .catch(() => undefined);
  Network.addNetworkStateListener((s) => set(fromState(s)));
} catch {
  // Network module unavailable: stay optimistic and rely on request failures.
}

export const isOnline = () => online;

/** Call when a request fails at the network level, or succeeds, to keep the flag honest between OS events. */
export function noteRequestResult(ok: boolean) {
  set(ok);
}

export function onOnlineChange(fn: (online: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useOnline(): boolean {
  const [value, setValue] = useState(online);
  useEffect(() => {
    setValue(online);
    return onOnlineChange(setValue);
  }, []);
  return value;
}

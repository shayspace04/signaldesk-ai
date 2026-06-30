import { useEffect } from "react";

const REFRESH_EVENT = "signaldesk:refresh";

export function emitRefresh() {
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
}

export function useRefreshListener(fn) {
  useEffect(() => {
    const handler = () => fn();
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, [fn]);
}

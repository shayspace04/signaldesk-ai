import { useEffect, useRef } from "react";

const REFRESH_EVENT = "signaldesk:refresh";

export function emitRefresh() {
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
}

export function useRefreshListener(fn) {
  const savedFn = useRef(fn);
  savedFn.current = fn;
  useEffect(() => {
    const handler = () => savedFn.current();
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, []);
}

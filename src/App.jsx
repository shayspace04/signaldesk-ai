import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import client from "./lib/lemmaClient";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import AppLayout from "./components/layout/AppLayout";

function ToasterWithTheme() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: isDark ? "#18181B" : "#fff",
          color: isDark ? "#FAFAFA" : "#18181b",
          border: isDark ? "1px solid #2A2A2E" : "1px solid #EFEFEF",
        },
      }}
    />
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [authState, setAuthState] = useState(null);

  useEffect(() => {
    const unsub = client.auth.subscribe(setAuthState);
    client.initialize().then(setAuthState).finally(() => setReady(true));
    return unsub;
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-[#09090B] text-zinc-900 dark:text-[#FAFAFA]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-[#FAFAFA]" />
          <p className="text-zinc-400 dark:text-[#71717A] text-sm">Connecting to SignalDesk...</p>
        </div>
      </div>
    );
  }

  if (authState?.status === "unauthenticated") {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-[#09090B] text-zinc-900 dark:text-[#FAFAFA]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <svg className="h-12 w-12 text-zinc-300 dark:text-[#71717A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
          </svg>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-[#FAFAFA]">Session expired</h2>
          <p className="text-zinc-500 dark:text-[#A1A1AA] text-sm">
            Your access token has expired. Run <code className="rounded bg-zinc-100 dark:bg-[#202024] px-1.5 py-0.5 text-sm font-mono text-zinc-700 dark:text-[#FAFAFA]">lemma auth login</code> to refresh your session, then reload the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-lg bg-zinc-900 dark:bg-[#18181B] px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:hover:bg-[#27272A]"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppLayout />
        <ToasterWithTheme />
      </BrowserRouter>
    </ThemeProvider>
  );
}

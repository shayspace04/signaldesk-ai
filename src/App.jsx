import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import client from "./lib/lemmaClient";
import AppLayout from "./components/layout/AppLayout";

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    client.initialize().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
          <p className="text-zinc-400 text-sm">Connecting to SignalDesk...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: "#fff", color: "#18181b", border: "1px solid #EFEFEF" },
        }}
      />
    </BrowserRouter>
  );
}

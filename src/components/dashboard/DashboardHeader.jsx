import { Button } from "@/components/ui/button";
import { RefreshCcw, Sparkles } from "lucide-react";

export default function DashboardHeader() {
  return (
    <div className="flex items-center justify-between">

      <div>

        <div className="flex items-center gap-3">

          <div className="rounded-xl bg-violet-100 p-2">

            <Sparkles className="text-violet-600" size={20} />

          </div>

          <div>

            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
              AI Operations Center
            </h1>

            <p className="mt-1 text-zinc-500">
              Monitor incidents, tickets and AI agents in real time.
            </p>

          </div>

        </div>

      </div>

      <Button className="gap-2">

        <RefreshCcw size={16} />

        Refresh

      </Button>

    </div>
  );
}

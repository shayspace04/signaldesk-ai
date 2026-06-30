import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { Search, BookOpen, Lightbulb } from "lucide-react";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";
import ConfidenceBadge from "@/components/common/ConfidenceBadge";
import { format } from "date-fns";
import { useWorkspace } from "@/context/WorkspaceContext";

export default function Knowledge() {
  const { workspace } = useWorkspace();
  const { data: entries, loading } = useLemmaRecords("memory_entries", { limit: 100 });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.summary || "").toLowerCase().includes(q) ||
        (e.body || "").toLowerCase().includes(q) ||
        (e.tags || []).some((t) => String(t).toLowerCase().includes(q))
    );
  }, [entries, search]);

  return (
    <motion.div
      className="flex flex-col min-h-full space-y-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{workspace.knowledge.title}</h1>
        <p className="mt-1 text-sm text-zinc-400">{workspace.knowledge.subtitle}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memory entries..."
          className="w-full rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-zinc-400"
        />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20">
          <BookOpen size={36} className="mb-3 text-zinc-300" />
          <p className="text-zinc-600 font-medium">
            {search ? "No entries match your search" : "No knowledge entries yet"}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {search ? "Try a different search term." : "Memory entries appear when signals are materialized."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-[#EFEFEF] bg-white p-5 transition-colors hover:border-zinc-200"
            >
              <div className="flex items-start gap-3">
                <Lightbulb size={16} className="mt-0.5 text-amber-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-zinc-900 truncate">
                    {entry.title || "Untitled"}
                  </h3>
                  {entry.confidence && (
                    <div className="mt-1">
                      <ConfidenceBadge value={entry.confidence} />
                    </div>
                  )}
                </div>
              </div>

              {(entry.summary || entry.body) && (
                <p className="mt-3 text-sm text-zinc-500 line-clamp-3">
                  {entry.summary || entry.body}
                </p>
              )}

              {entry.tags && Array.isArray(entry.tags) && entry.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {entry.tags.map((tag, i) => (
                    <span key={i} className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {entry.captured_at && (
                <p className="mt-3 text-xs text-zinc-400">
                  {format(new Date(entry.captured_at), "MMM d, yyyy")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

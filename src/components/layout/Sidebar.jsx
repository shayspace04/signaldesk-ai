import { NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, UserCheck, UserCog, Activity, Bell, Ticket, Radio, ShieldAlert, BookOpen, BarChart3, ScrollText, Settings, Signal as SignalIcon } from "lucide-react";
import { useWorkspace, workspaces } from "@/context/WorkspaceContext";
import useRole from "@/hooks/useRole";
import { useLemmaRecords } from "@/hooks/useLemmaRecords";

const navItems = [
  { name: "Dashboard", icon: Activity, path: "/dashboard", badge: null },
  { name: "Notifications", icon: Bell, path: "/notifications", badge: "unread" },
  { name: "Tickets", icon: Ticket, path: "/tickets", badge: "tickets" },
  { name: "Signals", icon: Radio, path: "/signals", badge: "signals" },
  { name: "Incidents", icon: ShieldAlert, path: "/incidents", badge: "incidents" },
  { name: "Knowledge", icon: BookOpen, path: "/knowledge", badge: null },
  { name: "Analytics", icon: BarChart3, path: "/analytics", badge: null },
  { name: "Audit Log", icon: ScrollText, path: "/audit", badge: null },
  { name: "Settings", icon: Settings, path: "/settings", badge: null },
];

function Badge({ value }) {
  if (!value || value === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-900 px-1.5 text-[10px] font-semibold text-white">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export default function Sidebar() {
  const { workspace, setWorkspace } = useWorkspace();
  const { role, setRole } = useRole();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const { data: tickets } = useLemmaRecords("tickets", { limit: 200 });
  const { data: signals } = useLemmaRecords("signals", { limit: 100 });
  const { data: incidents } = useLemmaRecords("incidents", { limit: 50 });
  const { data: logs } = useLemmaRecords("audit_logs", { sort: [{ field: "created_at", direction: "desc" }], limit: 20 });

  const openTickets = useMemo(() => tickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length, [tickets]);
  const pendingSignals = useMemo(() => signals.filter((s) => s.status === "pending" || !s.status).length, [signals]);
  const activeIncidents = useMemo(() => incidents.filter((i) => i.status !== "resolved").length, [incidents]);
  const unreadNotifs = useMemo(() => {
    try {
      const readIds = new Set(JSON.parse(localStorage.getItem("signaldesk-read-notifs") || "[]"));
      return logs.filter((n) => !readIds.has(n.id)).length;
    } catch { return logs.length; }
  }, [logs]);

  const badgeMap = {
    tickets: openTickets,
    signals: pendingSignals,
    incidents: activeIncidents,
    unread: unreadNotifs,
  };

  const [searchResults, setSearchResults] = useState([]);
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const results = [];
    tickets.filter((t) => (t.title || "").toLowerCase().includes(q) || (t.customer_name || "").toLowerCase().includes(q)).slice(0, 5).forEach((t) => {
      results.push({ label: t.title || t.id, sub: t.customer_name || "", path: "/tickets", id: t.id });
    });
    signals.filter((s) => (s.name || "").toLowerCase().includes(q)).slice(0, 3).forEach((s) => {
      results.push({ label: s.name || s.id, sub: s.category || "", path: "/signals", id: s.id });
    });
    setSearchResults(results);
  }, [searchQuery, tickets, signals]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchResults.length > 0) {
      const first = searchResults[0];
      navigate(first.path);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  return (
    <aside className="flex w-60 flex-col border-r border-[#EFEFEF] bg-white flex-shrink-0 h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
          SD
        </div>
        <span className="text-base font-semibold tracking-tight">SignalDesk</span>
      </div>

      <div className="relative px-3 pb-3">
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${searchFocused ? "border-zinc-400" : "border-[#EFEFEF]"} bg-[#FAFAFA]`}>
          <Search size={15} className="text-zinc-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            className="w-full bg-transparent outline-none text-sm placeholder:text-zinc-400"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border border-[#EFEFEF] bg-white py-2 shadow-lg">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onMouseDown={() => { navigate(r.path); setSearchQuery(""); setSearchResults([]); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.label}</p>
                  <p className="text-xs text-zinc-400 truncate">{r.sub}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const badgeValue = item.badge ? badgeMap[item.badge] : null;
          return (
            <NavLink
              key={item.path}
              to={item.path === "/notifications" ? "#" : item.path}
              onClick={item.path === "/notifications" ? (e) => e.preventDefault() : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-100 font-medium text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                }`
              }
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="truncate">{item.name}</span>
              <Badge value={badgeValue} />
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-[#EFEFEF] px-3 py-3 space-y-2">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Support Team</p>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-50"
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: workspace.accent }}
            >
              {workspace.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{workspace.name}</p>
              <p className="text-[11px] text-zinc-400">Demo Workspace</p>
            </div>
            <ChevronDown size={14} className="text-zinc-400 flex-shrink-0" />
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-[#EFEFEF] bg-white shadow-lg overflow-hidden">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { setWorkspace(w.id); setDropdownOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 ${
                    w.id === workspace.id ? "bg-zinc-50" : ""
                  }`}
                >
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: w.accent }}
                  >
                    {w.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{w.name}</p>
                    <p className="text-[10px] text-zinc-400">{w.subtitle}</p>
                  </div>
                  {w.id === workspace.id && (
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: w.accent }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex rounded-lg border border-[#EFEFEF] overflow-hidden">
          <button
            onClick={() => setRole("agent")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
              role === "support_agent"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <UserCheck size={12} />
            Agent
          </button>
          <div className="w-px bg-[#EFEFEF]" />
          <button
            onClick={() => setRole("manager")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
              role === "support_manager"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <UserCog size={12} />
            Manager
          </button>
        </div>
      </div>
    </aside>
  );
}

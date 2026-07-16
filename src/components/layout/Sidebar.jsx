import { NavLink, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Activity, Bell, Ticket, Radio, ShieldAlert, BookOpen, BarChart3, ScrollText, Settings, UserCheck, UserCog, ClipboardCheck, FlaskConical } from "lucide-react";
import Logo from "@/components/common/Logo";
import { useWorkspace, workspaces } from "@/context/WorkspaceContext";
import useRole from "@/hooks/useRole";
import { useMetrics } from "@/hooks/useMetrics";
import ThemeToggle from "@/components/common/ThemeToggle";

const navItems = [
  { name: "Dashboard", icon: Activity, path: "/dashboard", badge: null },
  { name: "Notifications", icon: Bell, path: "/notifications", badge: "unread" },
  { name: "Tickets", icon: Ticket, path: "/tickets", badge: "tickets" },
  { name: "Signals", icon: Radio, path: "/signals", badge: "signals" },
  { name: "Incidents", icon: ShieldAlert, path: "/incidents", badge: "incidents" },
  { name: "Approval Desk", icon: ClipboardCheck, path: "/approval", badge: "drafts", role: "support_manager" },
  { name: "Knowledge", icon: BookOpen, path: "/knowledge", badge: null },
  { name: "Analytics", icon: BarChart3, path: "/analytics", badge: null },
  { name: "Audit Log", icon: ScrollText, path: "/audit", badge: null },
  { name: "Settings", icon: Settings, path: "/settings", badge: null },
  { name: "Enterprise Demo", icon: FlaskConical, path: "/enterprise-demo", badge: null },
];

function Badge({ value }) {
  if (value == null) return null;
  return (
    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-900 px-1.5 text-[10px] font-semibold text-white dark:bg-white dark:text-zinc-900">
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

  // Single source of truth for all sidebar badges: useMetrics
  const m = useMetrics(workspace.id);
  const badgeMap = m.sidebar;

  const tickets = m.all.tickets || [];
  const signals = m.all.signals || [];
  const knowledge = m.all.knowledge || [];

  const [searchResults, setSearchResults] = useState([]);
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const results = [];
    tickets.filter((t) => (t.title || "").toLowerCase().includes(q) || (t.customer_name || "").toLowerCase().includes(q)).slice(0, 5).forEach((t) => {
      results.push({ label: t.title || t.id, sub: t.customer_name || "", path: "/tickets", id: t.id, focusTicketId: t.id });
    });
    signals.filter((s) => (s.name || "").toLowerCase().includes(q)).slice(0, 3).forEach((s) => {
      results.push({ label: s.name || s.id, sub: s.category || "", path: "/signals", id: s.id });
    });
    knowledge.filter((k) => (k.title || "").toLowerCase().includes(q) || (k.summary || "").toLowerCase().includes(q) || (k.root_cause || "").toLowerCase().includes(q)).slice(0, 3).forEach((k) => {
      results.push({ label: k.title || "Knowledge Article", sub: `${k.confidence || 0}% confidence`, path: "/knowledge", id: k.id });
    });
    setSearchResults(results);
  }, [searchQuery, tickets, signals, knowledge]);

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
      navigate(first.path, { state: { focusTicketId: first.id } });
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  return (
    <aside className="flex w-60 flex-col border-r border-border dark:border-border-dark bg-white dark:bg-[#111113] flex-shrink-0 h-screen sticky top-0 z-30">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight text-primary">SignalDesk</span>
      </div>

      <div className="relative px-4 pb-3">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all duration-200 ${searchFocused ? "border-zinc-300 dark:border-[#2A2A2E] ring-1 ring-zinc-200 dark:ring-zinc-600" : "border-border dark:border-[#2A2A2E]"} bg-surface dark:bg-[#111113]`}>
          <Search size={15} className="text-muted dark:text-muted-dark flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search tickets, signals, knowledge..."
            className="w-full bg-transparent outline-none text-sm placeholder:text-muted dark:placeholder:text-muted-dark dark:text-muted-dark"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1.5 z-50 rounded-xl border border-border dark:border-border-dark bg-card py-2 shadow-dropdown">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onMouseDown={() => { navigate(r.path, { state: { focusTicketId: r.id } }); setSearchQuery(""); setSearchResults([]); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-[#27272A] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-primary">{r.label}</p>
                  <p className="text-xs text-muted dark:text-muted-dark truncate">{r.sub}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {navItems.filter((item) => !item.role || item.role === role).map((item) => {
          const Icon = item.icon;
          const badgeValue = item.badge ? badgeMap[item.badge] : null;

          if (item.path === "/notifications") {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${isActive ? "bg-zinc-900 font-medium text-white dark:bg-white dark:text-zinc-900" : "text-muted-base hover:bg-zinc-100 hover:text-body dark:hover:text-primary"}`}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="truncate">{item.name}</span>
                <Badge value={badgeValue} />
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-zinc-900 font-medium text-white"
                    : "text-muted-base hover:bg-zinc-100 hover:text-body dark:hover:text-primary"
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

      <div className="border-t border-border dark:border-border-dark px-4 py-3 space-y-3">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[#27272A]"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: workspace.accent }}
            >
              {workspace.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-primary">{workspace.name}</p>
                    <p className="text-[11px] text-muted dark:text-muted-dark">{workspace.subtitle || "Demo Workspace"}</p>
            </div>
            <ChevronDown size={14} className="text-muted dark:text-muted-dark flex-shrink-0" />
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 rounded-xl border border-border dark:border-border-dark bg-card shadow-dropdown overflow-hidden z-40">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { setWorkspace(w.id); setDropdownOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-[#27272A] ${
                    w.id === workspace.id ? "bg-zinc-50 dark:bg-[#27272A]" : ""
                  }`}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[9px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: w.accent }}
                  >
                    {w.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-primary">{w.name}</p>
                    <p className="text-[10px] text-muted dark:text-muted-dark">{w.subtitle}</p>
                  </div>
                  {w.id === workspace.id && (
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: w.accent }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex rounded-xl border border-border dark:border-border-dark overflow-hidden">
          <button
            onClick={() => setRole("support_agent")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all duration-150 ${
              role === "support_agent"
                ? "bg-zinc-900 text-white"
                : "text-muted-base hover:bg-zinc-50 hover:text-body dark:hover:bg-[#27272A] dark:hover:text-primary"
            }`}
          >
            <UserCheck size={12} />
            Agent
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={() => setRole("support_manager")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all duration-150 ${
              role === "support_manager"
                ? "bg-zinc-900 text-white"
                : "text-muted-base hover:bg-zinc-50 hover:text-body dark:hover:bg-[#27272A] dark:hover:text-primary"
            }`}
          >
            <UserCog size={12} />
            Manager
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border dark:border-border-dark px-3 py-2">
          <span className="text-xs text-muted dark:text-muted-dark">Theme</span>
          <ThemeToggle compact />
        </div>
      </div>
    </aside>
  );
}

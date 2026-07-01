import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle({ compact }) {
  const { theme, toggle } = useTheme();

  if (compact) {
    return (
      <button
        onClick={toggle}
        className="flex items-center justify-center rounded-lg p-2 text-zinc-500 dark:text-[#A1A1AA] hover:bg-zinc-100 hover:text-zinc-700 dark:hover:text-[#FAFAFA] transition-colors"
        title={theme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-zinc-900 dark:text-[#FAFAFA]">Theme</span>
      <button
        onClick={toggle}
        className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 bg-zinc-200"
      >
        <span className="absolute left-1 flex items-center justify-center">
          {theme === "dark" ? <Moon size={12} className="text-zinc-500 dark:text-[#A1A1AA]" /> : <Sun size={12} className="text-amber-500" />}
        </span>
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-1 ring-zinc-300 transition-transform duration-200 ${
            theme === "dark" ? "translate-x-6" : "translate-x-1"
          }`}
        />
        <span className="absolute right-1 flex items-center justify-center">
          {theme === "dark" ? <Sun size={12} className="text-amber-300" /> : <Moon size={12} className="text-zinc-400 dark:text-[#71717A]" />}
        </span>
      </button>
    </div>
  );
}

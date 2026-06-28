import { useEffect, useState } from "react";

const messages = [
  "Reply Agent generated a draft",
  "Knowledge Agent retrieved 3 documents",
  "Critical incident detected",
  "Ticket #1942 triaged",
  "Manager approved AI response",
  "Signal escalated automatically",
  "Root Cause Agent completed analysis",
];

export default function useLiveActivity() {
  const [activity, setActivity] = useState(messages);

  useEffect(() => {
    const interval = setInterval(() => {
      const random =
        messages[Math.floor(Math.random() * messages.length)];

      setActivity((prev) => [
        random,
        ...prev.slice(0, 5),
      ]);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return activity;
}
import { useEffect } from "react";
import { toast } from "sonner";

export default function DemoMode() {
  useEffect(() => {
    const events = [
      "New critical signal detected",
      "Reply Agent generated a draft",
      "Knowledge Agent found 4 documents",
      "AI response approved",
      "Customer reply sent",
    ];

    let index = 0;

    const timer = setInterval(() => {
      toast(events[index % events.length]);
      index++;
    }, 12000);

    return () => clearInterval(timer);
  }, []);

  return null;
}
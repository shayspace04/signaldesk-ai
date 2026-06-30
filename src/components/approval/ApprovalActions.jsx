import { useState } from "react";
import {
  Check,
  Pencil,
  X,
  AlertTriangle,
} from "lucide-react";

export default function ApprovalActions() {

  const [status, setStatus] = useState("Waiting");

  return (

    <div className="space-y-5">

      <div className="flex gap-4">

        <button
          onClick={() => setStatus("Approved")}
          className="rounded-xl bg-green-600 px-5 py-3 text-white font-medium hover:bg-green-500"
        >
          <Check className="inline mr-2" size={18} />

          Approve

        </button>

        <button
          onClick={() => setStatus("Editing")}
          className="rounded-xl bg-blue-600 px-5 py-3 text-white font-medium hover:bg-blue-500"
        >
          <Pencil className="inline mr-2" size={18} />

          Edit

        </button>

        <button
          onClick={() => setStatus("Rejected")}
          className="rounded-xl bg-red-600 px-5 py-3 text-white font-medium hover:bg-red-500"
        >
          <X className="inline mr-2" size={18} />

          Reject

        </button>

        <button
          onClick={() => setStatus("Escalated")}
          className="rounded-xl bg-yellow-500 px-5 py-3 text-black font-medium hover:bg-yellow-400"
        >
          <AlertTriangle className="inline mr-2" size={18} />

          Escalate

        </button>

      </div>

      <div className="rounded-xl border border-[#EFEFEF] bg-white p-4 text-sm text-zinc-700">

        Current Status

        <span className="ml-3 font-semibold text-violet-600">

          {status}

        </span>

      </div>

    </div>

  );

}

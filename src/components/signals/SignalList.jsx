import { useState } from "react";

import signalData from "@/data/signalData";

import SignalCard from "./SignalCard";
import SignalDetails from "./SignalDetails";

export default function SignalList() {

  const [selected, setSelected] = useState(signalData[0]);

  return (

    <div className="grid grid-cols-12 gap-6">

      <div className="col-span-4 space-y-4">

        {signalData.map((signal) => (

          <SignalCard

            key={signal.id}

            signal={signal}

            selected={selected.id === signal.id}

            onSelect={setSelected}

          />

        ))}

      </div>

      <div className="col-span-8">

        <SignalDetails

          signal={selected}

        />

      </div>

    </div>

  );

}
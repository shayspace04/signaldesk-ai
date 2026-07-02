import { useEffect } from "react";
import client from "../lib/lemmaClient";

export default function TestLemma() {
  useEffect(() => {
    async function init() {
      const auth = await client.initialize();
      console.log(auth);
    }

    init();
  }, []);

  return (
    <div>
      Testing Lemma...
    </div>
  );
}

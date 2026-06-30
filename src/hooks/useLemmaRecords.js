/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import client from "../lib/lemmaClient";

export function useLemmaRecords(table, options = {}) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { filters, sort, limit } = options;

  const depsKey = [table, limit, JSON.stringify(filters), JSON.stringify(sort), refreshKey].join("::");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    client.records.list(table, { filters, sort, limit })
      .then((res) => { if (mounted) setData(res.items || []); })
      .catch((err) => { if (mounted) setError(err.message || "Failed to fetch data"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [depsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refresh: () => setRefreshKey((k) => k + 1) };
}

export function useLemmaRecord(table, recordId) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    client.records.get(table, recordId)
      .then((res) => { if (mounted) setRecord(res); })
      .catch((err) => { if (mounted) setError(err.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [table, recordId]);

  return { record, loading, error };
}

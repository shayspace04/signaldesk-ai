/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import client from "../lib/lemmaClient";

export function useLemmaRecords(table, options = {}) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { filters, sort, limit } = options;

  const depsKey = [table, limit, JSON.stringify(filters), JSON.stringify(sort), refreshKey].join("::");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const queryOptions = { filters, sort, limit };
    if (refreshKey > 0) queryOptions._t = Date.now();
    client.records.list(table, queryOptions)
      .then((res) => {
        if (mounted) {
          setData(res.items || []);
          if (res.total != null) setTotal(res.total);
        }
      })
      .catch((err) => { if (mounted) setError(err.message || "Failed to fetch data"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [depsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { data, total, loading, error, refresh };
}



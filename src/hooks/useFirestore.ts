"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  doc,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useCollection<T>(
  path: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData]       = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<Error | null>(null);

  // Serialize constraints to a stable key so the effect only re-runs
  // when the actual query changes, not just the array reference.
  const constraintKey = constraints.map((c) => JSON.stringify(c)).join("|");

  useEffect(() => {
    const ref = collection(db, path);
    const q   = query(ref, ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
        setLoading(false);
      },
      (err) => {
        console.warn(`[Firestore] ${path}:`, err.message);
        setError(err);
        setLoading(false);
      }
    );

    return unsub;
  // constraintKey is the stable serialized version of constraints
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, constraintKey]);

  return { data, loading, error };
}

export function useDocument<T>(path: string, id: string) {
  const [data, setData]     = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError]   = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, path, id);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsub;
  }, [path, id]);

  return { data, loading, error };
}

export { orderBy, where };

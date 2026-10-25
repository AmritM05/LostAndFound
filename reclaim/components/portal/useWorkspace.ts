"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { emptyState, Profile } from "../../lib/types";
import { WORKSPACE_CHANGE_EVENT } from "../../services/apiClient";
import { Correspondence, getProfile, loadWorkspace } from "../../services/workspaceService";

export function useWorkspace(adminPortal = false) {
  const [user, setUser] = useState<Profile | null>(null),
    [state, setState] = useState(emptyState),
    [messages, setMessages] = useState<Correspondence[]>([]),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [lastUpdated, setLastUpdated] = useState<Date | null>(null),
    [error, setError] = useState("");
  const generation = useRef(0);
  const identity = useRef<string | null>(null);
  const flight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const lastAutomatic = useRef(0);
  const refresh = useCallback((): Promise<void> => {
    if (flight.current) {
      queued.current = true;
      return flight.current;
    }
    const request = generation.current;
    setRefreshing(true);
    const run = async () => {
      do {
        queued.current = false;
        try {
          const profile = await getProfile();
          if (request !== generation.current) return;
          // Never retain a previous account's private data after identity changes.
          if (identity.current !== profile?.id || !profile) {
            identity.current = profile?.id || null;
            setState(emptyState());
            setMessages([]);
            setLastUpdated(null);
          }
          setUser(profile);
          const next = profile && !adminPortal
            ? await loadWorkspace(profile)
            : { state: emptyState(), messages: [] };
          if (request !== generation.current) return;
          setState(next.state);
          setMessages(next.messages);
          setLastUpdated(new Date());
          setError("");
        } catch (error) {
          if (request !== generation.current) return;
          // Preserve the same account's last successful snapshot on service failure.
          setError(error instanceof Error ? error.message : "Could not refresh your workspace.");
        } finally {
          if (request === generation.current) setLoading(false);
        }
      } while (queued.current && request === generation.current);
    };
    const pending = run().finally(() => {
      if (flight.current === pending) {
        flight.current = null;
        if (request === generation.current) setRefreshing(false);
      }
    });
    flight.current = pending;
    return pending;
  }, [adminPortal]);
  useEffect(() => {
    generation.current++;
    // Effect replay/unmount invalidates earlier requests without sharing their flight.
    flight.current = null;
    queued.current = false;
    void refresh();
    const update = () => { void refresh(); };
    const automatic = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastAutomatic.current < 5000) return;
      lastAutomatic.current = Date.now();
      if (!flight.current) void refresh();
    };
    const timer = !adminPortal ? window.setInterval(automatic, 30000) : undefined;
    window.addEventListener(WORKSPACE_CHANGE_EVENT, update);
    window.addEventListener("storage", update);
    if (!adminPortal) {
      window.addEventListener("focus", automatic);
      document.addEventListener("visibilitychange", automatic);
    }
    return () => {
      generation.current++;
      window.clearInterval(timer);
      window.removeEventListener(WORKSPACE_CHANGE_EVENT, update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", automatic);
      document.removeEventListener("visibilitychange", automatic);
    };
  }, [refresh, adminPortal]);
  return { user, state, messages, loading, refreshing, lastUpdated, error, refresh };
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { emptyState, Profile } from "../../lib/types";
import { WORKSPACE_CHANGE_EVENT } from "../../services/apiClient";
import {
  Correspondence,
  getProfile,
  loadWorkspace,
} from "../../services/workspaceService";
export function useWorkspace(adminPortal = false) {
  const [user, setUser] = useState<Profile | null>(null),
    [state, setState] = useState(emptyState),
    [messages, setMessages] = useState<Correspondence[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const user = await getProfile();
      const next =
        user && !adminPortal
          ? await loadWorkspace(user)
          : { state: emptyState(), messages: [] };
      if (request !== generation.current) return;
      setUser(user);
      setState(next.state);
      setMessages(next.messages);
      setError("");
    } catch (error) {
      if (request !== generation.current) return;
      setError((error as Error).message);
      setUser(null);
      setState(emptyState());
      setMessages([]);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [adminPortal]);
  useEffect(() => {
    void refresh();
    const update = () => {
      void refresh();
    };
    window.addEventListener(WORKSPACE_CHANGE_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      generation.current++;
      window.removeEventListener(WORKSPACE_CHANGE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [refresh]);
  return { user, state, messages, loading, error, refresh };
}

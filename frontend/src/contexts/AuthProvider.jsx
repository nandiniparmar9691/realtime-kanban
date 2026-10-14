import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { socket } from "../socket.js";
import { AuthContext } from "./auth-context.js";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api("/auth/me");
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (user) {
      if (!socket.connected) socket.connect();
    } else if (socket.connected) {
      socket.disconnect();
    }
  }, [user]);

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (!socket.connected) socket.connect();
    } else if (socket.connected) {
      socket.disconnect();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

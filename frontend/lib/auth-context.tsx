"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  full_name: string;
  plan: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Paths that do not require auth (public/legal pages)
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isProtectedPage = ["/dashboard", "/transactions", "/forecast", "/settings"].some((p) =>
    pathname.startsWith(p)
  );

  const handleSessionCleanup = useCallback(() => {
    setUser(null);
    localStorage.removeItem("ff_user");
    if (typeof document !== "undefined") {
      document.cookie = "access_token_exists=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setUser(data.user);
          localStorage.setItem("ff_user", JSON.stringify(data.user));
          return data.user;
        }
      }
      
      handleSessionCleanup();
      return null;
    } catch (err) {
      console.error("Auth verification failed:", err);
      // If network fails but we already have user cached, don't lock them out.
      // But if we have no user, clean up.
      const cached = localStorage.getItem("ff_user");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
      handleSessionCleanup();
      return null;
    }
  }, [API_URL, handleSessionCleanup]);

  // Perform initial session check on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const cached = localStorage.getItem("ff_user");
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          // ignore
        }
      }

      const cookies = typeof document !== "undefined" ? document.cookie : "";
      const hasCookie = cookies.includes("access_token_exists");

      if (hasCookie) {
        const freshUser = await fetchUser();
        if (isProtectedPage && !freshUser) {
          router.push("/login");
        }
      } else {
        handleSessionCleanup();
        if (isProtectedPage) {
          router.push("/login");
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, [fetchUser, isProtectedPage, router, handleSessionCleanup]);

  // Sync auth state with path transitions
  useEffect(() => {
    if (loading) return;

    const checkRedirect = () => {
      const cookies = typeof document !== "undefined" ? document.cookie : "";
      const hasCookie = cookies.includes("access_token_exists");

      if (isProtectedPage) {
        if (!hasCookie || !user) {
          router.push("/login");
        }
      } else if (isAuthPage) {
        if (hasCookie && user) {
          router.push("/dashboard");
        }
      }
    };

    checkRedirect();
  }, [pathname, user, loading, isAuthPage, isProtectedPage, router]);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem("ff_user", JSON.stringify(userData));
    if (typeof document !== "undefined") {
      document.cookie = "access_token_exists=true; path=/; max-age=900; SameSite=Lax; Secure";
    }
    router.push("/dashboard");
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    } finally {
      handleSessionCleanup();
      toast.success("Successfully logged out");
      router.push("/login");
    }
  };

  const refresh = async () => {
    await fetchUser();
  };

  // Show full page loader/skeleton when:
  // - we are loading and on a protected route
  // - we are loading, on an auth route, and the user has a active session cookie (verifying to redirect)
  const hasCookie = typeof document !== "undefined" && document.cookie.includes("access_token_exists");
  const showLoader = loading && (isProtectedPage || (isAuthPage && hasCookie));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refresh,
      }}
    >
      {showLoader ? <AuthLoadingScreen /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen w-screen bg-[#08090A] flex flex-col items-center justify-center font-sans select-none relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />
      
      <div className="flex flex-col items-center space-y-4 z-10">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 rounded-full bg-purple-500" />
          </div>
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest animate-pulse">
          Securing session...
        </p>
      </div>
    </div>
  );
}

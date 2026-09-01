import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { startDemoSession } from "@/lib/demo.functions";

export type AppRole = "admin" | "reviewer" | "user";

const DEMO_ROLE_KEY = "iti-demo-role";

type AuthState = {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  demoMode: boolean;
  switchRole: (role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  roles: [],
  loading: true,
  demoMode: true,
  switchRole: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const starting = useRef(false);

  const beginDemo = useCallback(async (role: AppRole) => {
    if (starting.current) return;
    starting.current = true;
    try {
      const res = await startDemoSession({ data: { role } });
      await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (typeof window !== "undefined") localStorage.setItem(DEMO_ROLE_KEY, role);
    } catch (err) {
      console.error("[demo-session]", err);
      setLoading(false);
    } finally {
      starting.current = false;
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
      } else {
        const saved = (typeof window !== "undefined"
          ? localStorage.getItem(DEMO_ROLE_KEY)
          : null) as AppRole | null;
        void beginDemo(saved ?? "admin");
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [beginDemo]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let active = true;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .then(({ data }) => {
        if (!active) return;
        setRoles((data ?? []).map((r) => r.role as AppRole));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const switchRole = useCallback(
    async (role: AppRole) => {
      setLoading(true);
      await supabase.auth.signOut();
      await beginDemo(role);
    },
    [beginDemo],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        loading,
        demoMode: true,
        switchRole,
        signOut: async () => {
          await supabase.auth.signOut();
          await beginDemo("admin");
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "مسؤول النظام",
  reviewer: "مراجع",
  user: "مستخدم",
};

export function useAccess() {
  const { roles, loading, session } = useAuth();
  const isAdmin = roles.includes("admin");
  const isReviewer = roles.includes("reviewer");
  const isUser = roles.includes("user");
  return {
    loading,
    signedIn: !!session,
    roles,
    isAdmin,
    isReviewer,
    isUser,
    canEditMovements: isAdmin || isUser,
    canViewDashboard: isAdmin || isReviewer,
    canViewDistribution: isAdmin || isReviewer,
    canViewSearch: isAdmin || isReviewer,
    canViewAudit: isAdmin || isReviewer,
    canViewItems: isAdmin || isReviewer,
    canEditItems: isAdmin,
    canViewInventory: isAdmin || isReviewer,
    canEditInventory: isAdmin,
    canManageUsers: isAdmin,
  };
}

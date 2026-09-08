import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "reviewer" | "user";

export const INTERNAL_EMAIL_DOMAIN = "iti-menoufia.app";

/** يحوّل اسم المستخدم إلى بريد داخلي ثابت (لا يُعرض للمستخدم) */
export function usernameToEmail(input: string) {
  const v = input.trim().toLowerCase();
  if (v.includes("@")) return v;
  return `${v.replace(/[^a-z0-9._-]/g, "")}@${INTERNAL_EMAIL_DOMAIN}`;
}

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
  is_active: boolean;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  profile: null,
  roles: [],
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setRoles([]);
        setProfile(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let active = true;
    setLoading(true);
    (async () => {
      const [{ data: roleRows }, { data: prof }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase
          .from("profiles")
          .select("id, username, full_name, job_title, phone, is_active")
          .eq("id", uid)
          .maybeSingle(),
      ]);
      if (!active) return;
      setRoles((roleRows ?? []).map((r) => r.role as AppRole));
      setProfile((prof ?? null) as Profile | null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const signIn = useCallback(async (username: string, password: string) => {
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    const uid = data.user?.id;
    if (uid) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", uid)
        .maybeSingle();
      if (prof && prof.is_active === false) {
        await supabase.auth.signOut();
        throw new Error("هذا الحساب موقوف. راجع مسؤول النظام.");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRoles([]);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        roles,
        loading,
        signIn,
        signOut,
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
    canEditInventory: isAdmin || isReviewer,
    canManageUsers: isAdmin,
  };
}

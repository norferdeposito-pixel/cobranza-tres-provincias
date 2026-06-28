import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type CurrentUserProfile = {
  nombre: string;
  rol: string;
  permisos?: string[] | null;
  collectorName?: string;
  active?: boolean;
};

type UserProfileContextValue = {
  currentUserProfile: CurrentUserProfile | null;
  email: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  mustUpdatePassword: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextValue>({
  currentUserProfile: null,
  email: null,
  loading: true,
  isAuthenticated: false,
  mustUpdatePassword: false,
  clearPasswordRecovery: () => {},
  signOut: async () => {},
});

export const useCurrentUserProfile = () => useContext(UserProfileContext);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mustUpdatePassword, setMustUpdatePassword] = useState(false);

  const loadProfile = async (userEmail: string | null) => {
    setEmail(userEmail);
    setIsAuthenticated(!!userEmail);
    if (!userEmail) {
      setCurrentUserProfile(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("perfiles_usuarios" as any)
        .select("*")
        .eq("email", userEmail)
        .maybeSingle();
      if (error || !data) {
        setCurrentUserProfile(null);
      } else {
        const d = data as any;
        if (d.activo === false || d.active === false) {
          setCurrentUserProfile(null);
        } else {
          setCurrentUserProfile({
            nombre: d.nombre ?? "",
            rol: d.rol ?? "",
            permisos: Array.isArray(d.permisos) ? d.permisos : null,
            collectorName: d.collector_name ?? d.cobrador ?? "",
            active: d.activo ?? d.active ?? true,
          });
        }
      }
    } catch {
      setCurrentUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUserProfile(null);
    setEmail(null);
    setIsAuthenticated(false);
    setMustUpdatePassword(false);
  };

  const clearPasswordRecovery = () => setMustUpdatePassword(false);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setMustUpdatePassword(true);
      loadProfile(session?.user?.email ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      loadProfile(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserProfileContext.Provider value={{ currentUserProfile, email, loading, isAuthenticated, mustUpdatePassword, clearPasswordRecovery, signOut }}>
      {children}
    </UserProfileContext.Provider>
  );
};

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type CurrentUserProfile = {
  nombre: string;
  rol: string;
};

type UserProfileContextValue = {
  currentUserProfile: CurrentUserProfile | null;
  email: string | null;
  loading: boolean;
};

const UserProfileContext = createContext<UserProfileContextValue>({
  currentUserProfile: null,
  email: null,
  loading: true,
});

export const useCurrentUserProfile = () => useContext(UserProfileContext);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userEmail: string | null) => {
    setEmail(userEmail);
    if (!userEmail) {
      setCurrentUserProfile(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("perfiles_usuarios" as any)
        .select("nombre, rol")
        .eq("email", userEmail)
        .maybeSingle();
      if (error || !data) {
        setCurrentUserProfile(null);
      } else {
        const d = data as any;
        setCurrentUserProfile({ nombre: d.nombre ?? "", rol: d.rol ?? "" });
      }
    } catch {
      setCurrentUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
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
    <UserProfileContext.Provider value={{ currentUserProfile, email, loading }}>
      {children}
    </UserProfileContext.Provider>
  );
};

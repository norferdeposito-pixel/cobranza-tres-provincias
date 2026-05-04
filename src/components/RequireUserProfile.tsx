import { ReactNode } from "react";
import { useCurrentUserProfile } from "@/contexts/UserProfileContext";

export const RequireUserProfile = ({ children }: { children: ReactNode }) => {
  const { currentUserProfile, loading } = useCurrentUserProfile();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  if (!currentUserProfile) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="rounded-md border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Usuario no registrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta no tiene un perfil asociado. Contactá al administrador.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
};

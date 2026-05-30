import { ReactNode } from "react";
import { useCurrentUserProfile } from "@/contexts/UserProfileContext";
import { LoginScreen } from "@/components/LoginScreen";
import { PasswordRecoveryScreen } from "@/components/PasswordRecoveryScreen";
import { Button } from "@/components/ui/button";

export const RequireUserProfile = ({ children }: { children: ReactNode }) => {
  const { currentUserProfile, loading, isAuthenticated, mustUpdatePassword, signOut } = useCurrentUserProfile();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (mustUpdatePassword) {
    return <PasswordRecoveryScreen />;
  }

  if (!currentUserProfile) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="rounded-md border border-border bg-card p-8 text-center shadow-sm space-y-4">
          <h1 className="text-xl font-semibold">Usuario no registrado</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta no tiene un perfil asociado. Contactá al administrador.
          </p>
          <Button variant="outline" onClick={() => signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
};

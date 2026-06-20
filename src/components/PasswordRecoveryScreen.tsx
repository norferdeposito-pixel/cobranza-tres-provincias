import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUserProfile } from "@/contexts/UserProfileContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isCollectionsApp } from "@/lib/appBrand";

export const PasswordRecoveryScreen = () => {
  const collectionsBrand = isCollectionsApp();
  const { clearPasswordRecovery, signOut } = useCurrentUserProfile();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    clearPasswordRecovery();
    setMessage("Contraseña actualizada. Ya podés continuar.");
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-md border border-border bg-card p-7 shadow-command">
        <div className="space-y-5">
          {collectionsBrand ? (
            <div className="space-y-2 text-center">
              <img src="/gestion-san-miguel-logo.png" alt="Gestión San Miguel" className="mx-auto h-24 w-24 object-contain" />
              <p className="text-2xl font-semibold">GESTIÓN SAN MIGUEL</p>
            </div>
          ) : (
            <img src="/norfer-logo.svg" alt="NORFER - Industrias en movimiento" className="mx-auto h-auto w-full max-w-[300px]" />
          )}
          <div className="h-px bg-border" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Crear nueva contraseña</h1>
          <p className="text-sm text-muted-foreground">Ingresá una contraseña para completar la recuperación.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Nueva contraseña</Label>
          <Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required autoComplete="new-password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Repetir contraseña</Label>
          <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required autoComplete="new-password" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm font-semibold text-success">{message}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="flex-1" disabled={loading || !!message}>
            {loading ? "Guardando..." : "Guardar contraseña"}
          </Button>
          {message ? (
            <Button type="button" variant="outline" className="flex-1" onClick={() => clearPasswordRecovery()}>
              Continuar
            </Button>
          ) : (
            <Button type="button" variant="outline" className="flex-1" onClick={() => signOut()}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </main>
  );
};

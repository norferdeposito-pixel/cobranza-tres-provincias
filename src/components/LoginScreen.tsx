import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-md border border-border bg-card p-7 shadow-command"
      >
        <div className="space-y-5">
          <img src="/norfer-logo.svg" alt="NORFER - Industrias en movimiento" className="mx-auto h-auto w-full max-w-[300px]" />
          <div className="h-px bg-border" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Ingresar</h1>
          <p className="text-sm text-muted-foreground">Iniciá sesión para continuar</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>
    </main>
  );
};

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://yiovuyysgszyfltbbjpn.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_0qMU7y_oLzG5YUwxSwVwmg_cmQUUxwA";

const json = (res, status, body) => {
  res.status(status).json(body);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Metodo no permitido" });
    return;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    json(res, 500, { error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel." });
    return;
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    json(res, 401, { error: "Sesion no valida." });
    return;
  }

  const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const adminClient = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await publicClient.auth.getUser(token);
  const user = userData?.user;
  const cleanEmail = String(user?.email || "").trim().toLowerCase();
  if (userError || !user || !cleanEmail) {
    json(res, 401, { error: "Sesion no valida." });
    return;
  }

  const metadata = user.user_metadata || {};
  const profilePayload = {
    email: cleanEmail,
    nombre: String(metadata.nombre || cleanEmail.split("@")[0] || "USUARIO").trim().toLocaleUpperCase("es-AR"),
    rol: String(metadata.rol || "cobrador").trim().toLowerCase(),
    permisos: Array.isArray(metadata.permisos) ? metadata.permisos : [],
    collector_name: String(metadata.collectorName || metadata.collector_name || metadata.nombre || "").trim().toLocaleUpperCase("es-AR"),
    activo: true,
  };

  const { data: existingProfile, error: lookupError } = await adminClient
    .from("perfiles_usuarios")
    .select("email")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (lookupError) {
    json(res, 500, { error: lookupError.message });
    return;
  }

  const request = existingProfile
    ? adminClient.from("perfiles_usuarios").update(profilePayload).eq("email", cleanEmail)
    : adminClient.from("perfiles_usuarios").insert(profilePayload);

  const { error: saveError } = await request;
  if (saveError) {
    json(res, 500, { error: saveError.message });
    return;
  }

  json(res, 200, { ok: true, profile: profilePayload });
}

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://mwbhjlyuitkgunchsyht.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_9PkFScfGvzwbziQ9AJWBgQ_gNqIld9B";
const allowedRoles = new Set(["admin", "compras", "vendedor", "deposito"]);

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
  const requesterEmail = userData?.user?.email;
  if (userError || !requesterEmail) {
    json(res, 401, { error: "Sesion no valida." });
    return;
  }

  const { data: requesterProfile, error: profileError } = await adminClient
    .from("perfiles_usuarios")
    .select("rol")
    .eq("email", requesterEmail)
    .maybeSingle();

  const requesterRole = String(requesterProfile?.rol || "").toLowerCase();
  if (profileError || !["admin", "compras"].includes(requesterRole)) {
    json(res, 403, { error: "No tenes permisos para crear usuarios." });
    return;
  }

  const { nombre, email, password, rol } = req.body || {};
  const cleanNombre = String(nombre || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  const cleanRol = String(rol || "").trim().toLowerCase();

  if (!cleanNombre || !cleanEmail || !cleanPassword || !allowedRoles.has(cleanRol)) {
    json(res, 400, { error: "Completá nombre, email, contraseña y rol válido." });
    return;
  }
  if (cleanPassword.length < 6) {
    json(res, 400, { error: "La contraseña debe tener al menos 6 caracteres." });
    return;
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: cleanEmail,
    password: cleanPassword,
    email_confirm: true,
    user_metadata: { nombre: cleanNombre, rol: cleanRol },
  });

  if (createError && !createError.message.toLowerCase().includes("already registered")) {
    json(res, 400, { error: createError.message });
    return;
  }

  const { data: existingProfile } = await adminClient
    .from("perfiles_usuarios")
    .select("email")
    .eq("email", cleanEmail)
    .maybeSingle();

  const profilePayload = { email: cleanEmail, nombre: cleanNombre, rol: cleanRol };
  const profileRequest = existingProfile
    ? adminClient.from("perfiles_usuarios").update(profilePayload).eq("email", cleanEmail)
    : adminClient.from("perfiles_usuarios").insert(profilePayload);

  const { error: profileSaveError } = await profileRequest;
  if (profileSaveError) {
    json(res, 500, { error: profileSaveError.message });
    return;
  }

  json(res, 200, { ok: true, userId: createdUser?.user?.id || null });
}

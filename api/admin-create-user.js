import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://yiovuyysgszyfltbbjpn.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_0qMU7y_oLzG5YUwxSwVwmg_cmQUUxwA";
const allowedRoles = new Set(["admin", "oficina", "cobrador", "oficina_cobrador", "consulta", "compras", "vendedor", "deposito", "comercial", "produccion", "consultor", "gerencia", "administracion", "contaduria", "logistica"]);

const json = (res, status, body) => {
  res.status(status).json(body);
};

const findAuthUserByEmail = async (adminClient, email) => {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return { user: null, error };
    const user = data?.users?.find((item) => String(item.email || "").toLowerCase() === email);
    if (user) return { user, error: null };
    if (!data?.users || data.users.length < 100) break;
  }
  return { user: null, error: null };
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

  const { nombre, email, password, rol, collectorName, permisos } = req.body || {};
  const cleanNombre = String(nombre || "").trim().toLocaleUpperCase("es-AR");
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

  let { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: cleanEmail,
    password: cleanPassword,
    email_confirm: true,
    user_metadata: { nombre: cleanNombre, rol: cleanRol },
  });

  const userAlreadyExists = !!createError && createError.message.toLowerCase().includes("registered");
  if (createError && !userAlreadyExists) {
    json(res, 400, { error: createError.message });
    return;
  }
  if (userAlreadyExists) {
    const { user: existingAuthUser, error: findUserError } = await findAuthUserByEmail(adminClient, cleanEmail);
    if (findUserError) {
      json(res, 400, { error: findUserError.message });
      return;
    }
    if (!existingAuthUser?.id) {
      json(res, 400, { error: "El email ya existe, pero no se pudo encontrar el usuario para actualizar la clave." });
      return;
    }
    const { data: updatedUser, error: updateAuthError } = await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
      password: cleanPassword,
      email_confirm: true,
      user_metadata: { nombre: cleanNombre, rol: cleanRol },
    });
    if (updateAuthError) {
      json(res, 400, { error: updateAuthError.message });
      return;
    }
    createdUser = updatedUser;
  }

  const { data: existingProfile } = await adminClient
    .from("perfiles_usuarios")
    .select("email")
    .eq("email", cleanEmail)
    .maybeSingle();

  const profilePayload = {
    email: cleanEmail,
    nombre: cleanNombre,
    rol: cleanRol,
    permisos: Array.isArray(permisos) ? permisos.map((item) => String(item || "").trim()).filter(Boolean) : [],
    collector_name: String(collectorName || "").trim().toLocaleUpperCase("es-AR"),
    activo: true,
  };
  const profileRequest = existingProfile
    ? adminClient.from("perfiles_usuarios").update(profilePayload).eq("email", cleanEmail)
    : adminClient.from("perfiles_usuarios").insert(profilePayload);

  const { error: profileSaveError } = await profileRequest;
  if (profileSaveError) {
    json(res, 500, { error: profileSaveError.message });
    return;
  }

  json(res, 200, { ok: true, userId: createdUser?.user?.id || null, userAlreadyExists });
}

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "Didiermorales21@gmail.com";
const ADMIN_PASSWORD = "Arepomary2026*";
const ADMIN_NAME = "Didier Morales";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Look up the user by email
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 200,
          });
          if (listErr) throw listErr;

          const existing = list.users.find(
            (u) => (u.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase(),
          );

          let userId: string;
          let created = false;

          if (existing) {
            userId = existing.id;
            // Ensure password is current and email confirmed
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: ADMIN_PASSWORD,
              email_confirm: true,
              user_metadata: { full_name: ADMIN_NAME },
            });
          } else {
            const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
              email: ADMIN_EMAIL,
              password: ADMIN_PASSWORD,
              email_confirm: true,
              user_metadata: { full_name: ADMIN_NAME },
            });
            if (createErr || !newUser.user) throw createErr ?? new Error("No user created");
            userId = newUser.user.id;
            created = true;
          }

          // Ensure profile exists
          await supabaseAdmin
            .from("profiles")
            .upsert({ id: userId, full_name: ADMIN_NAME }, { onConflict: "id" });

          // Ensure admin role exists (idempotent)
          const { data: existingRole } = await supabaseAdmin
            .from("user_roles")
            .select("id")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          if (!existingRole) {
            await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
          }

          return Response.json({
            ok: true,
            created,
            email: ADMIN_EMAIL,
            message: created
              ? "Administrador creado correctamente."
              : "Administrador ya existía. Contraseña y rol actualizados.",
          });
        } catch (err: any) {
          return Response.json(
            { ok: false, error: err?.message ?? String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});

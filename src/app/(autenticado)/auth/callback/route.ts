// src/app/(autenticado)/auth/callback/route.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Define la redirección final como la página de login, donde el listener está activo.
  const finalRedirectPath = "/login";

  let response = NextResponse.redirect(`${origin}${finalRedirectPath}`);

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Este es el paso clave: establecer las cookies de autenticación
            request.cookies.set({
              name,
              value,
              ...options,
            });
            // Clonamos la respuesta y establecemos la cookie en la respuesta (CRÍTICO para SSR)
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: "",
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.delete(name);
          },
        },
      }
    );

    const { error, data: sessionData } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData.session) {
      const userId = sessionData.session.user.id;

      // 1. Obtener el perfil del usuario de la tabla "usuario"
      const { data: userData, error: userError } = await supabase
        .from("usuario")
        .select("id, nombre_usuario")
        .eq("id", userId)
        .single();

      if (!userError && userData) {
        const userToStore = {
          id: userData.id,
          name: userData.nombre_usuario,
        };

        // 2. Insertar el perfil en el localStorage de la respuesta (usando un header temporal)
        // Se usa el header X-Set-LocalStorage para que el cliente lo detecte al cargar la página
        response.headers.set(
          "X-Set-LocalStorage",
          JSON.stringify({ key: "examflowUser", value: userToStore })
        );
      } else {
        console.error(
          "Error al obtener datos de perfil del usuario:",
          userError
        );
      }
    }
  }

  // Redirige al login. El cliente detectará el cambio de sesión y el localStorage.
  return response;
}

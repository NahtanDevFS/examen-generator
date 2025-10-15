// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // 1. Establece la cookie en la solicitud entrante
          request.cookies.set({
            name,
            value,
            ...options,
          });
          // 2. CLONA Y ESTABLECE LA COOKIE EN LA RESPUESTA (CRÍTICO)
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

  // Refresca la sesión del usuario.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Redireccionamiento para recuperación de contraseña (ruta especial)
  if (
    !session &&
    request.nextUrl.pathname.startsWith("/update-password") &&
    request.nextUrl.hash
  ) {
    const params = new URLSearchParams(request.nextUrl.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      return NextResponse.redirect(request.nextUrl.origin + "/update-password");
    }
  }

  // Lógica de protección de rutas
  const isAuthenticated = !!session;
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (isAuthenticated && isLoginPage) {
    // Si ya está autenticado e intenta ir a /login, lo manda a la raíz.
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Si no está autenticado y NO es /login, lo manda a /login
  if (!isAuthenticated && !isLoginPage) {
    // Excluir rutas públicas o estáticas si fuera necesario
    const publicPaths = [
      "/login",
      "/update-password",
      "/auth/callback",
      "/autenticado/auth/callback",
    ]; // Añade aquí cualquier otra ruta pública si es necesario

    // Solo redirige si no está tratando de acceder a una ruta pública ya excluida
    if (!publicPaths.includes(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

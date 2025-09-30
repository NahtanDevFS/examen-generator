// middleware.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
          request.cookies.set({
            name,
            value,
            ...options,
          });
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

  // Refresca la sesión del usuario si ha expirado.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Si el usuario está en la página de recuperación y no hay sesión,
  // establece la sesión a partir del hash de la URL.
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
      // Vuelve a cargar la página para que el middleware se ejecute con la sesión ya establecida.
      return NextResponse.redirect(request.nextUrl.origin + "/update-password");
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas de petición excepto las que empiezan por:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (archivo de favicon)
     * Siéntete libre de modificar esto para adaptarlo a tus necesidades.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Define la redirección final como la página de login.
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
            // CRÍTICO: Establecer la cookie en la respuesta, como en el middleware.
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: "", ...options });
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.delete(name);
          },
        },
      }
    );

    // Intercambia el código por la sesión, las cookies se establecen arriba.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // Si no hay error, la redirección a /login se mantiene.
    if (error) {
      // Si falla, enviamos directamente a /login
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  // Redirige al login. El cliente detectará la nueva sesión y redirigirá al dashboard.
  return response;
}

// src/middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  // Obtener la sesión actual
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ["/login", "/demo", "/update-password"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Si no hay sesión y el usuario intenta acceder a una ruta protegida
  if (!session && !isPublicRoute) {
    const demoUrl = new URL("/demo", request.url);
    return NextResponse.redirect(demoUrl);
  }

  // Si hay sesión y el usuario intenta acceder a /demo, redirigir a /
  if (session && pathname === "/demo") {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

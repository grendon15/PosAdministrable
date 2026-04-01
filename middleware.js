import { NextResponse } from 'next/server'

export async function middleware(request) {
  // Por ahora, permitir todas las rutas
  // Esto es temporal para probar que las redirecciones funcionan
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
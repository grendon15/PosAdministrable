'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export default function AccesoDenegadoPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    obtenerUsuario();
  }, []);

  async function obtenerUsuario() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Acceso Denegado</h1>
          <p className="text-white/70 text-sm mt-1">No tienes permisos para acceder a esta sección</p>
        </div>
        
        <div className="p-6 text-center">
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <p className="text-gray-600 mb-2">
              Hola, <span className="font-semibold text-[#025373]">{user?.email || 'Usuario'}</span>
            </p>
            <p className="text-gray-600">
              No tienes permisos para acceder a esta sección.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Contacta al administrador si crees que deberías tener acceso.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Volver
            </button>
            <Link
              href="/dashboard"
              className="flex-1 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-colors text-center"
            >
              Ir al Inicio
            </Link>
          </div>
          
          <button
            onClick={cerrarSesion}
            className="mt-4 text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
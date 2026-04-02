'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingAnimation from '@/components/LoadingAnimation';

export default function SelectRolePage() {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [rol, setRol] = useState(null);
  const router = useRouter();

  useEffect(() => {
    verificarAcceso();
  }, []);

  async function verificarAcceso() {
    setCargando(true);
    
    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Obtener rol del usuario
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('*, roles(*)')
      .eq('id', user.id)
      .single();
    
    if (usuarioData) {
      setUsuario(usuarioData);
      setRol(usuarioData.roles?.nombre);
    }
    
    setCargando(false);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (cargando) {
    return <LoadingAnimation />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#025373] to-[#116EBF] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] p-6 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-white">🍽️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bienvenido, {usuario?.nombre || usuario?.email?.split('@')[0]}</h1>
          <p className="text-white/70 text-sm mt-1">Rol: {rol || 'Usuario'}</p>
        </div>
        
        <div className="p-8">
          <p className="text-center text-[#595959] mb-6">
            Selecciona el módulo al que deseas acceder
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dashboard - siempre visible */}
            <Link
              href="/dashboard"
              className="group bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-[#116EBF] hover:shadow-xl transition-all duration-300 text-center"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-[#116EBF] to-[#025373] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[#025373] mb-2">Dashboard Administrativo</h2>
              <p className="text-[#595959] text-sm">
                Gestión completa del restaurante
              </p>
              <div className="mt-4 text-[#116EBF] font-medium group-hover:underline">
                Acceder →
              </div>
            </Link>
            
            {/* POS - siempre visible */}
            <Link
              href="/pos"
              className="group bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-[#3BD9D9] hover:shadow-xl transition-all duration-300 text-center"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-[#3BD9D9] to-[#116EBF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[#025373] mb-2">Punto de Venta</h2>
              <p className="text-[#595959] text-sm">
                Tomar pedidos y procesar pagos
              </p>
              <div className="mt-4 text-[#3BD9D9] font-medium group-hover:underline">
                Acceder →
              </div>
            </Link>
          </div>
          
          {/* Botón cerrar sesión */}
          <div className="mt-8 text-center">
            <button
              onClick={cerrarSesion}
              className="text-sm text-[#595959] hover:text-red-500 transition-colors flex items-center gap-1 mx-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
        
        <div className="bg-[#F2F2F2] px-6 py-3 text-center">
          <p className="text-xs text-[#595959]">
            Restaurante POS - Sistema de Gestión Integral
          </p>
        </div>
      </div>
    </div>
  );
}
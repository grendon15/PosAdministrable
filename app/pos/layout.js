'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import LoadingAnimation from '@/components/LoadingAnimation';

export default function POSLayout({ children }) {
  const [cargando, setCargando] = useState(true);
  const [user, setUser] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // ✅ Función centralizada para actualizar estado
  const actualizarEstadoCaja = useCallback((estado) => {
    setCajaAbierta(estado);
    
    // Si está en /pos y la caja se cerró → redirigir
    if (!estado && pathname === '/pos') {
      router.push('/pos/caja');
    }
  }, [pathname, router]);

  // ✅ Consultar BD para saber estado real
  async function verificarCajaAbierta() {
    try {
      const { data } = await supabase
        .from('cierres_caja')
        .select('id, cerrado')
        .eq('cerrado', false)
        .maybeSingle();
      
      actualizarEstadoCaja(!!data);
    } catch (error) {
      console.error('Error verificando caja:', error);
    }
  }

  useEffect(() => {
    async function iniciar() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      await verificarCajaAbierta();
      setCargando(false);
    }
    
    iniciar();
  }, []);

  // ✅ Escuchar evento custom INMEDIATO (misma pestaña)
  useEffect(() => {
    const handleCajaCambiada = (e) => {
      console.log('🔄 Evento recibido - Caja:', e.detail.abierta ? 'Abierta' : 'Cerrada');
      actualizarEstadoCaja(e.detail.abierta);
    };

    window.addEventListener('cajaEstadoCambiado', handleCajaCambiada);
    return () => window.removeEventListener('cajaEstadoCambiado', handleCajaCambiada);
  }, [actualizarEstadoCaja]);

  // ✅ Escuchar localStorage (para sincronización entre pestañas)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'cajaAbierta') {
        const estado = e.newValue === 'true';
        console.log('🔄 Storage cambiado - Caja:', estado ? 'Abierta' : 'Cerrada');
        actualizarEstadoCaja(estado);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [actualizarEstadoCaja]);

  // ✅ Intervalo cada 3 segundos consultando BD
  useEffect(() => {
    if (cargando) return;
    
    const interval = setInterval(() => {
      verificarCajaAbierta();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [cargando]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (cargando) {
    return <LoadingAnimation />;
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <header className="bg-gradient-to-r from-[#025373] to-[#116EBF] text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            
            {/* ✅ BOTÓN POS: Solo si caja está ABIERTA */}
            {cajaAbierta && (
              <Link 
                href="/pos" 
                className={`font-medium transition-colors ${
                  pathname === '/pos' 
                    ? 'border-b-2 border-white pb-1' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                🍽️ POS
              </Link>
            )}
            
            {/* ✅ BOTÓN CAJA: Siempre visible */}
            <Link 
              href="/pos/caja" 
              className={`font-medium transition-colors ${
                pathname === '/pos/caja' 
                  ? 'border-b-2 border-white pb-1' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              💰 Caja
            </Link>

            {/* ✅ INDICADOR EN TIEMPO REAL */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
              cajaAbierta 
                ? 'bg-green-500/20 text-green-200 border border-green-500/30' 
                : 'bg-red-500/20 text-red-200 border border-red-500/30'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                cajaAbierta 
                  ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse' 
                  : 'bg-red-400'
              }`}></span>
              {cajaAbierta ? 'Caja Abierta' : 'Caja Cerrada'}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-white/80">{user?.email}</p>
              <button
                onClick={cerrarSesion}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              {user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
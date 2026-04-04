'use client';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    verificarSesion();
    
    const handleStorageChange = () => {
      verificarCajaAbierta();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      if (!cargando) {
        verificarCajaAbierta();
      }
    }, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }
    
    setUser(session.user);
    await verificarCajaAbierta();
    setCargando(false);
  }

  async function verificarCajaAbierta() {
    const fecha = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('cierres_caja')
      .select('cerrado')
      .eq('fecha', fecha)
      .eq('cerrado', false)
      .maybeSingle();
    
    const nuevaCajaAbierta = !!data;
    
    if (nuevaCajaAbierta !== cajaAbierta) {
      setCajaAbierta(nuevaCajaAbierta);
      
      // Si la caja está cerrada y estamos en /pos, redirigir a /pos/caja
      if (!nuevaCajaAbierta && pathname === '/pos') {
        router.push('/pos/caja');
      }
    }
  }

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
          <div className="flex gap-6">
            {/* Solo mostrar botón POS si la caja está abierta */}
            {cajaAbierta && (
              <Link href="/pos" className={`font-medium ${pathname === '/pos' ? 'border-b-2 border-white' : 'text-white/80 hover:text-white transition-colors'}`}>
                🍽️ POS
              </Link>
            )}
            <Link href="/pos/caja" className={`font-medium ${pathname === '/pos/caja' ? 'border-b-2 border-white' : 'text-white/80 hover:text-white transition-colors'}`}>
              💰 Caja
            </Link>
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
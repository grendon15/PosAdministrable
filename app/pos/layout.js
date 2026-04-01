'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import LoadingAnimation from '@/components/LoadingAnimation';

export default function POSLayout({ children }) {
  const [cargando, setCargando] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    verificarSesion();
  }, []);

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }
    
    setUser(session.user);
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
    <div className="min-h-screen bg-[#F2F2F2]">
      <header className="bg-gradient-to-r from-[#025373] to-[#116EBF] text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex gap-6">
            <Link href="/pos" className={`font-medium ${pathname === '/pos' ? 'border-b-2 border-white' : 'text-white/80'}`}>
              🍽️ POS
            </Link>
            <Link href="/pos/caja" className={`font-medium ${pathname === '/pos/caja' ? 'border-b-2 border-white' : 'text-white/80'}`}>
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
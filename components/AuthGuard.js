'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from './LoadingAnimation';

export default function AuthGuard({ children, requiredRole = null }) {
  const [cargando, setCargando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const router = useRouter();

  useEffect(() => {
    verificarAuth();
  }, []);

  async function verificarAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }
    
    // Si se requiere un rol específico
    if (requiredRole) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('rol_id, roles(nombre)')
        .eq('id', session.user.id)
        .single();
      
      if (usuario?.roles?.nombre !== requiredRole && requiredRole !== 'cualquiera') {
        router.push('/acceso-denegado');
        return;
      }
    }
    
    setAutorizado(true);
    setCargando(false);
  }

  if (cargando) {
    return <LoadingAnimation />;
  }

  return autorizado ? children : null;
}
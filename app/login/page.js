'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    
    console.log('1. Intentando login con:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.log('2. Error de login:', error);
        throw error;
      }
      
      console.log('3. Login exitoso, usuario:', data.user);
      
      if (data.user) {
        // TEMPORALMENTE COMENTADO - Actualizar último acceso
        // await supabase
        //   .from('usuarios')
        //   .update({ ultimo_acceso: new Date().toISOString() })
        //   .eq('id', data.user.id);
        
        console.log('4. Redirigiendo a /select-role');
        router.push('/select-role');
        console.log('5. Redirección ejecutada');
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#025373] to-[#116EBF] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] p-6 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-white">🍽️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Restaurante POS</h1>
          <p className="text-white/70 text-sm mt-1">Sistema de Gestión</p>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-[#595959] mb-2">Correo electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] focus:ring-2 focus:ring-[#3BD9D9]/20 transition-all"
                  placeholder="admin@restaurante.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#595959] mb-2">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6-4h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] focus:ring-2 focus:ring-[#3BD9D9]/20 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3 bg-gradient-to-r from-[#116EBF] to-[#025373] text-white rounded-lg hover:from-[#025373] hover:to-[#116EBF] transition-all font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Ingresando...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-[#595959]">
              Sistema de Gestión de Restaurante
            </p>
            <p className="text-xs text-[#595959] mt-1">
              v1.0.0
            </p>
          </div>
        </div>
        
        <div className="bg-[#F2F2F2] px-6 py-3 text-center">
          <p className="text-xs text-[#595959]">
            © 2024 Restaurante POS. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
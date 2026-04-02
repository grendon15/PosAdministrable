'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import LoadingAnimation from '@/components/LoadingAnimation';
import { usePermissions } from '@/hooks/usePermissions';
import NotificationCenter from '@/components/NotificationCenter';

export default function DashboardLayout({ children }) {
  const [cargando, setCargando] = useState(true);
  const [user, setUser] = useState(null);
  const [notificacionesCount, setNotificacionesCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const { puedeVer, cargando: cargandoPermisos, rolNombre } = usePermissions();

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

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const todosLosModulos = [
    { name: 'Inicio', href: '/dashboard', icon: '🏠', modulo: 'dashboard' },
    { name: 'Menú', href: '/dashboard/menu', icon: '📋', modulo: 'menu' },
    { name: 'Pedidos', href: '/dashboard/pedidos', icon: '📦', modulo: 'pedidos' },
    { name: 'Reportes', href: '/dashboard/reportes', icon: '📈', modulo: 'ventas' },
    { name: 'Inventario', href: '/dashboard/inventario', icon: '📊', modulo: 'inventario' },
    { name: 'Recetas', href: '/dashboard/recetas', icon: '👨‍🍳', modulo: 'recetas' },
    { name: 'Conteo Físico', href: '/dashboard/conteo-fisico', icon: '🔢', modulo: 'inventario' },
    { name: 'Compras', href: '/dashboard/compras', icon: '🧾', modulo: 'inventario' },
    { name: 'Cierre de Caja', href: '/dashboard/cierre-caja', icon: '💰', modulo: 'caja' },
    { name: 'Usuarios', href: '/dashboard/usuarios', icon: '👥', modulo: 'usuarios' },
    { name: 'Configuración', href: '/dashboard/configuracion', icon: '⚙️', modulo: 'configuracion' },
    { name: 'Notificaciones', href: '/dashboard/notificaciones', icon: '🔔', modulo: 'dashboard' },
  ];

  // Para administrador, mostrar todos los módulos
  const menuItems = rolNombre === 'Administrador' 
    ? todosLosModulos 
    : todosLosModulos.filter(item => puedeVer(item.modulo));

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (cargando || cargandoPermisos) {
    return <LoadingAnimation />;
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2] flex">
      {/* Sidebar */}
      <aside className="hidden md:block w-72 bg-white shadow-lg fixed h-full overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#116EBF] rounded-lg flex items-center justify-center">
              <span className="text-white text-xl font-bold">R</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#025373]">Restaurante</h1>
              <p className="text-xs text-[#595959]">Dashboard Administrativo</p>
              <p className="text-xs text-[#3BD9D9] mt-1">Rol: {rolNombre}</p>
            </div>
          </div>
        </div>
        <nav className="p-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all ${
                pathname === item.href
                  ? 'bg-[#116EBF] text-white shadow-md'
                  : 'text-[#595959] hover:bg-[#F2F2F2] hover:text-[#116EBF]'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Botón mobile */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <svg className="w-6 h-6 text-[#116EBF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar mobile */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed top-0 left-0 w-72 bg-white shadow-lg z-50 h-full overflow-y-auto md:hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#116EBF] rounded-lg flex items-center justify-center">
                  <span className="text-white text-xl font-bold">R</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#025373]">Restaurante</h1>
                  <p className="text-xs text-[#595959]">Dashboard Administrativo</p>
                  <p className="text-xs text-[#3BD9D9] mt-1">Rol: {rolNombre}</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-[#595959]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="p-4">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all ${
                    pathname === item.href
                      ? 'bg-[#116EBF] text-white shadow-md'
                      : 'text-[#595959] hover:bg-[#F2F2F2] hover:text-[#116EBF]'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
            </nav>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-72">
        {/* Header con notificaciones */}
        <div className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-100">
          <div className="px-6 py-3 flex justify-end items-center gap-4">
            <NotificationCenter onNotificationCount={setNotificacionesCount} />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-[#025373]">{user?.email}</p>
                <p className="text-xs text-[#3BD9D9]">Rol: {rolNombre}</p>
                <button
                  onClick={cerrarSesion}
                  className="text-xs text-[#595959] hover:text-red-500 transition-colors"
                >
                  Cerrar sesión
                </button>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#116EBF] text-white flex items-center justify-center">
                {user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardHome() {
  const [stats, setStats] = useState({
    productos: 0,
    pedidosHoy: 0,
    ventasHoy: 0
  });

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  async function cargarEstadisticas() {
    // Contar productos
    const { count: productosCount } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true });
    
    // Contar pedidos de hoy
    const hoy = new Date().toISOString().split('T')[0];
    const { count: pedidosCount } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hoy);
    
    setStats({
      productos: productosCount || 0,
      pedidosHoy: pedidosCount || 0,
      ventasHoy: 0
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-500 text-sm">Productos</div>
          <div className="text-3xl font-bold">{stats.productos}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-500 text-sm">Pedidos hoy</div>
          <div className="text-3xl font-bold">{stats.pedidosHoy}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-500 text-sm">Ventas hoy</div>
          <div className="text-3xl font-bold">${stats.ventasHoy.toLocaleString()}</div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-4">Bienvenido al panel de administración</h2>
        <p className="text-gray-600">
          Desde aquí puedes gestionar el menú, ver pedidos, administrar inventario y más.
          Usa el menú lateral para navegar entre las secciones.
        </p>
      </div>
    </div>
  );
}
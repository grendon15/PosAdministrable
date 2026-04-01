'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';

export default function NotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    cargarNotificaciones();
    suscribirseNotificaciones();
    
    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
    setTimeout(() => setNotificacion({ show: false, message: '', type: 'success' }), 3000);
  };

  async function cargarNotificaciones() {
    setCargando(true);
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false });
    
    setNotificaciones(data || []);
    setCargando(false);
  }

  function suscribirseNotificaciones() {
    const channel = supabase
      .channel('notificaciones-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        (payload) => {
          setNotificaciones(prev => [payload.new, ...prev]);
          mostrarNotificacion('Nueva notificación recibida', 'success');
        }
      )
      .subscribe();
    
    return () => supabase.removeChannel(channel);
  }

  async function marcarComoLeida(id) {
    await supabase
      .from('notificaciones')
      .update({ leido: true })
      .eq('id', id);
    
    setNotificaciones(prev =>
      prev.map(n => n.id === id ? { ...n, leido: true } : n)
    );
  }

  async function marcarTodasComoLeidas() {
    const idsNoLeidas = notificaciones.filter(n => !n.leido).map(n => n.id);
    if (idsNoLeidas.length === 0) return;
    
    await supabase
      .from('notificaciones')
      .update({ leido: true })
      .in('id', idsNoLeidas);
    
    setNotificaciones(prev =>
      prev.map(n => ({ ...n, leido: true }))
    );
    mostrarNotificacion('Todas las notificaciones marcadas como leídas', 'success');
  }

  async function eliminarNotificacion(id) {
    await supabase.from('notificaciones').delete().eq('id', id);
    setNotificaciones(prev => prev.filter(n => n.id !== id));
    mostrarNotificacion('Notificación eliminada', 'success');
  }

  function getIcono(tipo) {
    switch (tipo) {
      case 'pedido_nuevo': return '📦';
      case 'stock_bajo': return '⚠️';
      case 'pedido_listo': return '✅';
      default: return '🔔';
    }
  }

  function getColor(tipo) {
    switch (tipo) {
      case 'pedido_nuevo': return 'border-l-4 border-blue-500';
      case 'stock_bajo': return 'border-l-4 border-red-500';
      case 'pedido_listo': return 'border-l-4 border-green-500';
      default: return 'border-l-4 border-gray-400';
    }
  }

  function formatearFecha(fecha) {
    const notifDate = new Date(fecha);
    return notifDate.toLocaleString('es-CO');
  }

  if (cargando) {
    return <LoadingAnimation />;
  }

  return (
    <div className="space-y-6">
      {/* Notificación flotante */}
      {notificacion.show && (
        <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
          <div className={`rounded-xl shadow-2xl p-4 flex items-center gap-3 min-w-[320px] ${
            notificacion.type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'
          }`}>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">{notificacion.message}</p>
            </div>
            <button onClick={() => setNotificacion({ show: false, message: '', type: 'success' })} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] rounded-2xl p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">🔔 Centro de Notificaciones</h1>
            <p className="text-white/80 mt-1">Historial de notificaciones y alertas del sistema</p>
          </div>
          <button
            onClick={marcarTodasComoLeidas}
            className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-sm"
          >
            Marcar todas como leídas
          </button>
        </div>
      </div>

      {/* Lista de notificaciones */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {notificaciones.length === 0 ? (
          <div className="text-center py-12 text-[#595959]">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p>No hay notificaciones</p>
            <p className="text-sm mt-1">Las notificaciones aparecerán aquí cuando ocurran eventos importantes</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notificaciones.map(notif => (
              <div
                key={notif.id}
                className={`p-5 hover:bg-[#F2F2F2] transition-colors ${!notif.leido ? 'bg-blue-50/20' : ''} ${getColor(notif.tipo)}`}
              >
                <div className="flex gap-4">
                  <div className="text-3xl">{getIcono(notif.tipo)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`font-semibold text-lg ${!notif.leido ? 'text-[#116EBF]' : 'text-[#025373]'}`}>
                          {notif.titulo}
                        </p>
                        <p className="text-sm text-[#595959] mt-1">{notif.mensaje}</p>
                        {notif.data && (
                          <div className="mt-2 text-xs text-[#595959] bg-[#F2F2F2] p-2 rounded-lg inline-block">
                            {notif.data.pedido_id && <span>Pedido ID: {notif.data.pedido_id}</span>}
                            {notif.data.total && <span className="ml-2">Total: ${notif.data.total}</span>}
                            {notif.data.stock_actual && <span>Stock: {notif.data.stock_actual} | Mínimo: {notif.data.stock_minimo}</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#595959]">{formatearFecha(notif.created_at)}</p>
                        <div className="flex gap-2 mt-2">
                          {!notif.leido && (
                            <button
                              onClick={() => marcarComoLeida(notif.id)}
                              className="text-xs text-[#116EBF] hover:text-[#025373]"
                            >
                              Marcar como leída
                            </button>
                          )}
                          <button
                            onClick={() => eliminarNotificacion(notif.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
      `}</style>
    </div>
  );
}
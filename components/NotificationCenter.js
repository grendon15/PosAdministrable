'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NotificationCenter({ onNotificationCount }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [mostrarPanel, setMostrarPanel] = useState(false);

  useEffect(() => {
    cargarNotificaciones();
    suscribirseNotificaciones();
    
    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  async function cargarNotificaciones() {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      setNotificaciones(data);
      const noLeidasCount = data.filter(n => !n.leido).length;
      setNoLeidas(noLeidasCount);
      if (onNotificationCount) onNotificationCount(noLeidasCount);
    }
  }

  function suscribirseNotificaciones() {
    const channel = supabase
      .channel('notificaciones-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        (payload) => {
          const nuevaNotificacion = payload.new;
          setNotificaciones(prev => [nuevaNotificacion, ...prev]);
          setNoLeidas(prev => prev + 1);
          if (onNotificationCount) onNotificationCount(noLeidas + 1);
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
    const nuevasNoLeidas = notificaciones.filter(n => n.id !== id ? !n.leido : false).length;
    setNoLeidas(nuevasNoLeidas);
    if (onNotificationCount) onNotificationCount(nuevasNoLeidas);
  }

  function getIcono(tipo) {
    switch (tipo) {
      case 'pedido_nuevo': return '📦';
      case 'stock_bajo': return '⚠️';
      default: return '🔔';
    }
  }

  function formatearFecha(fecha) {
    const ahora = new Date();
    const notifDate = new Date(fecha);
    const diffMins = Math.floor((ahora - notifDate) / 60000);
    
    if (diffMins < 1) return 'Hace unos segundos';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)} h`;
    return notifDate.toLocaleDateString();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMostrarPanel(!mostrarPanel)}
        className="relative p-2 text-[#595959] hover:text-[#116EBF] transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {mostrarPanel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMostrarPanel(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#025373] to-[#116EBF]">
              <h3 className="font-semibold text-white">Notificaciones</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notificaciones.length === 0 ? (
                <div className="text-center py-8 text-[#595959]">
                  <p>No hay notificaciones</p>
                </div>
              ) : (
                notificaciones.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-gray-100 hover:bg-[#F2F2F2] transition-colors cursor-pointer ${!notif.leido ? 'bg-blue-50/30' : ''}`}
                    onClick={() => marcarComoLeida(notif.id)}
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl">{getIcono(notif.tipo)}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className={`font-semibold ${!notif.leido ? 'text-[#116EBF]' : 'text-[#025373]'}`}>
                            {notif.titulo}
                          </p>
                          <span className="text-xs text-[#595959]">{formatearFecha(notif.created_at)}</span>
                        </div>
                        <p className="text-sm text-[#595959] mt-1">{notif.mensaje}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
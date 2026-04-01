'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function CierreCajaDashboardPage() {
  const [cargando, setCargando] = useState(true);
  const [cierres, setCierres] = useState([]);
  // Inicializamos con la fecha de hoy
  const [filtroFecha, setFiltroFecha] = useState(new Date().toISOString().split('T')[0]);
  const [modalDetalle, setModalDetalle] = useState({ open: false, cierre: null, movimientos: [] });
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Permisos
  const { puedeVer, puedeEditar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('caja');
  const puedeExportar = puedeEditar('caja');

  useEffect(() => {
    if (tienePermiso) {
      // Cargamos automáticamente los datos del día actual al iniciar
      buscarCierres();
    } else {
      setCargando(false);
    }
  }, [tienePermiso]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  // Función para ejecutar la búsqueda manual
  async function buscarCierres() {
    setCargando(true);
    
    try {
      let query = supabase
        .from('cierres_caja')
        .select('*')
        .order('fecha', { ascending: false });

      // Si hay una fecha seleccionada, filtramos en el servidor
      if (filtroFecha) {
        query = query.eq('fecha', filtroFecha);
      } else {
        // Si no hay fecha, traemos los últimos 50 (opcional)
        query = query.limit(50);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setCierres(data || []);
      
      if (data && data.length === 0 && filtroFecha) {
        mostrarNotificacion('No se encontraron cierres para esta fecha', 'info');
      }
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al cargar los cierres', 'error');
    } finally {
      setCargando(false);
    }
  }

  // Función para restablecer filtro al día de hoy
  function restablecerFiltro() {
    const hoy = new Date().toISOString().split('T')[0];
    setFiltroFecha(hoy);
    // Forzamos la búsqueda con el nuevo valor ya que el estado es asíncrono
    ejecutarBusquedaConFecha(hoy);
  }

  // Helper para ejecutar búsqueda con fecha específica
  async function ejecutarBusquedaConFecha(fecha) {
    setCargando(true);
    const { data } = await supabase
      .from('cierres_caja')
      .select('*')
      .eq('fecha', fecha)
      .order('fecha', { ascending: false });
    
    setCierres(data || []);
    setCargando(false);
  }

  async function verDetalleCierre(cierre) {
    const { data: movimientos } = await supabase
      .from('movimientos_caja')
      .select('*')
      .eq('cierre_id', cierre.id)
      .order('created_at', { ascending: false });
    
    setModalDetalle({ open: true, cierre, movimientos: movimientos || [] });
  }

  async function exportarReporte() {
    if (!puedeExportar) {
      mostrarNotificacion('No tienes permisos para exportar reportes', 'error');
      return;
    }
    
    try {
      const fecha = new Date().toISOString().split('T')[0];
      let csvContent = "Fecha,Fondo Inicial,Ventas Efectivo,Ventas Tarjeta,Ventas Transferencia,Ventas Total,Efectivo Contado,Diferencia,Observaciones,Estado\n";
      
      // Usamos los cierres ya cargados y filtrados
      cierres.forEach(cierre => {
        csvContent += `${cierre.fecha},`;
        csvContent += `${cierre.apertura},`;
        csvContent += `${cierre.ventas_efectivo || 0},`;
        csvContent += `${cierre.ventas_tarjeta || 0},`;
        csvContent += `${cierre.ventas_transferencia || 0},`;
        csvContent += `${cierre.ventas_total || 0},`;
        csvContent += `${cierre.efectivo_contado || 0},`;
        csvContent += `${cierre.diferencia || 0},`;
        csvContent += `"${cierre.observaciones || ''}",`;
        csvContent += `${cierre.cerrado ? 'Cerrado' : 'Abierto'}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte_cierres_${filtroFecha || 'historico'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      mostrarNotificacion('Reporte exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al exportar reporte', 'error');
    }
  }

  if (!cargandoPermisos && !tienePermiso) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#025373] mb-2">Acceso Denegado</h2>
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Cierre de Caja.</p>
        </div>
      </div>
    );
  }

  if (cargando || cargandoPermisos) {
    return <LoadingAnimation />;
  }

  return (
    <div className="space-y-6">
      <NotificationToast
        show={notificacion.show}
        message={notificacion.message}
        type={notificacion.type}
        onClose={() => setNotificacion({ show: false, message: '', type: 'success' })}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold">💰 Reporte de Cierres de Caja</h1>
        <p className="text-white/80 mt-1">Consulta y exporta el historial de cierres realizados por los cajeros</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-end justify-between">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Filtrar por fecha</label>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
            />
          </div>
          
          <button
            onClick={buscarCierres}
            className="px-6 py-2 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-colors flex items-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Consultar
          </button>

          <button
            onClick={restablecerFiltro}
            className="px-4 py-2 text-[#595959] border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            Hoy
          </button>
        </div>
        
        {puedeExportar && (
          <button
            onClick={exportarReporte}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar CSV
          </button>
        )}
      </div>

      {/* Tabla de cierres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F2F2F2] border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-5 text-[#025373] font-semibold">Fecha</th>
                <th className="text-right py-4 px-5 text-[#025373] font-semibold">Fondo Inicial</th>
                <th className="text-right py-4 px-5 text-[#025373] font-semibold">Ventas Efectivo</th>
                <th className="text-right py-4 px-5 text-[#025373] font-semibold">Ventas Total</th>
                <th className="text-right py-4 px-5 text-[#025373] font-semibold">Efectivo Contado</th>
                <th className="text-right py-4 px-5 text-[#025373] font-semibold">Diferencia</th>
                <th className="text-center py-4 px-5 text-[#025373] font-semibold">Estado</th>
                <th className="text-center py-4 px-5 text-[#025373] font-semibold">Acciones</th>
              </tr> {/* <-- CORRECCIÓN: Etiqueta </tr> agregada */}
            </thead>
            <tbody>
              {cierres.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-[#595959]">
                    No hay cierres registrados. Seleccione una fecha y presione Consultar.
                  </td>
                </tr>
              ) : (
                cierres.map(cierre => (
                  <tr key={cierre.id} className="border-b border-gray-100 hover:bg-[#F2F2F2] transition-colors">
                    <td className="py-4 px-5 text-[#595959]">{new Date(cierre.fecha).toLocaleDateString('es-CO')}</td>
                    <td className="py-4 px-5 text-right">${cierre.apertura?.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right">${cierre.ventas_efectivo?.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-semibold">${cierre.ventas_total?.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right">${cierre.efectivo_contado?.toLocaleString()}</td>
                    <td className={`py-4 px-5 text-right font-semibold ${
                      cierre.diferencia === 0 ? 'text-green-600' : cierre.diferencia > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {cierre.diferencia > 0 ? '+' : ''}{cierre.diferencia?.toLocaleString()}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        cierre.cerrado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {cierre.cerrado ? 'Cerrado' : 'Abierto'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <button
                        onClick={() => verDetalleCierre(cierre)}
                        className="px-3 py-1.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] text-sm"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-[#F2F2F2] border-t border-gray-200 text-sm text-[#595959]">
          Mostrando {cierres.length} cierre(s)
        </div>
      </div>

      {/* MODAL DE DETALLE DE CIERRE */}
      {modalDetalle.open && modalDetalle.cierre && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">📋 Detalle de Cierre</h3>
                  <p className="text-white/70 text-sm mt-1">
                    {new Date(modalDetalle.cierre.fecha).toLocaleDateString('es-CO')}
                  </p>
                </div>
                <button onClick={() => setModalDetalle({ open: false, cierre: null, movimientos: [] })} className="text-white/70 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs text-[#595959]">Fondo inicial</p>
                  <p className="text-lg font-bold text-[#025373]">${modalDetalle.cierre.apertura?.toLocaleString()}</p>
                </div>
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs text-[#595959]">Total ventas</p>
                  <p className="text-lg font-bold text-[#025373]">${modalDetalle.cierre.ventas_total?.toLocaleString()}</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-[#025373] mb-3">📊 Desglose de Ventas</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Efectivo:</span>
                    <span>${modalDetalle.cierre.ventas_efectivo?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Tarjeta:</span>
                    <span>${modalDetalle.cierre.ventas_tarjeta?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Transferencia:</span>
                    <span>${modalDetalle.cierre.ventas_transferencia?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {modalDetalle.movimientos.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-[#025373] mb-3">💰 Movimientos de Caja</h4>
                  <div className="space-y-2">
                    {modalDetalle.movimientos.map(mov => (
                      <div key={mov.id} className="flex justify-between items-center p-2 bg-[#F2F2F2] rounded">
                        <div>
                          <p className="text-sm font-medium">{mov.concepto}</p>
                          <p className="text-xs text-[#595959]">{new Date(mov.created_at).toLocaleTimeString()}</p>
                        </div>
                        <span className={mov.tipo === 'ingreso' ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                          {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#F2F2F2] rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-[#595959]">Efectivo esperado:</span>
                  <span className="font-semibold">${(
                    modalDetalle.cierre.apertura + 
                    modalDetalle.cierre.ventas_efectivo + 
                    (modalDetalle.movimientos?.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0) || 0) - 
                    (modalDetalle.movimientos?.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0) || 0)
                  ).toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-[#595959]">Efectivo contado:</span>
                  <span className="font-semibold">${modalDetalle.cierre.efectivo_contado?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="font-bold text-[#025373]">Diferencia:</span>
                  <span className={`text-xl font-bold ${
                    modalDetalle.cierre.diferencia === 0 ? 'text-green-600' : 
                    modalDetalle.cierre.diferencia > 0 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {modalDetalle.cierre.diferencia > 0 ? '+' : ''}{modalDetalle.cierre.diferencia?.toLocaleString()}
                  </span>
                </div>
              </div>

              {modalDetalle.cierre.observaciones && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-yellow-700 font-medium">Observaciones:</p>
                  <p className="text-sm text-yellow-800">{modalDetalle.cierre.observaciones}</p>
                </div>
              )}

              <div className="text-xs text-[#595959] text-center">
                Cierre realizado por: {modalDetalle.cierre.usuario_nombre || 'Administrador'}<br/>
                Fecha cierre: {new Date(modalDetalle.cierre.cerrado_at).toLocaleString('es-CO')}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalDetalle({ open: false, cierre: null, movimientos: [] })} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
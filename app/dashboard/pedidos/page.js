'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidosFiltrados, setPedidosFiltrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [detallesPedido, setDetallesPedido] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Estados para filtros
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  
  // Permisos
  const { puedeVer, puedeEditar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('pedidos');
  const puedeCambiarEstado = puedeEditar('pedidos');

  useEffect(() => {
    if (tienePermiso) {
      cargarPedidos();
    } else {
      setCargando(false);
    }
  }, [tienePermiso]);

  useEffect(() => {
    filtrarPedidos();
  }, [pedidos, filtroFechaInicio, filtroFechaFin, filtroEstado, filtroBusqueda]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function cargarPedidos() {
    setCargando(true);
    
    const { data: pedidosData, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error cargando pedidos:', error);
      mostrarNotificacion('Error al cargar pedidos', 'error');
    } else {
      setPedidos(pedidosData || []);
    }
    
    setCargando(false);
  }

  async function cargarDetallesPedido(pedidoId) {
    const { data: detalles, error } = await supabase
      .from('detalles_pedido')
      .select(`
        *,
        productos (id, nombre, precio_venta)
      `)
      .eq('pedido_id', pedidoId);
    
    if (!error) {
      setDetallesPedido(detalles || []);
    }
  }

  async function cambiarEstadoPedido(pedidoId, nuevoEstado, numeroPedido) {
    if (!puedeCambiarEstado) {
      mostrarNotificacion('No tienes permisos para cambiar el estado de pedidos', 'error');
      return;
    }
    
    const updateData = {
      estado: nuevoEstado,
      updated_at: new Date().toISOString()
    };
    
    if (nuevoEstado === 'pagado') {
      updateData.pagado_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('pedidos')
      .update(updateData)
      .eq('id', pedidoId);
    
    if (error) {
      mostrarNotificacion('Error al cambiar estado', 'error');
    } else {
      const mensaje = `Pedido ${numeroPedido} marcado como ${
        nuevoEstado === 'pagado' ? 'pagado' : nuevoEstado === 'cancelado' ? 'cancelado' : 'pendiente'
      }`;
      mostrarNotificacion(mensaje, 'success');
      cargarPedidos();
      if (pedidoSeleccionado?.id === pedidoId) {
        setPedidoSeleccionado(null);
        setModalAbierto(false);
      }
    }
  }

  function filtrarPedidos() {
    let filtrados = [...pedidos];
    
    if (filtroFechaInicio) {
      filtrados = filtrados.filter(p => new Date(p.created_at) >= new Date(filtroFechaInicio));
    }
    if (filtroFechaFin) {
      filtrados = filtrados.filter(p => new Date(p.created_at) <= new Date(filtroFechaFin + 'T23:59:59'));
    }
    if (filtroEstado) {
      filtrados = filtrados.filter(p => p.estado === filtroEstado);
    }
    if (filtroBusqueda) {
      filtrados = filtrados.filter(p => 
        (p.numero_pedido && p.numero_pedido.toLowerCase().includes(filtroBusqueda.toLowerCase())) ||
        (p.mesa && p.mesa.toLowerCase().includes(filtroBusqueda.toLowerCase()))
      );
    }
    
    setPedidosFiltrados(filtrados);
  }

  function verDetallePedido(pedido) {
    setPedidoSeleccionado(pedido);
    cargarDetallesPedido(pedido.id);
    setModalAbierto(true);
  }

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      case 'pagado': return 'bg-green-100 text-green-800';
      case 'cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoIcono = (estado) => {
    switch (estado) {
      case 'pendiente': return '⏳';
      case 'pagado': return '✅';
      case 'cancelado': return '❌';
      default: return '📋';
    }
  };

  const getTipoIcono = (tipo) => {
    switch (tipo) {
      case 'mesa': return '🍽️';
      case 'para_llevar': return '🛍️';
      case 'domicilio': return '🏠';
      default: return '📋';
    }
  };

  // Si no tiene permisos, mostrar mensaje de acceso denegado
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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Pedidos.</p>
          <p className="text-sm text-[#595959] mt-2">Contacta al administrador si crees que deberías tener acceso.</p>
        </div>
      </div>
    );
  }

  if (cargando || cargandoPermisos) {
    return <LoadingAnimation />;
  }

  return (
    <div className="space-y-6">
      {/* Notificación profesional */}
      <NotificationToast
        show={notificacion.show}
        message={notificacion.message}
        type={notificacion.type}
        onClose={() => setNotificacion({ show: false, message: '', type: 'success' })}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold">📦 Historial de Pedidos</h1>
        <p className="text-white/80 mt-1">Visualiza y gestiona todos los pedidos del restaurante</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Fecha inicio</label>
            <input
              type="date"
              value={filtroFechaInicio}
              onChange={(e) => setFiltroFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Fecha fin</label>
            <input
              type="date"
              value={filtroFechaFin}
              onChange={(e) => setFiltroFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
            >
              <option value="">Todos</option>
              <option value="pendiente">⏳ Pendiente</option>
              <option value="pagado">✅ Pagado</option>
              <option value="cancelado">❌ Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Buscar</label>
            <div className="relative">
              <input
                type="text"
                placeholder="N° pedido o mesa..."
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
        {(filtroFechaInicio || filtroFechaFin || filtroEstado || filtroBusqueda) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setFiltroFechaInicio('');
                setFiltroFechaFin('');
                setFiltroEstado('');
                setFiltroBusqueda('');
              }}
              className="text-sm text-[#116EBF] hover:text-[#025373]"
            >
              Limpiar filtros ✖
            </button>
          </div>
        )}
      </div>

      {/* Resumen de pedidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500">
          <p className="text-sm text-[#595959]">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600">{pedidos.filter(p => p.estado === 'pendiente').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <p className="text-sm text-[#595959]">Pagados</p>
          <p className="text-2xl font-bold text-green-600">{pedidos.filter(p => p.estado === 'pagado').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500">
          <p className="text-sm text-[#595959]">Cancelados</p>
          <p className="text-2xl font-bold text-red-600">{pedidos.filter(p => p.estado === 'cancelado').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#116EBF]">
          <p className="text-sm text-[#595959]">Total recaudado</p>
          <p className="text-2xl font-bold text-[#116EBF]">
            ${pedidos.filter(p => p.estado === 'pagado').reduce((sum, p) => sum + (p.total_neto || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabla de pedidos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F2F2F2] border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-5 text-[#025373] font-semibold">N° Pedido</th>
                <th className="text-left py-4 px-5 text-[#025373] font-semibold">Mesa/Tipo</th>
                <th className="text-left py-4 px-5 text-[#025373] font-semibold">Fecha</th>
                <th className="text-right py-4 px-5 text-[#025373] font-semibold">Total Bruto</th>
                <th className="text-right py-4 px-5 text-[#025373] font-semibold">Total Neto</th>
                <th className="text-center py-4 px-5 text-[#025373] font-semibold">Estado</th>
                <th className="text-center py-4 px-5 text-[#025373] font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-[#595959]">
                    No hay pedidos que coincidan con los filtros
                  </td>
                </tr>
              ) : (
                pedidosFiltrados.map(pedido => (
                  <tr key={pedido.id} className="border-b border-gray-100 hover:bg-[#F2F2F2] transition-colors group">
                    <td className="py-4 px-5 font-mono font-semibold text-[#025373]">{pedido.numero_pedido || `PED-${pedido.id}`}</td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <span>{getTipoIcono(pedido.tipo)}</span>
                        <span>{pedido.mesa || (pedido.tipo === 'para_llevar' ? 'Para llevar' : pedido.tipo === 'domicilio' ? 'Domicilio' : 'Mesa')}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-[#595959]">
                      {new Date(pedido.created_at).toLocaleDateString('es-CO')}
                      <div className="text-xs text-gray-400">
                        {new Date(pedido.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right text-[#595959]">${pedido.total_bruto?.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-semibold text-[#116EBF]">${pedido.total_neto?.toLocaleString()}</td>
                    <td className="py-4 px-5 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(pedido.estado)}`}>
                        {getEstadoIcono(pedido.estado)} {pedido.estado === 'pendiente' ? 'Pendiente' : pedido.estado === 'pagado' ? 'Pagado' : 'Cancelado'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => verDetallePedido(pedido)}
                          className="p-1.5 text-[#116EBF] hover:bg-[#116EBF]/10 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {puedeCambiarEstado && pedido.estado === 'pendiente' && (
                          <>
                            <button
                              onClick={() => cambiarEstadoPedido(pedido.id, 'pagado', pedido.numero_pedido)}
                              className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                              title="Marcar como pagado"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => cambiarEstadoPedido(pedido.id, 'cancelado', pedido.numero_pedido)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancelar pedido"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                        {puedeCambiarEstado && pedido.estado === 'pagado' && (
                          <button
                            onClick={() => cambiarEstadoPedido(pedido.id, 'pendiente', pedido.numero_pedido)}
                            className="p-1.5 text-yellow-500 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Revertir a pendiente"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-[#F2F2F2] border-t border-gray-200 text-sm text-[#595959]">
          Mostrando {pedidosFiltrados.length} de {pedidos.length} pedidos
        </div>
      </div>

      {/* MODAL DETALLE DEL PEDIDO */}
      {modalAbierto && pedidoSeleccionado && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">Detalle del Pedido</h3>
                  <p className="text-white/70 text-sm mt-1">{pedidoSeleccionado.numero_pedido || `PED-${pedidoSeleccionado.id}`}</p>
                </div>
                <button
                  onClick={() => {
                    setModalAbierto(false);
                    setPedidoSeleccionado(null);
                    setDetallesPedido([]);
                  }}
                  className="text-white/70 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Información general */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs text-[#595959]">Mesa / Tipo</p>
                  <p className="font-semibold text-[#025373] flex items-center gap-2">
                    <span>{getTipoIcono(pedidoSeleccionado.tipo)}</span>
                    {pedidoSeleccionado.mesa || (pedidoSeleccionado.tipo === 'para_llevar' ? 'Para llevar' : pedidoSeleccionado.tipo === 'domicilio' ? 'Domicilio' : 'Mesa')}
                  </p>
                </div>
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs text-[#595959]">Fecha</p>
                  <p className="font-semibold text-[#025373]">
                    {new Date(pedidoSeleccionado.created_at).toLocaleDateString('es-CO')}
                    <span className="text-sm text-[#595959] ml-2">
                      {new Date(pedidoSeleccionado.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </p>
                </div>
              </div>

              {/* Estado actual */}
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-[#595959]">Estado actual:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEstadoColor(pedidoSeleccionado.estado)}`}>
                  {getEstadoIcono(pedidoSeleccionado.estado)} {pedidoSeleccionado.estado === 'pendiente' ? 'Pendiente' : pedidoSeleccionado.estado === 'pagado' ? 'Pagado' : 'Cancelado'}
                </span>
                {puedeCambiarEstado && pedidoSeleccionado.estado === 'pendiente' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => cambiarEstadoPedido(pedidoSeleccionado.id, 'pagado', pedidoSeleccionado.numero_pedido)}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm flex items-center gap-1"
                    >
                      ✅ Marcar pagado
                    </button>
                    <button
                      onClick={() => cambiarEstadoPedido(pedidoSeleccionado.id, 'cancelado', pedidoSeleccionado.numero_pedido)}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm flex items-center gap-1"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                )}
              </div>

              {/* Tabla de productos */}
              <div>
                <h4 className="font-semibold text-[#025373] mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Productos
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[#F2F2F2]">
                      <tr>
                        <th className="text-left py-2 px-4 text-sm text-[#025373]">Producto</th>
                        <th className="text-center py-2 px-4 text-sm text-[#025373]">Cantidad</th>
                        <th className="text-right py-2 px-4 text-sm text-[#025373]">Precio Unit.</th>
                        <th className="text-right py-2 px-4 text-sm text-[#025373]">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detallesPedido.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-6 text-[#595959]">Cargando productos...</td>
                        </tr>
                      ) : (
                        detallesPedido.map(detalle => (
                          <tr key={detalle.id} className="border-b border-gray-100">
                            <td className="py-2 px-4 text-[#025373]">{detalle.productos?.nombre || 'Producto'}</td>
                            <td className="text-center py-2 px-4 text-[#595959]">{detalle.cantidad}</td>
                            <td className="text-right py-2 px-4 text-[#595959]">${detalle.precio_unitario?.toLocaleString()}</td>
                            <td className="text-right py-2 px-4 font-semibold text-[#116EBF]">${detalle.subtotal?.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales */}
              <div className="bg-[#F2F2F2] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#595959]">Total bruto:</span>
                  <span>${pedidoSeleccionado.total_bruto?.toLocaleString()}</span>
                </div>
                {pedidoSeleccionado.descuento > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#595959]">Descuento:</span>
                    <span className="text-red-500">-${pedidoSeleccionado.descuento?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#595959]">Impuesto (19%):</span>
                  <span>${pedidoSeleccionado.impuesto?.toLocaleString()}</span>
                </div>
                {pedidoSeleccionado.propina > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#595959]">Propina:</span>
                    <span>${pedidoSeleccionado.propina?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="font-semibold text-[#025373]">Total neto:</span>
                  <span className="text-xl font-bold text-[#116EBF]">${pedidoSeleccionado.total_neto?.toLocaleString()}</span>
                </div>
              </div>

              {pedidoSeleccionado.observaciones && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-yellow-700 font-medium">Observaciones:</p>
                  <p className="text-sm text-yellow-800">{pedidoSeleccionado.observaciones}</p>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="px-6 py-4 border-t border-gray-100 bg-[#F2F2F2] rounded-b-2xl flex justify-end">
              <button
                onClick={() => {
                  setModalAbierto(false);
                  setPedidoSeleccionado(null);
                  setDetallesPedido([]);
                }}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
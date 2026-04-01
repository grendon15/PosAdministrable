'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function ConteoFisicoPage() {
  // Estados principales
  const [itemsInventario, setItemsInventario] = useState([]);
  const [historialConteos, setHistorialConteos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // Estados de UI
  const [vistaActiva, setVistaActiva] = useState('conteo');
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Estados de formulario (Conteo Activo)
  const [conteoActivo, setConteoActivo] = useState({});
  
  // Estados de filtros
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [filtroFechaFin, setFiltroFechaFin] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [filtroItem, setFiltroItem] = useState('');
  
  // Estados de modales
  const [modalConfirmacion, setModalConfirmacion] = useState({ open: false, itemId: null, item: null, stockFisico: 0, observacion: '' });
  const [modalAjuste, setModalAjuste] = useState({ open: false, conteoId: null, itemNombre: '', stockTeorico: 0, stockFisico: 0, diferencia: 0 });
  const [modalAjusteTodos, setModalAjusteTodos] = useState({ open: false, cantidad: 0 });

  // Permisos
  const { puedeVer, puedeEditar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('inventario');
  const puedeEditarConteo = puedeEditar('inventario');

  // Memoización de listas filtradas para mejor rendimiento
  const itemsFiltrados = useMemo(() => {
    return itemsInventario.filter(item => {
      const coincideBusqueda = filtroBusqueda 
        ? item.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase())
        : true;
      const coincideCategoria = filtroCategoria 
        ? item.categoria_id === parseInt(filtroCategoria)
        : true;
      return coincideBusqueda && coincideCategoria;
    });
  }, [itemsInventario, filtroBusqueda, filtroCategoria]);

  const historialFiltrado = useMemo(() => {
    return historialConteos.filter(conteo => {
      // Filtro fecha inicio
      if (filtroFechaInicio && conteo.fecha < filtroFechaInicio) return false;
      
      // Corrección filtro fecha fin: incluir todo el día
      if (filtroFechaFin) {
        const fechaConteo = conteo.fecha.split('T')[0]; // Asegurar comparación de fecha sola
        if (fechaConteo > filtroFechaFin) return false;
      }
      
      // Filtro item
      const coincideItem = filtroItem 
        ? conteo.items_inventario?.nombre.toLowerCase().includes(filtroItem.toLowerCase())
        : true;
        
      return coincideItem;
    });
  }, [historialConteos, filtroFechaInicio, filtroFechaFin, filtroItem]);

  useEffect(() => {
    if (tienePermiso) {
      cargarDatos();
    } else if (!cargandoPermisos) {
      setCargando(false);
    }
  }, [tienePermiso, cargandoPermisos]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function cargarDatos() {
    setCargando(true);
    
    try {
      // Cargar items y categorías en paralelo
      const [itemsRes, categoriasRes, historialRes] = await Promise.all([
        supabase
          .from('items_inventario')
          .select(`*, proveedores (nombre), unidad_receta:unidades_medida!items_inventario_unidad_receta_id_fkey (*)`)
          .eq('activo', true)
          .order('nombre'),
        supabase.from('categorias').select('*').eq('activo', true),
        supabase
          .from('conteo_fisico')
          .select(`*, items_inventario ( nombre, unidad_receta:unidades_medida!items_inventario_unidad_receta_id_fkey (*) )`)
          .order('fecha', { ascending: false })
          .limit(100)
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (categoriasRes.error) throw categoriasRes.error;
      if (historialRes.error) throw historialRes.error;

      setCategorias(categoriasRes.data || []);
      setHistorialConteos(historialRes.data || []);
      setItemsInventario(itemsRes.data || []);

      // Inicializar estado de conteo solo si está vacío (para no borrar input del usuario al recargar)
      if (Object.keys(conteoActivo).length === 0) {
        const conteoInicial = {};
        (itemsRes.data || []).forEach(item => {
          conteoInicial[item.id] = {
            stock_fisico: item.stock_actual,
            observaciones: ''
          };
        });
        setConteoActivo(conteoInicial);
      }
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al cargar datos: ' + error.message, 'error');
    } finally {
      setCargando(false);
    }
  }

  function actualizarConteo(itemId, stockFisico) {
    setConteoActivo(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        stock_fisico: parseFloat(stockFisico) || 0
      }
    }));
  }

  function actualizarObservacion(itemId, observacion) {
    setConteoActivo(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        observaciones: observacion
      }
    }));
  }

  function abrirModalConfirmacion(itemId, item) {
    const conteo = conteoActivo[itemId];
    const stockFisico = conteo?.stock_fisico ?? item.stock_actual;
    const diferencia = stockFisico - item.stock_actual;
    
    if (stockFisico === item.stock_actual && !conteo?.observaciones) {
      mostrarNotificacion(`${item.nombre}: No hay diferencia, no se registra conteo`, 'info');
      return;
    }
    
    setModalConfirmacion({
      open: true,
      itemId,
      item,
      stockFisico,
      diferencia,
      observacion: conteo?.observaciones || ''
    });
  }

  async function guardarConteo() {
    if (!puedeEditarConteo) {
      mostrarNotificacion('No tienes permisos para guardar conteos', 'error');
      return;
    }
    
    const { itemId, item, stockFisico, observacion } = modalConfirmacion;
    
    try {
      const { data, error } = await supabase
        .from('conteo_fisico')
        .insert({
          fecha: new Date().toISOString(),
          item_inventario_id: itemId,
          stock_teorico: item.stock_actual,
          stock_fisico: stockFisico,
          diferencia: stockFisico - item.stock_actual,
          observaciones: observacion || null,
          usuario: 'Administrador'
        })
        .select(`
          id, fecha, stock_teorico, stock_fisico, diferencia, observaciones, ajustado,
          items_inventario ( nombre, unidad_receta:unidades_medida!items_inventario_unidad_receta_id_fkey (*) )
        `) // Devolvemos los datos insertados para actualizar el estado local
        .single();
      
      if (error) throw error;
      
      mostrarNotificacion(
        `Conteo de "${item.nombre}" guardado.`,
        'success'
      );
      
      // Actualizar historial localmente sin recargar toda la página
      setHistorialConteos(prev => [data, ...prev]);
      
      // Opcional: Limpiar observación del input actual pero mantener el valor físico
      setConteoActivo(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          observaciones: '' 
        }
      }));

      setModalConfirmacion({ open: false, itemId: null, item: null, stockFisico: 0, observacion: '' });
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al guardar conteo: ' + error.message, 'error');
    }
  }

  function abrirModalAjuste(conteoId, itemNombre, stockTeorico, stockFisico, diferencia) {
    if (!puedeEditarConteo) {
      mostrarNotificacion('No tienes permisos para ajustar inventario', 'error');
      return;
    }
    setModalAjuste({
      open: true,
      conteoId,
      itemNombre,
      stockTeorico,
      stockFisico,
      diferencia
    });
  }

  async function ajustarInventario() {
    const { conteoId, itemNombre } = modalAjuste;
    
    try {
      const { error } = await supabase
        .rpc('ajustar_inventario_por_conteo', {
          p_conteo_id: conteoId
        });
      
      if (error) throw error;
      
      mostrarNotificacion(`Inventario de "${itemNombre}" ajustado correctamente`, 'success');
      setModalAjuste({ open: false, conteoId: null, itemNombre: '', stockTeorico: 0, stockFisico: 0, diferencia: 0 });
      
      // Recargamos datos aquí porque el stock teórico cambia globalmente
      cargarDatos(); 
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al ajustar inventario: ' + error.message, 'error');
    }
  }

  function abrirModalAjusteTodos() {
    if (!puedeEditarConteo) {
      mostrarNotificacion('No tienes permisos para ajustar inventario', 'error');
      return;
    }
    const conteosSinAjustar = historialFiltrado.filter(c => !c.ajustado);
    if (conteosSinAjustar.length === 0) {
      mostrarNotificacion('No hay conteos pendientes de ajuste en este filtro', 'info');
      return;
    }
    setModalAjusteTodos({ open: true, cantidad: conteosSinAjustar.length });
  }

  async function ajustarTodosLosConteos() {
    const conteosSinAjustar = historialFiltrado.filter(c => !c.ajustado);
    let ajustados = 0;
    let errores = 0;
    
    for (const conteo of conteosSinAjustar) {
      try {
        const { error } = await supabase
          .rpc('ajustar_inventario_por_conteo', {
            p_conteo_id: conteo.id
          });
        
        if (error) throw error;
        ajustados++;
      } catch (error) {
        console.error('Error en conteo ID', conteo.id, error);
        errores++;
      }
    }
    
    mostrarNotificacion(
      `Ajuste completado: ${ajustados} ajustados, ${errores} errores`,
      errores === 0 ? 'success' : 'warning'
    );
    setModalAjusteTodos({ open: false, cantidad: 0 });
    cargarDatos();
  }

  async function exportarReporte() {
    if (!puedeEditarConteo) {
      mostrarNotificacion('No tienes permisos para exportar reportes', 'error');
      return;
    }
    
    const fecha = new Date().toISOString().split('T')[0];
    let csvContent = "Fecha,Item,Stock Teórico,Stock Físico,Diferencia,Unidad,Observaciones,Estado\n";
    
    historialFiltrado.forEach(conteo => {
      csvContent += `${conteo.fecha.split('T')[0]},`; // Asegurar formato fecha
      csvContent += `"${conteo.items_inventario?.nombre || ''}",`;
      csvContent += `${conteo.stock_teorico},`;
      csvContent += `${conteo.stock_fisico},`;
      csvContent += `${conteo.diferencia},`;
      csvContent += `${conteo.items_inventario?.unidad_receta?.abreviatura || ''},`;
      csvContent += `"${conteo.observaciones || ''}",`;
      csvContent += `${conteo.ajustado ? 'Ajustado' : 'Pendiente'}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_conteo_${fecha}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarNotificacion('Reporte exportado exitosamente', 'success');
  }

  // --- Renderizado de Permisos y Carga ---
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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Conteo Físico.</p>
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

      <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold">🔢 Conteo Físico de Inventario</h1>
        <p className="text-white/80 mt-1">Compara el stock teórico con el stock físico y realiza ajustes</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setVistaActiva('conteo')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'conteo' ? 'bg-[#116EBF] text-white shadow-md' : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          📊 Realizar Conteo
        </button>
        <button
          onClick={() => setVistaActiva('historial')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'historial' ? 'bg-[#116EBF] text-white shadow-md' : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          📋 Historial y Reportes
        </button>
      </div>

      {/* VISTA DE CONTEO */}
      {vistaActiva === 'conteo' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar item..."
                    value={filtroBusqueda}
                    onChange={(e) => setFiltroBusqueda(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                  />
                  <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
              >
                <option value="">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
              {(filtroBusqueda || filtroCategoria) && (
                <button
                  onClick={() => { setFiltroBusqueda(''); setFiltroCategoria(''); }}
                  className="px-4 py-2.5 text-[#595959] hover:text-[#116EBF]"
                >
                  Limpiar ✖
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Item</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Unidad</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Stock Teórico</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Stock Físico</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Diferencia</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Observaciones</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.map(item => {
                    const conteo = conteoActivo[item.id] || { stock_fisico: item.stock_actual, observaciones: '' };
                    const stockFisico = conteo.stock_fisico;
                    const diferencia = stockFisico - item.stock_actual;
                    
                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                        <td className="py-4 px-5 font-medium text-[#025373]">{item.nombre}</td>
                        <td className="py-4 px-5 text-[#595959]">{item.unidad_receta?.abreviatura || '-'}</td>
                        <td className="py-4 px-5 text-right font-semibold text-[#025373]">{item.stock_actual}</td>
                        <td className="py-4 px-5">
                          <input
                            type="number"
                            step="0.01"
                            value={stockFisico}
                            onChange={(e) => actualizarConteo(item.id, e.target.value)}
                            className="w-32 text-right px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                          />
                        </td>
                        <td className={`py-4 px-5 text-right font-semibold ${
                          diferencia > 0 ? 'text-green-600' : diferencia < 0 ? 'text-red-500' : 'text-[#595959]'
                        }`}>
                          {diferencia > 0 ? `+${diferencia.toFixed(2)}` : diferencia.toFixed(2)}
                        </td>
                        <td className="py-4 px-5">
                          <input
                            type="text"
                            placeholder="Observación"
                            value={conteo.observaciones}
                            onChange={(e) => actualizarObservacion(item.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3BD9D9]"
                          />
                        </td>
                        <td className="py-4 px-5 text-center">
                          {puedeEditarConteo && (
                            <button
                              onClick={() => abrirModalConfirmacion(item.id, item)}
                              className="px-3 py-1.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] text-sm"
                            >
                              Guardar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-[#F2F2F2] border-t border-gray-200 text-sm text-[#595959]">
              Mostrando {itemsFiltrados.length} de {itemsInventario.length} items
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE HISTORIAL */}
      {vistaActiva === 'historial' && (
        <div className="space-y-5">
          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <label className="block text-sm font-medium text-[#595959] mb-1">Buscar item</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nombre del item..."
                    value={filtroItem}
                    onChange={(e) => setFiltroItem(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                  />
                  <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="text-sm text-[#595959]">{historialFiltrado.length} conteos encontrados</div>
              <div className="flex gap-3">
                {puedeEditarConteo && (
                  <>
                    <button
                      onClick={abrirModalAjusteTodos}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Ajustar pendientes
                    </button>
                    <button
                      onClick={exportarReporte}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Exportar CSV
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tabla de historial */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Fecha</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Item</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Stock Teórico</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Stock Físico</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Diferencia</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Unidad</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Observaciones</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Estado</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialFiltrado.map(conteo => (
                    <tr key={conteo.id} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                      <td className="py-4 px-5 text-[#595959]">{new Date(conteo.fecha).toLocaleDateString('es-CO')}</td>
                      <td className="py-4 px-5 font-medium text-[#025373]">{conteo.items_inventario?.nombre}</td>
                      <td className="py-4 px-5 text-right">{conteo.stock_teorico}</td>
                      <td className="py-4 px-5 text-right font-semibold">{conteo.stock_fisico}</td>
                      <td className={`py-4 px-5 text-right font-semibold ${
                        conteo.diferencia > 0 ? 'text-green-600' : conteo.diferencia < 0 ? 'text-red-500' : 'text-[#595959]'
                      }`}>
                        {conteo.diferencia > 0 ? `+${conteo.diferencia}` : conteo.diferencia}
                      </td>
                      <td className="py-4 px-5 text-[#595959]">{conteo.items_inventario?.unidad_receta?.abreviatura || '-'}</td>
                      <td className="py-4 px-5 text-[#595959] max-w-xs truncate">{conteo.observaciones || '-'}</td>
                      <td className="py-4 px-5 text-center">
                        {conteo.ajustado ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Ajustado</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pendiente</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center">
                        {!conteo.ajustado && puedeEditarConteo && (
                          <button
                            onClick={() => abrirModalAjuste(conteo.id, conteo.items_inventario?.nombre, conteo.stock_teorico, conteo.stock_fisico, conteo.diferencia)}
                            className="px-3 py-1.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] text-sm"
                          >
                            Ajustar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historialFiltrado.length === 0 && (
              <div className="text-center py-10 text-[#595959]">
                No se encontraron conteos con los filtros seleccionados.
              </div>
            )}
          </div>

          {historialFiltrado.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">📊 Resumen de diferencias</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                  <p className="text-2xl font-bold text-green-600">{historialFiltrado.filter(c => c.diferencia > 0).length}</p>
                  <p className="text-sm text-green-700">Items con superávit</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                  <p className="text-2xl font-bold text-red-600">{historialFiltrado.filter(c => c.diferencia < 0).length}</p>
                  <p className="text-sm text-red-700">Items con faltante</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                  <p className="text-2xl font-bold text-blue-600">{historialFiltrado.filter(c => c.diferencia === 0).length}</p>
                  <p className="text-sm text-blue-700">Items sin diferencia</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALES */}
      {modalConfirmacion.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">📊 Confirmar Conteo</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#F2F2F2] rounded-lg p-4">
                <p className="font-semibold text-[#025373]">{modalConfirmacion.item?.nombre}</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Stock teórico:</span>
                    <span className="font-semibold">{modalConfirmacion.item?.stock_actual} {modalConfirmacion.item?.unidad_receta?.abreviatura}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Stock físico:</span>
                    <span className="font-semibold">{modalConfirmacion.stockFisico} {modalConfirmacion.item?.unidad_receta?.abreviatura}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-[#595959]">Diferencia:</span>
                    <span className={`font-bold ${modalConfirmacion.diferencia > 0 ? 'text-green-600' : modalConfirmacion.diferencia < 0 ? 'text-red-500' : 'text-[#595959]'}`}>
                      {modalConfirmacion.diferencia > 0 ? '+' : ''}{modalConfirmacion.diferencia.toFixed(2)} {modalConfirmacion.item?.unidad_receta?.abreviatura}
                    </span>
                  </div>
                </div>
              </div>
              {modalConfirmacion.observacion && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-yellow-700 font-medium">Observación:</p>
                  <p className="text-sm text-yellow-800">{modalConfirmacion.observacion}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalConfirmacion({ open: false, itemId: null, item: null, stockFisico: 0, observacion: '' })} className="px-5 py-2.5 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={guardarConteo} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373]">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalAjuste.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">⚙️ Ajustar Inventario</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#F2F2F2] rounded-lg p-4">
                <p className="font-semibold text-[#025373]">{modalAjuste.itemNombre}</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Stock teórico:</span>
                    <span className="font-semibold">{modalAjuste.stockTeorico}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Stock físico (contado):</span>
                    <span className="font-semibold">{modalAjuste.stockFisico}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="text-[#595959]">Diferencia a aplicar:</span>
                    <span className={`font-bold ${modalAjuste.diferencia > 0 ? 'text-green-600' : modalAjuste.diferencia < 0 ? 'text-red-500' : 'text-[#595959]'}`}>
                      {modalAjuste.diferencia > 0 ? '+' : ''}{modalAjuste.diferencia}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-[#595959] text-center">¿Estás seguro de que deseas ajustar el inventario con los valores contados?</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalAjuste({ open: false, conteoId: null, itemNombre: '', stockTeorico: 0, stockFisico: 0, diferencia: 0 })} className="px-5 py-2.5 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={ajustarInventario} className="px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600">Ajustar</button>
            </div>
          </div>
        </div>
      )}

      {modalAjusteTodos.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">⚙️ Ajuste Masivo</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#F2F2F2] rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-[#116EBF]">{modalAjusteTodos.cantidad}</p>
                <p className="text-sm text-[#595959]">conteos pendientes de ajuste</p>
              </div>
              <p className="text-sm text-[#595959] text-center">
                Esta acción actualizará el stock actual de todos los items con valores contados.
                <br />
                <span className="text-orange-500 font-medium">Esta acción no se puede deshacer.</span>
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalAjusteTodos({ open: false, cantidad: 0 })} className="px-5 py-2.5 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={ajustarTodosLosConteos} className="px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600">Ajustar todos</button>
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
'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function ComprasPage() {
  const [proveedores, setProveedores] = useState([]);
  const [itemsInventario, setItemsInventario] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [detallesFactura, setDetallesFactura] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vistaActiva, setVistaActiva] = useState('nueva');
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Permisos
  const { puedeVer, puedeCrear, puedeEditar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('inventario');
  const puedeCrearFactura = puedeCrear('inventario');
  const puedeEditarFactura = puedeEditar('inventario');
  
  // Filtros para historial
  const [filtroFechaInicio, setFiltroFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [filtroFechaFin, setFiltroFechaFin] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  
  // Estado para nueva factura
  const [nuevaFactura, setNuevaFactura] = useState({
    numero_factura: '',
    proveedor_id: '',
    fecha: new Date().toISOString().split('T')[0],
    observaciones: '',
    items: []
  });
  
  const [itemSeleccionado, setItemSeleccionado] = useState({
    item_id: '',
    cantidad: '',
    precio_unitario: ''
  });
  
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // Memoización de facturas filtradas para mejor rendimiento
  const facturasFiltradas = useMemo(() => {
    return facturas.filter(f => {
      // Filtro fecha inicio
      if (filtroFechaInicio && f.fecha < filtroFechaInicio) return false;
      
      // Corrección filtro fecha fin: incluir todo el día
      if (filtroFechaFin) {
        const fechaFactura = f.fecha.split('T')[0]; // Comparar solo fecha
        if (fechaFactura > filtroFechaFin) return false;
      }
      
      // Filtro proveedor
      if (filtroProveedor && f.proveedor_id !== parseInt(filtroProveedor)) return false;
      
      // Filtro búsqueda
      if (filtroBusqueda) {
        const match = f.numero_factura && f.numero_factura.toLowerCase().includes(filtroBusqueda.toLowerCase());
        if (!match) return false;
      }
      
      return true;
    });
  }, [facturas, filtroFechaInicio, filtroFechaFin, filtroProveedor, filtroBusqueda]);

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
      // Carga paralela de datos para mayor velocidad
      const [proveedoresRes, itemsRes, facturasRes] = await Promise.all([
        supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
        supabase.from('items_inventario').select(`*, unidad_compra:unidades_medida!items_inventario_unidad_compra_id_fkey (*)`).eq('activo', true).order('nombre'),
        supabase.from('facturas_compra').select(`*, proveedores (nombre)`).order('fecha', { ascending: false })
      ]);

      if (proveedoresRes.error) throw proveedoresRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (facturasRes.error) throw facturasRes.error;

      setProveedores(proveedoresRes.data || []);
      setItemsInventario(itemsRes.data || []);
      setFacturas(facturasRes.data || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      mostrarNotificacion('Error al cargar datos iniciales', 'error');
    } finally {
      setCargando(false);
    }
  }

  async function cargarDetallesFactura(facturaId) {
    const { data, error } = await supabase
      .from('detalles_compra')
      .select(`
        *,
        items_inventario (
          nombre,
          unidad_compra:unidades_medida!items_inventario_unidad_compra_id_fkey (*)
        )
      `)
      .eq('factura_id', facturaId);
    
    if (!error) {
      setDetallesFactura(data || []);
    }
  }

  function agregarItemAFactura() {
    if (!itemSeleccionado.item_id) {
      mostrarNotificacion('Selecciona un item', 'error');
      return;
    }
    if (!itemSeleccionado.cantidad || parseFloat(itemSeleccionado.cantidad) <= 0) {
      mostrarNotificacion('Ingresa una cantidad válida', 'error');
      return;
    }
    if (!itemSeleccionado.precio_unitario || parseFloat(itemSeleccionado.precio_unitario) <= 0) {
      mostrarNotificacion('Ingresa un precio unitario válido', 'error');
      return;
    }
    
    const item = itemsInventario.find(i => i.id === parseInt(itemSeleccionado.item_id));
    if (!item) return; // Seguridad extra

    const cantidad = parseFloat(itemSeleccionado.cantidad);
    const precioUnitario = parseFloat(itemSeleccionado.precio_unitario);
    const subtotal = cantidad * precioUnitario;
    
    setNuevaFactura(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: item.id, // Guardamos el ID para referencia rápida
          nombre: item.nombre,
          unidad_compra: item.unidad_compra?.abreviatura || item.unidad_compra?.nombre || 'unidad',
          cantidad: cantidad,
          precio_unitario: precioUnitario,
          subtotal: subtotal
        }
      ]
    }));
    
    setItemSeleccionado({ item_id: '', cantidad: '', precio_unitario: '' });
    mostrarNotificacion(`${item.nombre} agregado a la factura`, 'success');
  }

  function eliminarItemDeFactura(index) {
    const nuevoItems = [...nuevaFactura.items];
    const itemEliminado = nuevoItems[index];
    nuevoItems.splice(index, 1);
    setNuevaFactura({ ...nuevaFactura, items: nuevoItems });
    mostrarNotificacion(`${itemEliminado.nombre} eliminado`, 'info');
  }

  const totalFactura = nuevaFactura.items.reduce((sum, item) => sum + item.subtotal, 0);

  async function guardarFactura() {
    if (!puedeCrearFactura) {
      mostrarNotificacion('No tienes permisos para crear facturas', 'error');
      return;
    }
    
    if (!nuevaFactura.proveedor_id) {
      mostrarNotificacion('Selecciona un proveedor', 'error');
      return;
    }
    if (nuevaFactura.items.length === 0) {
      mostrarNotificacion('Agrega al menos un item a la factura', 'error');
      return;
    }
    
    setProcesando(true);
    
    try {
      // 1. Insertar Factura
      const { data: factura, error: facturaError } = await supabase
        .from('facturas_compra')
        .insert({
          numero_factura: nuevaFactura.numero_factura || null,
          proveedor_id: parseInt(nuevaFactura.proveedor_id),
          fecha: nuevaFactura.fecha,
          total_compra: totalFactura,
          observaciones: nuevaFactura.observaciones || null,
          usuario: 'Administrador'
        })
        .select()
        .single();
      
      if (facturaError) throw facturaError;
      
      // 2. Insertar Detalles y Actualizar Stock
      for (const item of nuevaFactura.items) {
        // Insertar detalle
        const { error: detalleError } = await supabase
          .from('detalles_compra')
          .insert({
            factura_id: factura.id,
            item_inventario_id: item.id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.subtotal
          });
        
        if (detalleError) throw detalleError;

        // Actualizar Stock (Incrementar)
        // Nota: Idealmente esto debería hacerse dentro de una transacción RPC en Supabase
        // para garantizar integridad, pero aquí lo hacemos secuencialmente.
        const itemActual = itemsInventario.find(i => i.id === item.id);
        if (itemActual) {
            const nuevoStock = (itemActual.stock_actual || 0) + item.cantidad;
            const { error: stockError } = await supabase
              .from('items_inventario')
              .update({ stock_actual: nuevoStock })
              .eq('id', item.id);
            
            if (stockError) {
              console.warn(`Error actualizando stock para ${item.nombre}:`, stockError);
              // Podríamos decidir si esto detiene el proceso o no.
            }
        }
      }
      
      mostrarNotificacion(`Factura guardada y stock actualizado. Total: $${totalFactura.toLocaleString()}`, 'success');
      
      // Resetear formulario
      setNuevaFactura({
        numero_factura: '',
        proveedor_id: '',
        fecha: new Date().toISOString().split('T')[0],
        observaciones: '',
        items: []
      });
      
      cargarDatos(); // Recargar datos para reflejar nuevo stock y factura
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al guardar factura: ' + error.message, 'error');
    } finally {
      setProcesando(false);
    }
  }

  async function verDetalleFactura(factura) {
    setFacturaSeleccionada(factura);
    await cargarDetallesFactura(factura.id);
    setModalDetalle(true);
  }

  // --- Renderizado de Seguridad ---
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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Compras.</p>
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
        <h1 className="text-3xl font-bold">🧾 Ingreso de Facturas</h1>
        <p className="text-white/80 mt-1">Registra compras de materia prima y actualiza automáticamente el inventario</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setVistaActiva('nueva')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'nueva' ? 'bg-[#116EBF] text-white shadow-md' : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          📝 Nueva Factura
        </button>
        <button
          onClick={() => setVistaActiva('historial')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'historial' ? 'bg-[#116EBF] text-white shadow-md' : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          📋 Historial de Compras
        </button>
      </div>

      {/* VISTA DE NUEVA FACTURA */}
      {vistaActiva === 'nueva' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel izquierdo - Formulario */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold text-[#025373] mb-4">Información de la Factura</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">N° Factura</label>
                  <input
                    type="text"
                    value={nuevaFactura.numero_factura}
                    onChange={(e) => setNuevaFactura({ ...nuevaFactura, numero_factura: e.target.value })}
                    placeholder="Opcional"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Proveedor *</label>
                  <select
                    value={nuevaFactura.proveedor_id}
                    onChange={(e) => setNuevaFactura({ ...nuevaFactura, proveedor_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
                  >
                    <option value="">Seleccionar proveedor</option>
                    {proveedores.map(prov => (
                      <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Fecha</label>
                  <input
                    type="date"
                    value={nuevaFactura.fecha}
                    onChange={(e) => setNuevaFactura({ ...nuevaFactura, fecha: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Observaciones</label>
                  <textarea
                    value={nuevaFactura.observaciones}
                    onChange={(e) => setNuevaFactura({ ...nuevaFactura, observaciones: e.target.value })}
                    placeholder="Notas adicionales..."
                    rows="3"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Panel derecho - Items */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-lg font-semibold text-[#025373] mb-4">Agregar Items</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Item *</label>
                  <select
                    value={itemSeleccionado.item_id}
                    onChange={(e) => setItemSeleccionado({ ...itemSeleccionado, item_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
                  >
                    <option value="">Seleccionar item</option>
                    {itemsInventario.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nombre} ({item.unidad_compra?.abreviatura || 'und'}) - Stock: {item.stock_actual}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#595959] mb-1">Cantidad *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemSeleccionado.cantidad}
                      onChange={(e) => setItemSeleccionado({ ...itemSeleccionado, cantidad: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#595959] mb-1">Precio unitario *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[#595959]">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={itemSeleccionado.precio_unitario}
                        onChange={(e) => setItemSeleccionado({ ...itemSeleccionado, precio_unitario: e.target.value })}
                        placeholder="0"
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                      />
                    </div>
                  </div>
                </div>
                
                {puedeCrearFactura && (
                  <button
                    onClick={agregarItemAFactura}
                    className="w-full py-2.5 bg-[#3BD9D9] text-[#025373] rounded-lg hover:bg-[#2bc0c0] transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar Item
                  </button>
                )}
              </div>
            </div>

            {/* Lista de items agregados */}
            {nuevaFactura.items.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-lg font-semibold text-[#025373] mb-4 flex justify-between">
                  <span>Items Agregados</span>
                  <span className="text-sm text-[#595959]">{nuevaFactura.items.length} items</span>
                </h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {nuevaFactura.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-[#F2F2F2] rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-[#025373]">{item.nombre}</p>
                        <p className="text-xs text-[#595959]">
                          {item.cantidad} {item.unidad_compra} × ${item.precio_unitario.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#116EBF]">${item.subtotal.toLocaleString()}</p>
                        <button
                          onClick={() => eliminarItemDeFactura(idx)}
                          className="text-xs text-red-500 hover:text-red-700 mt-1"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#025373]">Total Factura:</span>
                    <span className="text-xl font-bold text-[#116EBF]">${totalFactura.toLocaleString()}</span>
                  </div>
                </div>
                {puedeCrearFactura && (
                  <button
                    onClick={guardarFactura}
                    disabled={procesando}
                    className="w-full mt-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-medium shadow-md disabled:opacity-50"
                  >
                    {procesando ? 'Procesando...' : '✅ Guardar Factura y Actualizar Stock'}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-5 text-center text-[#595959] border-dashed border-2 border-gray-200">
                <p>No hay items agregados</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA DE HISTORIAL */}
      {vistaActiva === 'historial' && (
        <div className="space-y-5">
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
                <label className="block text-sm font-medium text-[#595959] mb-1">Proveedor</label>
                <select
                  value={filtroProveedor}
                  onChange={(e) => setFiltroProveedor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
                >
                  <option value="">Todos los proveedores</option>
                  {proveedores.map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">N° Factura</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar..."
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
          </div>

          {/* Tabla de facturas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Fecha</th>
                    <th className="text-left py-4 px-5 text-[#025373]">N° Factura</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Proveedor</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Total</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Observaciones</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-[#595959]">
                        No hay facturas en el período seleccionado
                       </td>
                    </tr>
                  ) : (
                    facturasFiltradas.map(factura => (
                      <tr key={factura.id} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                        <td className="py-4 px-5 text-[#595959]">{new Date(factura.fecha).toLocaleDateString('es-CO')}</td>
                        <td className="py-4 px-5 font-mono text-[#025373]">{factura.numero_factura || '-'}</td>
                        <td className="py-4 px-5 text-[#595959]">{factura.proveedores?.nombre || 'N/A'}</td>
                        <td className="py-4 px-5 text-right font-semibold text-[#116EBF]">${factura.total_compra?.toLocaleString()}</td>
                        <td className="py-4 px-5 text-[#595959] max-w-xs truncate">{factura.observaciones || '-'}</td>
                        <td className="py-4 px-5 text-center">
                          <button
                            onClick={() => verDetalleFactura(factura)}
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
              Mostrando {facturasFiltradas.length} de {facturas.length} facturas
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE FACTURA */}
      {modalDetalle && facturaSeleccionada && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">🧾 Detalle de Factura</h3>
                  <p className="text-white/70 text-sm mt-1">
                    {facturaSeleccionada.numero_factura || 'Sin número'} • {new Date(facturaSeleccionada.fecha).toLocaleDateString('es-CO')}
                  </p>
                </div>
                <button onClick={() => setModalDetalle(false)} className="text-white/70 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs text-[#595959]">Proveedor</p>
                  <p className="font-semibold text-[#025373]">{facturaSeleccionada.proveedores?.nombre}</p>
                </div>
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs text-[#595959]">Total Factura</p>
                  <p className="text-xl font-bold text-[#116EBF]">${facturaSeleccionada.total_compra?.toLocaleString()}</p>
                </div>
              </div>

              {facturaSeleccionada.observaciones && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-yellow-700 font-medium">Observaciones:</p>
                  <p className="text-sm text-yellow-800">{facturaSeleccionada.observaciones}</p>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-[#025373] mb-3">📦 Items Comprados</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[#F2F2F2]">
                      <tr>
                        <th className="text-left py-2 px-4 text-sm text-[#025373]">Item</th>
                        <th className="text-right py-2 px-4 text-sm text-[#025373]">Cantidad</th>
                        <th className="text-right py-2 px-4 text-sm text-[#025373]">Precio Unit.</th>
                        <th className="text-right py-2 px-4 text-sm text-[#025373]">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detallesFactura.map(detalle => (
                        <tr key={detalle.id} className="border-b border-gray-100">
                          <td className="py-2 px-4 text-[#025373]">{detalle.items_inventario?.nombre}</td>
                          <td className="py-2 px-4 text-right">{detalle.cantidad} {detalle.items_inventario?.unidad_compra?.abreviatura}</td>
                          <td className="py-2 px-4 text-right">${detalle.precio_unitario?.toLocaleString()}</td>
                          <td className="py-2 px-4 text-right font-semibold text-[#116EBF]">${detalle.subtotal?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#F2F2F2]">
                      <tr>
                        <td colSpan="3" className="py-2 px-4 text-right font-bold">Total:</td>
                        <td className="py-2 px-4 text-right font-bold text-[#116EBF]">${facturaSeleccionada.total_compra?.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalDetalle(false)} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">
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
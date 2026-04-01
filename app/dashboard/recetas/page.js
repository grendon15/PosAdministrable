'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function RecetasPage() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [itemsInventario, setItemsInventario] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Permisos
  const { puedeVer, puedeEditar, puedeEliminar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('recetas');
  const puedeEditarRecetas = puedeEditar('recetas');
  const puedeEliminarRecetas = puedeEliminar('recetas');
  
  // Modal para agregar/editar ingredientes
  const [modalIngrediente, setModalIngrediente] = useState({
    open: false,
    editing: null,
    data: {
      producto_id: '',
      item_inventario_id: '',
      cantidad_necesaria: ''
    }
  });

  useEffect(() => {
    if (tienePermiso) {
      cargarDatos();
    } else {
      setCargando(false);
    }
  }, [tienePermiso]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function cargarDatos() {
    setCargando(true);
    
    const { data: categoriasData } = await supabase
      .from('categorias')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    
    const { data: productosData } = await supabase
      .from('productos')
      .select('*, categorias(*)')
      .eq('activo', true)
      .order('nombre');
    
    const { data: itemsData } = await supabase
      .from('items_inventario')
      .select(`
        *,
        unidad_receta:unidades_medida!items_inventario_unidad_receta_id_fkey (*)
      `)
      .eq('activo', true)
      .order('nombre');
    
    const { data: recetasData } = await supabase
      .from('recetas')
      .select(`
        *,
        productos(*),
        items_inventario(
          *,
          unidad_receta:unidades_medida!items_inventario_unidad_receta_id_fkey (*)
        )
      `);
    
    setCategorias(categoriasData || []);
    setProductos(productosData || []);
    setItemsInventario(itemsData || []);
    setRecetas(recetasData || []);
    setCargando(false);
    
    if (productosData && productosData.length > 0 && !productoSeleccionado) {
      setProductoSeleccionado(productosData[0]);
    }
  }

  const productosFiltrados = productos.filter(producto => {
    const coincideCategoria = !filtroCategoria || producto.categoria_id === parseInt(filtroCategoria);
    const coincideBusqueda = !filtroBusqueda || 
      producto.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
      (producto.categorias?.nombre || '').toLowerCase().includes(filtroBusqueda.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });

  const getIngredientesByProducto = (productoId) => {
    return recetas.filter(r => r.producto_id === productoId);
  };

  const calcularCostoProducto = (productoId) => {
    const ingredientes = getIngredientesByProducto(productoId);
    let costoTotal = 0;
    
    ingredientes.forEach(ing => {
      if (ing.items_inventario) {
        const valorUnitario = ing.items_inventario.valor_unitario_receta || 0;
        costoTotal += valorUnitario * ing.cantidad_necesaria;
      }
    });
    
    return costoTotal;
  };

  const calcularPrecioSugerido = (costo, margen = 30) => {
    return costo * (1 + (margen / 100));
  };

  async function guardarIngrediente() {
    if (!puedeEditarRecetas) {
      mostrarNotificacion('No tienes permisos para modificar recetas', 'error');
      return;
    }
    
    const data = modalIngrediente.data;
    
    if (!data.producto_id || !data.item_inventario_id || !data.cantidad_necesaria) {
      mostrarNotificacion('Por favor completa todos los campos', 'error');
      return;
    }
    
    if (data.cantidad_necesaria <= 0) {
      mostrarNotificacion('La cantidad debe ser mayor a 0', 'error');
      return;
    }
    
    try {
      if (modalIngrediente.editing) {
        const { error } = await supabase
          .from('recetas')
          .update({
            cantidad_necesaria: parseFloat(data.cantidad_necesaria)
          })
          .eq('id', modalIngrediente.editing.id);
        
        if (error) throw error;
        mostrarNotificacion('Cantidad actualizada correctamente', 'success');
      } else {
        const existe = recetas.some(r => 
          r.producto_id === parseInt(data.producto_id) && 
          r.item_inventario_id === parseInt(data.item_inventario_id)
        );
        
        if (existe) {
          mostrarNotificacion('Este ingrediente ya está en la receta', 'error');
          return;
        }
        
        const { error } = await supabase
          .from('recetas')
          .insert({
            producto_id: parseInt(data.producto_id),
            item_inventario_id: parseInt(data.item_inventario_id),
            cantidad_necesaria: parseFloat(data.cantidad_necesaria)
          });
        
        if (error) throw error;
        mostrarNotificacion('Ingrediente agregado correctamente', 'success');
      }
      
      setModalIngrediente({ open: false, editing: null, data: { producto_id: '', item_inventario_id: '', cantidad_necesaria: '' } });
      cargarDatos();
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al guardar: ' + error.message, 'error');
    }
  }

  async function eliminarIngrediente(id, nombreItem) {
    if (!puedeEliminarRecetas) {
      mostrarNotificacion('No tienes permisos para eliminar ingredientes', 'error');
      return;
    }
    if (!confirm(`¿Eliminar "${nombreItem}" de la receta?`)) return;
    const { error } = await supabase.from('recetas').delete().eq('id', id);
    if (error) {
      mostrarNotificacion('Error al eliminar: ' + error.message, 'error');
    } else {
      mostrarNotificacion('Ingrediente eliminado correctamente', 'success');
      cargarDatos();
    }
  }

  function abrirModalIngrediente() {
    if (!puedeEditarRecetas) {
      mostrarNotificacion('No tienes permisos para agregar ingredientes', 'error');
      return;
    }
    if (!productoSeleccionado) return;
    setModalIngrediente({
      open: true,
      editing: null,
      data: {
        producto_id: productoSeleccionado.id,
        item_inventario_id: '',
        cantidad_necesaria: ''
      }
    });
  }

  function editarIngrediente(ingrediente) {
    if (!puedeEditarRecetas) {
      mostrarNotificacion('No tienes permisos para editar ingredientes', 'error');
      return;
    }
    setModalIngrediente({
      open: true,
      editing: ingrediente,
      data: {
        producto_id: ingrediente.producto_id,
        item_inventario_id: ingrediente.item_inventario_id,
        cantidad_necesaria: ingrediente.cantidad_necesaria
      }
    });
  }

  const ingredientesProducto = productoSeleccionado ? getIngredientesByProducto(productoSeleccionado.id) : [];
  const costoTotal = productoSeleccionado ? calcularCostoProducto(productoSeleccionado.id) : 0;
  const precioVenta = productoSeleccionado?.precio_venta || 0;
  const utilidad = precioVenta - costoTotal;
  const margenActual = precioVenta > 0 ? (utilidad / precioVenta) * 100 : 0;
  const precioSugerido = calcularPrecioSugerido(costoTotal, 30);

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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Recetas.</p>
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
      <NotificationToast
        show={notificacion.show}
        message={notificacion.message}
        type={notificacion.type}
        onClose={() => setNotificacion({ show: false, message: '', type: 'success' })}
      />

      <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold">👨‍🍳 Recetas y Costos</h1>
        <p className="text-white/80 mt-1">Define los ingredientes de cada producto y calcula costos automáticamente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQUIERDA - Lista de productos */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-semibold text-[#025373] mb-3">Productos</h2>
            
            <div className="space-y-3 mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={filtroBusqueda}
                  onChange={(e) => setFiltroBusqueda(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] text-sm"
                />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] text-sm bg-white"
              >
                <option value="">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
              
              {(filtroBusqueda || filtroCategoria) && (
                <button
                  onClick={() => { setFiltroBusqueda(''); setFiltroCategoria(''); }}
                  className="text-xs text-[#116EBF] hover:text-[#025373]"
                >
                  Limpiar filtros ✖
                </button>
              )}
            </div>
            
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {productosFiltrados.length === 0 ? (
                <p className="text-center text-[#595959] py-8 text-sm">No hay productos que coincidan</p>
              ) : (
                productosFiltrados.map(producto => (
                  <button
                    key={producto.id}
                    onClick={() => setProductoSeleccionado(producto)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      productoSeleccionado?.id === producto.id
                        ? 'bg-[#116EBF] text-white shadow-md'
                        : 'bg-[#F2F2F2] text-[#595959] hover:bg-[#3BD9D9]/20 hover:text-[#025373]'
                    }`}
                  >
                    <div className="font-medium">{producto.nombre}</div>
                    <div className={`text-xs mt-0.5 ${
                      productoSeleccionado?.id === producto.id ? 'text-white/70' : 'text-[#595959]'
                    }`}>
                      {producto.categorias?.nombre || 'Sin categoría'} • ${producto.precio_venta?.toLocaleString()}
                    </div>
                    {getIngredientesByProducto(producto.id).length > 0 && (
                      <div className={`text-xs mt-1 ${
                        productoSeleccionado?.id === producto.id ? 'text-white/60' : 'text-[#3BD9D9]'
                      }`}>
                        🍽️ {getIngredientesByProducto(producto.id).length} ingredientes
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA - Detalle del producto */}
        <div className="lg:col-span-2 space-y-5">
          {productoSeleccionado ? (
            <div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-[#116EBF] to-[#025373] px-6 py-4">
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{productoSeleccionado.nombre}</h2>
                      <p className="text-white/70 text-sm mt-1">
                        {productoSeleccionado.categorias?.nombre || 'Sin categoría'}
                      </p>
                    </div>
                    {puedeEditarRecetas && (
                      <button
                        onClick={abrirModalIngrediente}
                        className="px-4 py-2 bg-white text-[#116EBF] rounded-lg hover:bg-[#F2F2F2] transition-colors flex items-center gap-2 text-sm font-medium shadow-md"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Agregar ingrediente
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabla de ingredientes corregida */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F2F2F2] border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-6 text-[#025373] font-semibold">Ingrediente</th>
                        <th className="text-left py-3 px-6 text-[#025373] font-semibold">Cantidad</th>
                        <th className="text-left py-3 px-6 text-[#025373] font-semibold">Unidad</th>
                        <th className="text-left py-3 px-6 text-[#025373] font-semibold">Valor unitario</th>
                        <th className="text-left py-3 px-6 text-[#025373] font-semibold">Subtotal</th>
                        <th className="text-left py-3 px-6 text-[#025373] font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientesProducto.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-12 text-[#595959]">
                            <div className="flex flex-col items-center gap-2">
                              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <p>No hay ingredientes asignados</p>
                              {puedeEditarRecetas && (
                                <button
                                  onClick={abrirModalIngrediente}
                                  className="mt-2 text-[#116EBF] hover:text-[#025373] text-sm font-medium"
                                >
                                  + Agregar ingrediente
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        ingredientesProducto.map(ing => (
                          <tr key={ing.id} className="border-b border-gray-100 hover:bg-[#F2F2F2] transition-colors group">
                            <td className="py-3 px-6 font-medium text-[#025373]">{ing.items_inventario?.nombre}</td>
                            <td className="py-3 px-6 text-[#595959]">{ing.cantidad_necesaria}</td>
                            <td className="py-3 px-6 text-[#595959]">{ing.items_inventario?.unidad_receta?.abreviatura || '-'}</td>
                            <td className="py-3 px-6 text-[#116EBF]">${Number(ing.items_inventario?.valor_unitario_receta).toFixed(2)}</td>
                            <td className="py-3 px-6 font-semibold text-[#116EBF]">
                              ${(Number(ing.items_inventario?.valor_unitario_receta) * ing.cantidad_necesaria).toFixed(2)}
                            </td>
                            <td className="py-3 px-6">
                              <div className="flex gap-2">
                                {puedeEditarRecetas && (
                                  <button
                                    onClick={() => editarIngrediente(ing)}
                                    className="p-1.5 text-[#116EBF] hover:bg-[#116EBF]/10 rounded-lg transition-colors"
                                    title="Editar cantidad"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                )}
                                {puedeEliminarRecetas && (
                                  <button
                                    onClick={() => eliminarIngrediente(ing.id, ing.items_inventario?.nombre)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {ingredientesProducto.length > 0 && (
                      <tfoot className="bg-[#F2F2F2] border-t border-gray-200">
                        <tr>
                          <td colSpan="4" className="py-3 px-6 text-right font-semibold text-[#025373]">Costo total del producto:</td>
                          <td className="py-3 px-6 font-bold text-xl text-[#116EBF]">${costoTotal.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h3 className="font-semibold text-[#025373] mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Información financiera
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-[#595959]">Costo total:</span>
                      <span className="font-semibold text-[#116EBF]">${costoTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-[#595959]">Precio de venta actual:</span>
                      <span className="font-semibold text-[#025373]">${precioVenta.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-[#595959]">Utilidad:</span>
                      <span className={`font-semibold ${utilidad >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ${utilidad.toFixed(2)} ({margenActual.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h3 className="font-semibold text-[#025373] mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Recomendación
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-[#595959]">Precio sugerido (30% margen):</span>
                      <span className="font-semibold text-[#3BD9D9]">${precioSugerido.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-[#595959]">Utilidad sugerida:</span>
                      <span className="font-semibold text-green-600">${(precioSugerido - costoTotal).toFixed(2)} (30%)</span>
                    </div>
                    {precioVenta < precioSugerido && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-xs text-yellow-700">
                          ⚠️ El precio actual es menor al sugerido. Considera ajustar el precio para mejorar tu margen de ganancia.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[#595959]">Selecciona un producto de la lista para ver y gestionar su receta</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL AGREGAR/EDITAR INGREDIENTE */}
      {modalIngrediente.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                {modalIngrediente.editing ? '✏️ Editar cantidad' : '➕ Agregar ingrediente'}
              </h3>
              <p className="text-white/70 text-sm mt-1">
                {modalIngrediente.editing ? 'Modifica la cantidad necesaria' : `Para: ${productoSeleccionado?.nombre}`}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {!modalIngrediente.editing && (
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Ingrediente *</label>
                  <select
                    value={modalIngrediente.data.item_inventario_id}
                    onChange={(e) => setModalIngrediente({
                      ...modalIngrediente,
                      data: { ...modalIngrediente.data, item_inventario_id: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
                  >
                    <option value="">Seleccionar ingrediente</option>
                    {itemsInventario.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nombre} - {item.unidad_receta?.abreviatura} (${Number(item.valor_unitario_receta).toFixed(2)}/{item.unidad_receta?.abreviatura})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Cantidad necesaria *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={modalIngrediente.data.cantidad_necesaria}
                    onChange={(e) => setModalIngrediente({
                      ...modalIngrediente,
                      data: { ...modalIngrediente.data, cantidad_necesaria: e.target.value }
                    })}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                  />
                  {modalIngrediente.data.item_inventario_id && (
                    <span className="absolute right-3 top-2.5 text-sm text-[#595959]">
                      {itemsInventario.find(i => i.id === parseInt(modalIngrediente.data.item_inventario_id))?.unidad_receta?.abreviatura}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#595959] mt-1">
                  Cantidad necesaria para preparar una porción
                </p>
              </div>
              
              {modalIngrediente.data.item_inventario_id && modalIngrediente.data.cantidad_necesaria && (
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-sm text-[#595959] text-center">Costo estimado de este ingrediente</p>
                  <p className="text-xl font-bold text-[#116EBF] text-center">
                    ${(itemsInventario.find(i => i.id === parseInt(modalIngrediente.data.item_inventario_id))?.valor_unitario_receta * parseFloat(modalIngrediente.data.cantidad_necesaria)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button
                onClick={() => setModalIngrediente({ open: false, editing: null, data: { producto_id: '', item_inventario_id: '', cantidad_necesaria: '' } })}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarIngrediente}
                className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-colors shadow-md"
              >
                {modalIngrediente.editing ? 'Actualizar' : 'Agregar'}
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
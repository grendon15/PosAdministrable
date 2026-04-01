'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function MenuPage() {
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [productosFiltrados, setProductosFiltrados] = useState([]);
  const [combos, setCombos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vistaActiva, setVistaActiva] = useState('categorias');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Permisos
  const { puedeVer, puedeCrear, puedeEditar, puedeEliminar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('menu');
  const puedeGuardar = puedeCrear('menu') || puedeEditar('menu');
  const puedeEliminarItem = puedeEliminar('menu');
  
  // Estados para modales
  const [modalCategoria, setModalCategoria] = useState({ open: false, editing: null, nombre: '' });
  const [modalProducto, setModalProducto] = useState({ 
    open: false, 
    editing: null, 
    data: { nombre: '', precio_venta: '', categoria_id: '', activo: true }
  });
  const [modalCombo, setModalCombo] = useState({
    open: false,
    editing: null,
    data: {
      nombre: '',
      precio_base: 0,
      productos: [],
      precio_total: 0,
      activo: true
    },
    categoriaSeleccionada: '',
    productosFiltrados: []
  });

  useEffect(() => {
    if (tienePermiso) {
      cargarDatos();
    } else {
      setCargando(false);
    }
  }, [tienePermiso]);

  useEffect(() => {
    filtrarProductos();
  }, [productos, filtroNombre, filtroCategoria]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function cargarDatos() {
    setCargando(true);
    
    const { data: categoriasData } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre');
    
    const { data: productosData } = await supabase
      .from('productos')
      .select('*, categorias(*)')
      .order('nombre');
    
    const { data: combosData } = await supabase
      .from('combos')
      .select(`
        *,
        combo_productos (
          *,
          productos:producto_id (*)
        )
      `)
      .order('nombre');
    
    setCategorias(categoriasData || []);
    setProductos(productosData || []);
    setCombos(combosData || []);
    setCargando(false);
  }

  function filtrarProductos() {
    let filtrados = [...productos];
    if (filtroNombre) {
      filtrados = filtrados.filter(p => 
        p.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
      );
    }
    if (filtroCategoria) {
      filtrados = filtrados.filter(p => p.categoria_id === parseInt(filtroCategoria));
    }
    setProductosFiltrados(filtrados);
  }

  const productosPorCategoria = (categoriaId) => {
    return productos.filter(p => p.categoria_id === categoriaId && p.activo);
  };

  // ========== FUNCIONES CATEGORÍAS ==========
  async function guardarCategoria() {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar categorías', 'error');
      return;
    }
    if (!modalCategoria.nombre.trim()) return;
    
    if (modalCategoria.editing) {
      await supabase
        .from('categorias')
        .update({ nombre: modalCategoria.nombre })
        .eq('id', modalCategoria.editing.id);
      mostrarNotificacion('Categoría actualizada', 'success');
    } else {
      await supabase
        .from('categorias')
        .insert({ nombre: modalCategoria.nombre });
      mostrarNotificacion('Categoría creada', 'success');
    }
    setModalCategoria({ open: false, editing: null, nombre: '' });
    cargarDatos();
  }

  async function toggleCategoriaActiva(id, activoActual) {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar categorías', 'error');
      return;
    }
    await supabase
      .from('categorias')
      .update({ activo: !activoActual })
      .eq('id', id);
    cargarDatos();
  }

  // ========== FUNCIONES PRODUCTOS ==========
  async function guardarProducto() {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar productos', 'error');
      return;
    }
    const data = modalProducto.data;
    if (!data.nombre.trim() || !data.precio_venta || !data.categoria_id) {
      mostrarNotificacion('Por favor completa todos los campos', 'error');
      return;
    }
    
    if (modalProducto.editing) {
      await supabase
        .from('productos')
        .update({
          nombre: data.nombre,
          precio_venta: parseFloat(data.precio_venta),
          categoria_id: parseInt(data.categoria_id),
          activo: data.activo
        })
        .eq('id', modalProducto.editing.id);
      mostrarNotificacion('Producto actualizado', 'success');
    } else {
      await supabase
        .from('productos')
        .insert({
          nombre: data.nombre,
          precio_venta: parseFloat(data.precio_venta),
          categoria_id: parseInt(data.categoria_id),
          activo: data.activo
        });
      mostrarNotificacion('Producto creado', 'success');
    }
    setModalProducto({ open: false, editing: null, data: { nombre: '', precio_venta: '', categoria_id: '', activo: true } });
    cargarDatos();
  }

  async function toggleProductoActivo(id, activoActual) {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar productos', 'error');
      return;
    }
    await supabase
      .from('productos')
      .update({ activo: !activoActual })
      .eq('id', id);
    cargarDatos();
  }

  async function eliminarProducto(id) {
    if (!puedeEliminarItem) {
      mostrarNotificacion('No tienes permisos para eliminar productos', 'error');
      return;
    }
    if (!confirm('¿Eliminar este producto permanentemente?')) return;
    await supabase.from('productos').delete().eq('id', id);
    mostrarNotificacion('Producto eliminado', 'success');
    cargarDatos();
  }

  // ========== FUNCIONES COMBOS ==========
  async function guardarCombo() {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar combos', 'error');
      return;
    }
    const data = modalCombo.data;
    if (!data.nombre.trim() || data.precio_base <= 0) {
      mostrarNotificacion('Completa todos los campos del combo', 'error');
      return;
    }
    
    const sumaAdicionales = data.productos.reduce((total, item) => {
      return total + ((item.precio_adicional || 0) * (item.cantidad || 1));
    }, 0);
    const precioTotal = data.precio_base + sumaAdicionales;
    
    if (modalCombo.editing) {
      await supabase
        .from('combos')
        .update({
          nombre: data.nombre,
          precio_base: data.precio_base,
          precio_total: precioTotal,
          activo: data.activo
        })
        .eq('id', modalCombo.editing.id);
      
      await supabase
        .from('combo_productos')
        .delete()
        .eq('combo_id', modalCombo.editing.id);
      
      for (const item of data.productos) {
        await supabase
          .from('combo_productos')
          .insert({
            combo_id: modalCombo.editing.id,
            producto_id: item.producto_id,
            precio_adicional: item.precio_adicional || 0,
            cantidad: item.cantidad || 1
          });
      }
      mostrarNotificacion('Combo actualizado', 'success');
    } else {
      const { data: nuevoCombo } = await supabase
        .from('combos')
        .insert({
          nombre: data.nombre,
          precio_base: data.precio_base,
          precio_total: precioTotal,
          activo: data.activo
        })
        .select()
        .single();
      
      if (nuevoCombo && data.productos.length > 0) {
        for (const item of data.productos) {
          await supabase
            .from('combo_productos')
            .insert({
              combo_id: nuevoCombo.id,
              producto_id: item.producto_id,
              precio_adicional: item.precio_adicional || 0,
              cantidad: item.cantidad || 1
            });
        }
      }
      mostrarNotificacion('Combo creado', 'success');
    }
    
    setModalCombo({ open: false, editing: null, data: { nombre: '', precio_base: 0, productos: [], precio_total: 0, activo: true }, categoriaSeleccionada: '', productosFiltrados: [] });
    cargarDatos();
  }

  async function eliminarCombo(id) {
    if (!puedeEliminarItem) {
      mostrarNotificacion('No tienes permisos para eliminar combos', 'error');
      return;
    }
    if (!confirm('¿Eliminar este combo permanentemente?')) return;
    await supabase.from('combos').delete().eq('id', id);
    mostrarNotificacion('Combo eliminado', 'success');
    cargarDatos();
  }

  async function toggleComboActivo(id, activoActual) {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar combos', 'error');
      return;
    }
    await supabase
      .from('combos')
      .update({ activo: !activoActual })
      .eq('id', id);
    cargarDatos();
  }

  function abrirModalCategoria(editar = null) {
    setModalCategoria({
      open: true,
      editing: editar,
      nombre: editar ? editar.nombre : ''
    });
  }

  function abrirModalProducto(editar = null) {
    setModalProducto({
      open: true,
      editing: editar,
      data: editar ? {
        nombre: editar.nombre,
        precio_venta: editar.precio_venta,
        categoria_id: editar.categoria_id || '',
        activo: editar.activo
      } : { nombre: '', precio_venta: '', categoria_id: '', activo: true }
    });
  }

  function abrirModalCombo(editar = null) {
    if (editar) {
      const productosCombo = (editar.combo_productos || []).map(cp => ({
        producto_id: cp.producto_id,
        producto_nombre: cp.productos?.nombre || 'Producto',
        precio_adicional: cp.precio_adicional,
        cantidad: cp.cantidad
      }));
      
      setModalCombo({
        open: true,
        editing: editar,
        data: {
          nombre: editar.nombre,
          precio_base: editar.precio_base || 0,
          productos: productosCombo,
          precio_total: editar.precio_total,
          activo: editar.activo
        },
        categoriaSeleccionada: '',
        productosFiltrados: []
      });
    } else {
      setModalCombo({
        open: true,
        editing: null,
        data: {
          nombre: '',
          precio_base: 0,
          productos: [],
          precio_total: 0,
          activo: true
        },
        categoriaSeleccionada: '',
        productosFiltrados: []
      });
    }
  }

  function filtrarProductosPorCategoria(categoriaId) {
    if (!categoriaId) {
      setModalCombo({ ...modalCombo, productosFiltrados: [] });
      return;
    }
    const filtrados = productos.filter(p => p.categoria_id === parseInt(categoriaId) && p.activo);
    setModalCombo({ ...modalCombo, categoriaSeleccionada: categoriaId, productosFiltrados: filtrados });
  }

  function agregarProductoACombo(producto) {
    const yaAgregado = modalCombo.data.productos.find(p => p.producto_id === producto.id);
    if (yaAgregado) {
      mostrarNotificacion('Este producto ya está en el combo', 'warning');
      return;
    }
    
    setModalCombo({
      ...modalCombo,
      data: {
        ...modalCombo.data,
        productos: [...modalCombo.data.productos, {
          producto_id: producto.id,
          producto_nombre: producto.nombre,
          precio_adicional: 0,
          cantidad: 1
        }]
      }
    });
  }

  function eliminarProductoDeCombo(index) {
    const nuevosProductos = [...modalCombo.data.productos];
    nuevosProductos.splice(index, 1);
    setModalCombo({ ...modalCombo, data: { ...modalCombo.data, productos: nuevosProductos } });
  }

  function actualizarPrecioAdicional(index, nuevoPrecio) {
    const nuevosProductos = [...modalCombo.data.productos];
    nuevosProductos[index].precio_adicional = parseFloat(nuevoPrecio) || 0;
    setModalCombo({ ...modalCombo, data: { ...modalCombo.data, productos: nuevosProductos } });
  }

  const calcularPrecioTotalCombo = () => {
    const sumaAdicionales = modalCombo.data.productos.reduce((total, item) => {
      return total + ((item.precio_adicional || 0) * (item.cantidad || 1));
    }, 0);
    return modalCombo.data.precio_base + sumaAdicionales;
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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Menú.</p>
          <p className="text-sm text-[#595959] mt-2">Contacta al administrador si crees que deberías tener acceso.</p>
        </div>
      </div>
    );
  }

  if (cargando || cargandoPermisos) {
    return <LoadingAnimation />;
  }

  return (
    <div className="space-y-8">
      <NotificationToast
        show={notificacion.show}
        message={notificacion.message}
        type={notificacion.type}
        onClose={() => setNotificacion({ show: false, message: '', type: 'success' })}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#025373]">Gestión de Menú</h1>
          <p className="text-[#595959] mt-1">Administra categorías, productos y combos especiales</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setVistaActiva('categorias')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'categorias'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          📁 Categorías
        </button>
        <button
          onClick={() => setVistaActiva('productos')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'productos'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          🍔 Productos
        </button>
        <button
          onClick={() => setVistaActiva('combos')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'combos'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          🎯 Combos
        </button>
      </div>

      {/* VISTA DE CATEGORÍAS */}
      {vistaActiva === 'categorias' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-[#025373]">Todas las categorías</h2>
            {puedeGuardar && (
              <button
                onClick={() => abrirModalCategoria()}
                className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva categoría
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categorias.map(cat => (
              <div key={cat.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#025373]">{cat.nombre}</h3>
                    <p className="text-sm text-[#595959] mt-1">
                      {productosPorCategoria(cat.id).length} productos
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    cat.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {cat.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {puedeGuardar && (
                  <div className="flex gap-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => abrirModalCategoria(cat)}
                      className="text-[#116EBF] hover:text-[#025373] text-sm flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar
                    </button>
                    <button
                      onClick={() => toggleCategoriaActiva(cat.id, cat.activo)}
                      className={`text-sm flex items-center gap-1 ${
                        cat.activo ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                      </svg>
                      {cat.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTA DE PRODUCTOS */}
      {vistaActiva === 'productos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-[#025373]">Productos</h2>
            {puedeGuardar && (
              <button
                onClick={() => abrirModalProducto()}
                className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo producto
              </button>
            )}
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={filtroNombre}
                    onChange={(e) => setFiltroNombre(e.target.value)}
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
                {categorias.filter(c => c.activo).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
              {(filtroNombre || filtroCategoria) && (
                <button
                  onClick={() => { setFiltroNombre(''); setFiltroCategoria(''); }}
                  className="px-4 py-2.5 text-[#595959] hover:text-[#116EBF]"
                >
                  Limpiar ✖
                </button>
              )}
            </div>
          </div>

          {/* Tabla de productos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Producto</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Categoría</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Precio</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Estado</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-12 text-[#595959]">
                        No hay productos que coincidan con los filtros
                      </td>
                    </tr>
                  ) : (
                    productosFiltrados.map(prod => (
                      <tr key={prod.id} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                        <td className="py-4 px-5 font-medium text-[#025373]">{prod.nombre}</td>
                        <td className="py-4 px-5">{prod.categorias?.nombre || 'Sin categoría'}</td>
                        <td className="py-4 px-5 text-right text-[#116EBF] font-semibold">
                          ${Number(prod.precio_venta).toLocaleString()}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            prod.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {prod.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="flex gap-2 justify-center">
                            {puedeGuardar && (
                              <>
                                <button
                                  onClick={() => abrirModalProducto(prod)}
                                  className="p-1.5 text-[#116EBF] hover:bg-[#116EBF]/10 rounded-lg"
                                  title="Editar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => toggleProductoActivo(prod.id, prod.activo)}
                                  className={`p-1.5 rounded-lg ${prod.activo ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}
                                  title={prod.activo ? 'Desactivar' : 'Activar'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                                  </svg>
                                </button>
                              </>
                            )}
                            {puedeEliminarItem && (
                              <button
                                onClick={() => eliminarProducto(prod.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
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
              </table>
            </div>
            <div className="px-5 py-3 bg-[#F2F2F2] border-t border-gray-200 text-sm text-[#595959]">
              Mostrando {productosFiltrados.length} de {productos.length} productos
            </div>
          </div>
        </div>
      )}


      {/* VISTA DE COMBOS */}
      {vistaActiva === 'combos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-[#025373]">Combos especiales</h2>
            {puedeGuardar && (
              <button
                onClick={() => abrirModalCombo()}
                className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo combo
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {combos.map(combo => (
                <div key={combo.id} className="p-4 hover:bg-[#F2F2F2] transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-[#025373] text-lg">{combo.nombre}</h3>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          combo.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {combo.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="text-sm text-[#595959]">Precio base: </span>
                        <span className="text-[#116EBF] font-semibold">${combo.precio_base?.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {(combo.combo_productos || []).map((cp, idx) => (
                          <div key={idx} className="text-sm text-[#595959] flex items-center gap-2 ml-4">
                            <span>➕ {cp.productos?.nombre}</span>
                            <span className="text-[#116EBF]">+${cp.precio_adicional?.toLocaleString()}</span>
                            {cp.cantidad > 1 && <span className="text-xs">(x{cp.cantidad})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#116EBF] font-bold text-xl">
                        ${combo.precio_total?.toLocaleString() || 0}
                      </div>
                      {puedeGuardar && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => abrirModalCombo(combo)}
                            className="text-[#116EBF] hover:text-[#025373] text-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => toggleComboActivo(combo.id, combo.activo)}
                            className={`text-sm ${
                              combo.activo ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'
                            }`}
                          >
                            {combo.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          {puedeEliminarItem && (
                            <button
                              onClick={() => eliminarCombo(combo.id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATEGORÍA */}
      {modalCategoria.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                {modalCategoria.editing ? 'Editar categoría' : 'Nueva categoría'}
              </h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-[#595959] mb-2">Nombre de la categoría</label>
              <input
                type="text"
                value={modalCategoria.nombre}
                onChange={(e) => setModalCategoria({...modalCategoria, nombre: e.target.value})}
                placeholder="Ej: Bebidas, Postres..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalCategoria({ open: false, editing: null, nombre: '' })} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
              <button onClick={guardarCategoria} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373]">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUCTO */}
      {modalProducto.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                {modalProducto.editing ? 'Editar producto' : 'Nuevo producto'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="text"
                placeholder="Nombre del producto *"
                value={modalProducto.data.nombre}
                onChange={(e) => setModalProducto({...modalProducto, data: {...modalProducto.data, nombre: e.target.value}})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg"
              />
              <select
                value={modalProducto.data.categoria_id}
                onChange={(e) => setModalProducto({...modalProducto, data: {...modalProducto.data, categoria_id: e.target.value}})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white"
              >
                <option value="">Seleccionar categoría *</option>
                {categorias.filter(c => c.activo).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#595959]">$</span>
                <input
                  type="number"
                  placeholder="Precio de venta *"
                  value={modalProducto.data.precio_venta}
                  onChange={(e) => setModalProducto({...modalProducto, data: {...modalProducto.data, precio_venta: e.target.value}})}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modalProducto.data.activo}
                  onChange={(e) => setModalProducto({...modalProducto, data: {...modalProducto.data, activo: e.target.checked}})}
                  className="w-4 h-4 text-[#116EBF]"
                />
                <span>Activo</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalProducto({ open: false, editing: null, data: { nombre: '', precio_venta: '', categoria_id: '', activo: true } })} className="px-5 py-2.5 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={guardarProducto} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMBO */}
      {modalCombo.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8">
            <div className="bg-gradient-to-r from-[#3BD9D9] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-2xl font-bold text-white">
                {modalCombo.editing ? '✏️ Editar combo' : '🎯 Crear nuevo combo'}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                Define el precio base del combo y agrega productos con precio adicional
              </p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nombre del combo *"
                  value={modalCombo.data.nombre}
                  onChange={(e) => setModalCombo({...modalCombo, data: {...modalCombo.data, nombre: e.target.value}})}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg"
                />
                <div className="relative">
                  <span className="absolute left-3 top-2.5">$</span>
                  <input
                    type="number"
                    placeholder="Precio base *"
                    value={modalCombo.data.precio_base}
                    onChange={(e) => setModalCombo({...modalCombo, data: {...modalCombo.data, precio_base: parseFloat(e.target.value) || 0}})}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-[#F2F2F2] rounded-xl p-4">
                <h4 className="font-semibold text-[#025373] mb-3">Agregar productos al combo</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    value={modalCombo.categoriaSeleccionada}
                    onChange={(e) => filtrarProductosPorCategoria(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categorias.filter(c => c.activo).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                    {modalCombo.productosFiltrados.map(prod => (
                      <button
                        key={prod.id}
                        onClick={() => agregarProductoACombo(prod)}
                        className="w-full text-left px-3 py-2 hover:bg-[#116EBF] hover:text-white transition-colors flex justify-between items-center border-b"
                      >
                        <span>{prod.nombre}</span>
                        <span className="text-xs">${prod.precio_venta}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {modalCombo.data.productos.length > 0 && (
                <div>
                  <h4 className="font-semibold text-[#025373] mb-3">Productos incluidos</h4>
                  <div className="space-y-2 border border-gray-200 rounded-xl p-4">
                    {modalCombo.data.productos.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-[#F2F2F2] rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{item.producto_nombre}</p>
                        </div>
                        <div className="w-32">
                          <div className="relative">
                            <span className="absolute left-2 top-1.5 text-xs">+$</span>
                            <input
                              type="number"
                              value={item.precio_adicional}
                              onChange={(e) => actualizarPrecioAdicional(idx, e.target.value)}
                              className="w-full pl-7 pr-2 py-1 border rounded text-sm"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => {
                              const nuevos = [...modalCombo.data.productos];
                              nuevos[idx].cantidad = parseInt(e.target.value) || 1;
                              setModalCombo({...modalCombo, data: {...modalCombo.data, productos: nuevos}});
                            }}
                            min="1"
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <button
                          onClick={() => eliminarProductoDeCombo(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-[#116EBF]/10 to-[#3BD9D9]/10 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-[#025373]">Resumen del combo</h4>
                    <p className="text-sm text-[#595959]">Precio base + suma de productos adicionales</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[#595959]">Precio total</div>
                    <div className="text-2xl font-bold text-[#116EBF]">
                      ${calcularPrecioTotalCombo().toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modalCombo.data.activo}
                  onChange={(e) => setModalCombo({...modalCombo, data: {...modalCombo.data, activo: e.target.checked}})}
                  className="w-4 h-4 text-[#116EBF]"
                />
                <span>Activo</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalCombo({ open: false, editing: null, data: { nombre: '', precio_base: 0, productos: [], precio_total: 0, activo: true }, categoriaSeleccionada: '', productosFiltrados: [] })} className="px-6 py-2.5 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={guardarCombo} className="px-6 py-2.5 bg-[#116EBF] text-white rounded-lg">Guardar</button>
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
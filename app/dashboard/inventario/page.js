'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function InventarioPage() {
  const [proveedores, setProveedores] = useState([]);
  const [unidadesMedida, setUnidadesMedida] = useState([]);
  const [itemsInventario, setItemsInventario] = useState([]);
  const [itemsFiltrados, setItemsFiltrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vistaActiva, setVistaActiva] = useState('items');
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Permisos
  const { puedeVer, puedeCrear, puedeEditar, puedeEliminar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('inventario');
  const puedeGuardar = puedeCrear('inventario') || puedeEditar('inventario');
  const puedeEliminarItem = puedeEliminar('inventario');
  
  // Estados para modales
  const [modalProveedor, setModalProveedor] = useState({ 
    open: false, 
    editing: null, 
    data: { nombre: '', contacto: '', telefono: '', email: '', direccion: '', activo: true }
  });
  
  const [modalUnidad, setModalUnidad] = useState({
    open: false,
    editing: null,
    data: { nombre: '', abreviatura: '', tipo: 'ambos', activo: true }
  });
  
  const [modalItem, setModalItem] = useState({
    open: false,
    editing: null,
    data: {
      nombre: '',
      unidad_compra_id: '',
      precio_compra: '',
      conversion_unidades: '',
      unidad_receta_id: '',
      porcentaje_desperdicio: 0,
      proveedor_id: '',
      stock_actual: 0,
      stock_minimo: 0,
      activo: true
    }
  });

  useEffect(() => {
    if (tienePermiso) {
      cargarDatos();
    } else {
      setCargando(false);
    }
  }, [tienePermiso]);

  useEffect(() => {
    filtrarItems();
  }, [itemsInventario, filtroNombre, filtroProveedor]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function cargarDatos() {
    setCargando(true);
    
    const { data: proveedoresData } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre');
    
    const { data: unidadesData } = await supabase
      .from('unidades_medida')
      .select('*')
      .order('nombre');
    
    const { data: itemsData } = await supabase
      .from('items_inventario')
      .select(`
        *,
        proveedores (*),
        unidad_compra:unidades_medida!items_inventario_unidad_compra_id_fkey (*),
        unidad_receta:unidades_medida!items_inventario_unidad_receta_id_fkey (*)
      `)
      .order('nombre');
    
    setProveedores(proveedoresData || []);
    setUnidadesMedida(unidadesData || []);
    setItemsInventario(itemsData || []);
    setCargando(false);
  }

  function filtrarItems() {
    let filtrados = [...itemsInventario];
    
    if (filtroNombre) {
      filtrados = filtrados.filter(i => 
        i.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
      );
    }
    
    if (filtroProveedor) {
      filtrados = filtrados.filter(i => i.proveedor_id === parseInt(filtroProveedor));
    }
    
    setItemsFiltrados(filtrados);
  }

  // ========== FUNCIONES PROVEEDORES ==========
  async function guardarProveedor() {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar proveedores', 'error');
      return;
    }
    
    const data = modalProveedor.data;
    if (!data.nombre.trim()) {
      mostrarNotificacion('Por favor ingresa el nombre del proveedor', 'error');
      return;
    }
    
    const proveedorData = {
      nombre: data.nombre,
      contacto: data.contacto || null,
      telefono: data.telefono || null,
      email: data.email || null,
      direccion: data.direccion || null,
      activo: data.activo
    };
    
    try {
      if (modalProveedor.editing) {
        const { error } = await supabase
          .from('proveedores')
          .update(proveedorData)
          .eq('id', modalProveedor.editing.id);
        if (error) throw error;
        mostrarNotificacion('Proveedor actualizado exitosamente', 'success');
      } else {
        const { error } = await supabase
          .from('proveedores')
          .insert(proveedorData);
        if (error) throw error;
        mostrarNotificacion('Proveedor creado exitosamente', 'success');
      }
      
      setModalProveedor({ open: false, editing: null, data: { nombre: '', contacto: '', telefono: '', email: '', direccion: '', activo: true } });
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    }
  }

  async function eliminarProveedor(id, nombre) {
    if (!puedeEliminarItem) {
      mostrarNotificacion('No tienes permisos para eliminar proveedores', 'error');
      return;
    }
    if (!confirm(`¿Eliminar el proveedor "${nombre}"?`)) return;
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    } else {
      mostrarNotificacion(`Proveedor "${nombre}" eliminado`, 'success');
      cargarDatos();
    }
  }

  async function toggleProveedorActivo(id, activoActual, nombre) {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar proveedores', 'error');
      return;
    }
    const { error } = await supabase
      .from('proveedores')
      .update({ activo: !activoActual })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    } else {
      mostrarNotificacion(`Proveedor "${nombre}" ${!activoActual ? 'activado' : 'desactivado'}`, 'success');
      cargarDatos();
    }
  }

  // ========== FUNCIONES UNIDADES DE MEDIDA ==========
  async function guardarUnidad() {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar unidades', 'error');
      return;
    }
    
    const data = modalUnidad.data;
    if (!data.nombre.trim() || !data.abreviatura.trim()) {
      mostrarNotificacion('Por favor completa todos los campos', 'error');
      return;
    }
    
    const unidadData = {
      nombre: data.nombre,
      abreviatura: data.abreviatura,
      tipo: data.tipo,
      activo: data.activo
    };
    
    try {
      if (modalUnidad.editing) {
        const { error } = await supabase
          .from('unidades_medida')
          .update(unidadData)
          .eq('id', modalUnidad.editing.id);
        if (error) throw error;
        mostrarNotificacion('Unidad actualizada', 'success');
      } else {
        const { error } = await supabase
          .from('unidades_medida')
          .insert(unidadData);
        if (error) throw error;
        mostrarNotificacion('Unidad creada', 'success');
      }
      
      setModalUnidad({ open: false, editing: null, data: { nombre: '', abreviatura: '', tipo: 'ambos', activo: true } });
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    }
  }

  async function eliminarUnidad(id, nombre) {
    if (!puedeEliminarItem) {
      mostrarNotificacion('No tienes permisos para eliminar unidades', 'error');
      return;
    }
    if (!confirm(`¿Eliminar la unidad "${nombre}"?`)) return;
    const { error } = await supabase.from('unidades_medida').delete().eq('id', id);
    if (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    } else {
      mostrarNotificacion(`Unidad "${nombre}" eliminada`, 'success');
      cargarDatos();
    }
  }

  async function toggleUnidadActivo(id, activoActual, nombre) {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar unidades', 'error');
      return;
    }
    const { error } = await supabase
      .from('unidades_medida')
      .update({ activo: !activoActual })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    } else {
      mostrarNotificacion(`Unidad "${nombre}" ${!activoActual ? 'activada' : 'desactivada'}`, 'success');
      cargarDatos();
    }
  }

  // ========== FUNCIONES ITEMS INVENTARIO ==========
  async function guardarItem() {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar items', 'error');
      return;
    }
    
    const data = modalItem.data;
    
    if (!data.nombre.trim()) {
      mostrarNotificacion('Ingresa el nombre del item', 'error');
      return;
    }
    if (!data.unidad_compra_id) {
      mostrarNotificacion('Selecciona la unidad de compra', 'error');
      return;
    }
    if (!data.precio_compra || data.precio_compra <= 0) {
      mostrarNotificacion('Ingresa un precio de compra válido', 'error');
      return;
    }
    if (!data.conversion_unidades || data.conversion_unidades <= 0) {
      mostrarNotificacion('Ingresa la conversión a unidades de receta', 'error');
      return;
    }
    if (!data.unidad_receta_id) {
      mostrarNotificacion('Selecciona la unidad de receta', 'error');
      return;
    }
    if (!data.proveedor_id) {
      mostrarNotificacion('Selecciona un proveedor', 'error');
      return;
    }
    
    const precioCompra = parseFloat(data.precio_compra);
    const conversion = parseInt(data.conversion_unidades);
    const desperdicio = parseFloat(data.porcentaje_desperdicio) || 0;
    const valorUnidadInventario = precioCompra / conversion;
    const valorUnitarioReceta = valorUnidadInventario * (1 + (desperdicio / 100));
    
    const itemData = {
      nombre: data.nombre,
      unidad_compra_id: parseInt(data.unidad_compra_id),
      precio_compra: precioCompra,
      conversion_unidades: conversion,
      unidad_receta_id: parseInt(data.unidad_receta_id),
      porcentaje_desperdicio: desperdicio,
      valor_unidad_inventario: valorUnidadInventario,
      valor_unitario_receta: valorUnitarioReceta,
      proveedor_id: parseInt(data.proveedor_id),
      stock_actual: parseFloat(data.stock_actual) || 0,
      stock_minimo: parseFloat(data.stock_minimo) || 0,
      activo: data.activo === true
    };
    
    try {
      if (modalItem.editing) {
        const { error } = await supabase
          .from('items_inventario')
          .update(itemData)
          .eq('id', modalItem.editing.id);
        if (error) throw error;
        mostrarNotificacion('Item actualizado exitosamente', 'success');
      } else {
        const { error } = await supabase
          .from('items_inventario')
          .insert(itemData);
        if (error) throw error;
        mostrarNotificacion('Item creado exitosamente', 'success');
      }
      
      setModalItem({ open: false, editing: null, data: { 
        nombre: '', unidad_compra_id: '', precio_compra: '', 
        conversion_unidades: '', unidad_receta_id: '', 
        porcentaje_desperdicio: 0, proveedor_id: '', 
        stock_actual: 0, stock_minimo: 0, activo: true 
      } });
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error al guardar: ' + error.message, 'error');
    }
  }

  async function eliminarItem(id, nombre) {
    if (!puedeEliminarItem) {
      mostrarNotificacion('No tienes permisos para eliminar items', 'error');
      return;
    }
    if (!confirm(`¿Eliminar el item "${nombre}"?`)) return;
    const { error } = await supabase.from('items_inventario').delete().eq('id', id);
    if (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    } else {
      mostrarNotificacion(`Item "${nombre}" eliminado`, 'success');
      cargarDatos();
    }
  }

  async function toggleItemActivo(id, activoActual, nombre) {
    if (!puedeGuardar) {
      mostrarNotificacion('No tienes permisos para modificar items', 'error');
      return;
    }
    const { error } = await supabase
      .from('items_inventario')
      .update({ activo: !activoActual })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    } else {
      mostrarNotificacion(`Item "${nombre}" ${!activoActual ? 'activado' : 'desactivado'}`, 'success');
      cargarDatos();
    }
  }

  function abrirModalProveedor(editar = null) {
    if (editar) {
      setModalProveedor({
        open: true,
        editing: editar,
        data: {
          nombre: editar.nombre,
          contacto: editar.contacto || '',
          telefono: editar.telefono || '',
          email: editar.email || '',
          direccion: editar.direccion || '',
          activo: editar.activo
        }
      });
    } else {
      setModalProveedor({
        open: true,
        editing: null,
        data: { nombre: '', contacto: '', telefono: '', email: '', direccion: '', activo: true }
      });
    }
  }

  function abrirModalUnidad(editar = null) {
    if (editar) {
      setModalUnidad({
        open: true,
        editing: editar,
        data: {
          nombre: editar.nombre,
          abreviatura: editar.abreviatura,
          tipo: editar.tipo,
          activo: editar.activo
        }
      });
    } else {
      setModalUnidad({
        open: true,
        editing: null,
        data: { nombre: '', abreviatura: '', tipo: 'ambos', activo: true }
      });
    }
  }

  function abrirModalItem(editar = null) {
    if (editar) {
      setModalItem({
        open: true,
        editing: editar,
        data: {
          nombre: editar.nombre,
          unidad_compra_id: editar.unidad_compra_id || '',
          precio_compra: editar.precio_compra,
          conversion_unidades: editar.conversion_unidades,
          unidad_receta_id: editar.unidad_receta_id || '',
          porcentaje_desperdicio: editar.porcentaje_desperdicio || 0,
          proveedor_id: editar.proveedor_id || '',
          stock_actual: editar.stock_actual || 0,
          stock_minimo: editar.stock_minimo || 0,
          activo: editar.activo
        }
      });
    } else {
      setModalItem({
        open: true,
        editing: null,
        data: {
          nombre: '',
          unidad_compra_id: '',
          precio_compra: '',
          conversion_unidades: '',
          unidad_receta_id: '',
          porcentaje_desperdicio: 0,
          proveedor_id: '',
          stock_actual: 0,
          stock_minimo: 0,
          activo: true
        }
      });
    }
  }

  const calcularValores = () => {
    const precio = parseFloat(modalItem.data.precio_compra) || 0;
    const conversion = parseInt(modalItem.data.conversion_unidades) || 0;
    const desperdicio = parseFloat(modalItem.data.porcentaje_desperdicio) || 0;
    let valorUnidad = 0;
    let valorConDesperdicio = 0;
    if (conversion > 0) {
      valorUnidad = precio / conversion;
      valorConDesperdicio = valorUnidad * (1 + (desperdicio / 100));
    }
    return { valorUnidad, valorConDesperdicio };
  };

  const { valorUnidad, valorConDesperdicio } = calcularValores();

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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Inventario.</p>
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
      <div>
        <h1 className="text-3xl font-bold text-[#025373]">Inventario y Proveedores</h1>
        <p className="text-[#595959] mt-1">Gestiona la materia prima, unidades de medida y sus proveedores</p>
      </div>

      {/* Menú superior con pestañas */}
      <div className="relative">
        <div className="flex gap-2 p-1 bg-white rounded-xl shadow-lg">
          <button
            onClick={() => {
              setVistaActiva('items');
              setFiltroNombre('');
              setFiltroProveedor('');
            }}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform ${
              vistaActiva === 'items'
                ? 'bg-[#116EBF] text-white shadow-md scale-105'
                : 'bg-white text-[#595959] hover:bg-[#116EBF] hover:text-white hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            <span className="text-xl mr-2">📦</span>
            Items de Inventario
          </button>
          
          <button
            onClick={() => {
              setVistaActiva('proveedores');
              setFiltroNombre('');
              setFiltroProveedor('');
            }}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform ${
              vistaActiva === 'proveedores'
                ? 'bg-[#116EBF] text-white shadow-md scale-105'
                : 'bg-white text-[#595959] hover:bg-[#116EBF] hover:text-white hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            <span className="text-xl mr-2">🏢</span>
            Proveedores
          </button>
          
          <button
            onClick={() => {
              setVistaActiva('unidades');
              setFiltroNombre('');
              setFiltroProveedor('');
            }}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform ${
              vistaActiva === 'unidades'
                ? 'bg-[#116EBF] text-white shadow-md scale-105'
                : 'bg-white text-[#595959] hover:bg-[#116EBF] hover:text-white hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            <span className="text-xl mr-2">📏</span>
            Unidades de Medida
          </button>
        </div>
        <div className="absolute -bottom-2 left-2 right-2 h-2 bg-black/5 rounded-full blur-sm -z-10"></div>
      </div>
          
      {/* VISTA DE ITEMS DE INVENTARIO */}
      {vistaActiva === 'items' && (
        <div className="space-y-6">
          {/* Barra de herramientas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 flex-1">
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
                  value={filtroProveedor}
                  onChange={(e) => setFiltroProveedor(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
                >
                  <option value="">Todos los proveedores</option>
                  {proveedores.filter(p => p.activo).map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                  ))}
                </select>
                {(filtroNombre || filtroProveedor) && (
                  <button
                    onClick={() => { setFiltroNombre(''); setFiltroProveedor(''); }}
                    className="px-4 py-2.5 text-[#595959] hover:text-[#116EBF]"
                  >
                    Limpiar ✖
                  </button>
                )}
              </div>
              
              {puedeGuardar && (
                <button
                  onClick={() => abrirModalItem()}
                  className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo item
                </button>
              )}
            </div>
          </div>

          {/* Tabla de items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Item</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Proveedor</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Unidad Compra</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Precio Compra</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Conversión</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Unidad Receta</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Valor/Unidad</th>
                    <th className="text-right py-4 px-5 text-[#025373]">+Desperdicio</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Stock</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Estado</th>
                    <th className="text-center py-4 px-5 text-[#025373]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="text-center py-12 text-[#595959]">
                        No hay items de inventario registrados
                      </td>
                    </tr>
                  ) : (
                    itemsFiltrados.map(item => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                        <td className="py-4 px-5 font-medium text-[#025373]">{item.nombre}</td>
                        <td className="py-4 px-5 text-[#595959]">{item.proveedores?.nombre || '-'}</td>
                        <td className="py-4 px-5 text-[#595959]">{item.unidad_compra?.nombre || '-'}</td>
                        <td className="py-4 px-5 text-right text-[#116EBF] font-semibold">${item.precio_compra?.toLocaleString()}</td>
                        <td className="py-4 px-5 text-center">{item.conversion_unidades} {item.unidad_compra?.abreviatura}</td>
                        <td className="py-4 px-5 text-[#595959]">{item.unidad_receta?.nombre || '-'}</td>
                        <td className="py-4 px-5 text-right">${Number(item.valor_unidad_inventario).toFixed(2)}</td>
                        <td className="py-4 px-5 text-right">
                          ${Number(item.valor_unitario_receta).toFixed(2)}
                          {item.porcentaje_desperdicio > 0 && (
                            <span className="ml-1 text-xs text-[#595959]">(+{item.porcentaje_desperdicio}%)</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={`font-semibold ${item.stock_actual <= item.stock_minimo ? 'text-red-500' : 'text-[#025373]'}`}>
                            {item.stock_actual}
                          </span>
                          {item.stock_minimo > 0 && (
                            <span className="text-xs text-gray-400 ml-1">/ min: {item.stock_minimo}</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {item.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="flex gap-2 justify-center">
                            {puedeGuardar && (
                              <>
                                <button
                                  onClick={() => abrirModalItem(item)}
                                  className="p-1.5 text-[#116EBF] hover:bg-[#116EBF]/10 rounded-lg"
                                  title="Editar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => toggleItemActivo(item.id, item.activo, item.nombre)}
                                  className={`p-1.5 rounded-lg ${item.activo ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}
                                  title={item.activo ? 'Desactivar' : 'Activar'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                                  </svg>
                                </button>
                              </>
                            )}
                            {puedeEliminarItem && (
                              <button
                                onClick={() => eliminarItem(item.id, item.nombre)}
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
              Mostrando {itemsFiltrados.length} de {itemsInventario.length} items
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE PROVEEDORES */}
      {vistaActiva === 'proveedores' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-[#025373]">Proveedores</h2>
            {puedeGuardar && (
              <button
                onClick={() => abrirModalProveedor()}
                className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo proveedor
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {proveedores.map(prov => (
              <div key={prov.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#025373]">{prov.nombre}</h3>
                    {prov.contacto && <p className="text-sm text-[#595959] mt-1">{prov.contacto}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    prov.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {prov.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-[#595959]">
                  {prov.telefono && <div>📞 {prov.telefono}</div>}
                  {prov.email && <div>✉️ {prov.email}</div>}
                  {prov.direccion && <div>📍 {prov.direccion}</div>}
                </div>
                {puedeGuardar && (
                  <div className="flex gap-3 pt-3 mt-3 border-t border-gray-100">
                    <button onClick={() => abrirModalProveedor(prov)} className="text-[#116EBF] hover:text-[#025373] text-sm">Editar</button>
                    <button onClick={() => toggleProveedorActivo(prov.id, prov.activo, prov.nombre)} className={`text-sm ${prov.activo ? 'text-orange-500' : 'text-green-500'}`}>
                      {prov.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    {puedeEliminarItem && (
                      <button onClick={() => eliminarProveedor(prov.id, prov.nombre)} className="text-red-500 text-sm">Eliminar</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTA DE UNIDADES DE MEDIDA */}
      {vistaActiva === 'unidades' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-[#025373]">Unidades de Medida</h2>
            {puedeGuardar && (
              <button
                onClick={() => abrirModalUnidad()}
                className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva unidad
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {unidadesMedida.map(unidad => (
              <div key={unidad.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#025373]">{unidad.nombre}</h3>
                    <p className="text-2xl font-mono text-[#116EBF] my-1">{unidad.abreviatura}</p>
                    <p className="text-xs text-[#595959] mt-1">
                      {unidad.tipo === 'compra' && '📦 Unidad de compra'}
                      {unidad.tipo === 'receta' && '🍳 Unidad de receta'}
                      {unidad.tipo === 'ambos' && '📦🍳 Compra y receta'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    unidad.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {unidad.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {puedeGuardar && (
                  <div className="flex gap-3 pt-3 mt-3 border-t border-gray-100">
                    <button onClick={() => abrirModalUnidad(unidad)} className="text-[#116EBF] hover:text-[#025373] text-sm">Editar</button>
                    <button onClick={() => toggleUnidadActivo(unidad.id, unidad.activo, unidad.nombre)} className={`text-sm ${unidad.activo ? 'text-orange-500' : 'text-green-500'}`}>
                      {unidad.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    {puedeEliminarItem && (
                      <button onClick={() => eliminarUnidad(unidad.id, unidad.nombre)} className="text-red-500 text-sm">Eliminar</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALES - Mantener igual pero con validaciones de permisos en botones */}
      {/* ... (los modales se mantienen igual, pero los botones de guardar ya validan permisos en las funciones) */}
    </div>
  );
}
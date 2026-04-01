'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function ConfiguracionPage() {
  const [cargando, setCargando] = useState(true);
  const [vistaActiva, setVistaActiva] = useState('medios-pago');
  const [mediosPago, setMediosPago] = useState([]);
  const [configIva, setConfigIva] = useState([]);
  
  // Estados para impresión
  const [impresoras, setImpresoras] = useState([]);
  const [configImpresion, setConfigImpresion] = useState([]);
  const [configFacturacion, setConfigFacturacion] = useState([]);
  const [configProductos, setConfigProductos] = useState([]);
  const [productos, setProductos] = useState([]);
  
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Permisos
  const { puedeVer, puedeCrear, puedeEditar, puedeEliminar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('configuracion');
  const puedeEditarConfig = puedeEditar('configuracion');
  const puedeEliminarConfig = puedeEliminar('configuracion');
  
  // Modales
  const [modalMedioPago, setModalMedioPago] = useState({ open: false, editing: null, nombre: '', activo: true });
  const [modalIVA, setModalIVA] = useState({ open: false, editing: null, nombre: '', porcentaje: '', activo: true });
  const [modalImpresora, setModalImpresora] = useState({ open: false, editing: null, data: { nombre: '', tipo: 'ambas', activo: true } });
  const [impresorasWindows, setImpresorasWindows] = useState([]);

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
    
    // Medios de pago
    const { data: mediosData } = await supabase
      .from('medios_pago')
      .select('*')
      .order('nombre');
    
    // Configuración IVA
    const { data: ivaData } = await supabase
      .from('config_iva')
      .select('*')
      .order('porcentaje');
    
    // Impresoras registradas
    const { data: impresorasData } = await supabase
      .from('impresoras')
      .select('*')
      .order('nombre');
    
    // Configuración de impresión
    const { data: impresionData } = await supabase
      .from('config_impresion')
      .select(`
        *,
        impresora:impresoras (*)
      `)
      .order('tipo');
    
    // Configuración de facturación
    const { data: facturacionData } = await supabase
      .from('config_facturacion')
      .select('*')
      .order('tipo');
    
    // Productos para configuración de comandas
    const { data: productosData } = await supabase
      .from('productos')
      .select('*, categorias(*)')
      .eq('activo', true)
      .order('nombre');
    
    // Configuración de impresión por producto
    const { data: configProductosData } = await supabase
      .from('config_producto_impresion')
      .select('*');
    
    setMediosPago(mediosData || []);
    setConfigIva(ivaData || []);
    setImpresoras(impresorasData || []);
    setConfigImpresion(impresionData || []);
    setConfigFacturacion(facturacionData || []);
    setProductos(productosData || []);
    setConfigProductos(configProductosData || []);
    setCargando(false);
  }

  // ========== FUNCIONES MEDIOS DE PAGO ==========
  async function guardarMedioPago() {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para modificar medios de pago', 'error');
      return;
    }
    const nombre = modalMedioPago.nombre.trim();
    if (!nombre) {
      mostrarNotificacion('El nombre es requerido', 'error');
      return;
    }
    try {
      if (modalMedioPago.editing) {
        const { error } = await supabase
          .from('medios_pago')
          .update({ nombre, activo: modalMedioPago.activo })
          .eq('id', modalMedioPago.editing.id);
        if (error) throw error;
        mostrarNotificacion('Medio de pago actualizado', 'success');
      } else {
        const { error } = await supabase
          .from('medios_pago')
          .insert({ nombre, activo: modalMedioPago.activo });
        if (error) throw error;
        mostrarNotificacion('Medio de pago creado', 'success');
      }
      setModalMedioPago({ open: false, editing: null, nombre: '', activo: true });
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    }
  }

  async function eliminarMedioPago(id, nombre) {
    if (!puedeEliminarConfig) {
      mostrarNotificacion('No tienes permisos para eliminar medios de pago', 'error');
      return;
    }
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    const { error } = await supabase.from('medios_pago').delete().eq('id', id);
    if (error) {
      mostrarNotificacion('Error al eliminar', 'error');
    } else {
      mostrarNotificacion('Medio de pago eliminado', 'success');
      cargarDatos();
    }
  }

  async function toggleMedioPagoActivo(id, activoActual, nombre) {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para cambiar estado', 'error');
      return;
    }
    const { error } = await supabase
      .from('medios_pago')
      .update({ activo: !activoActual })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error al cambiar estado', 'error');
    } else {
      mostrarNotificacion(`${nombre} ${!activoActual ? 'activado' : 'desactivado'}`, 'success');
      cargarDatos();
    }
  }

  // ========== FUNCIONES CONFIGURACIÓN IVA ==========
  async function guardarIVA() {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para modificar IVA', 'error');
      return;
    }
    const nombre = modalIVA.nombre.trim();
    const porcentaje = parseFloat(modalIVA.porcentaje);
    if (!nombre) {
      mostrarNotificacion('El nombre es requerido', 'error');
      return;
    }
    if (isNaN(porcentaje) || porcentaje < 0) {
      mostrarNotificacion('El porcentaje debe ser un número válido', 'error');
      return;
    }
    try {
      if (modalIVA.editing) {
        const { error } = await supabase
          .from('config_iva')
          .update({ nombre, porcentaje, activo: modalIVA.activo })
          .eq('id', modalIVA.editing.id);
        if (error) throw error;
        mostrarNotificacion('Impuestos actualizados', 'success');
      } else {
        const { error } = await supabase
          .from('config_iva')
          .insert({ nombre, porcentaje, activo: modalIVA.activo });
        if (error) throw error;
        mostrarNotificacion('Impuestos creados', 'success');
      }
      setModalIVA({ open: false, editing: null, nombre: '', porcentaje: '', activo: true });
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    }
  }

  async function eliminarIVA(id, nombre) {
    if (!puedeEliminarConfig) {
      mostrarNotificacion('No tienes permisos para eliminar configuraciones de IVA', 'error');
      return;
    }
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    const { error } = await supabase.from('config_iva').delete().eq('id', id);
    if (error) {
      mostrarNotificacion('Error al eliminar', 'error');
    } else {
      mostrarNotificacion('Impuestos eliminados', 'success');
      cargarDatos();
    }
  }

  async function toggleIVAActivo(id, activoActual, nombre) {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para cambiar estado', 'error');
      return;
    }
    const { error } = await supabase
      .from('config_iva')
      .update({ activo: !activoActual })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error al cambiar estado', 'error');
    } else {
      mostrarNotificacion(`${nombre} ${!activoActual ? 'activado' : 'desactivado'}`, 'success');
      cargarDatos();
    }
  }

  // ========== FUNCIONES IMPRESORAS ==========
  async function guardarImpresora() {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para modificar impresoras', 'error');
      return;
    }
    const data = modalImpresora.data;
    if (!data.nombre.trim()) {
      mostrarNotificacion('El nombre de la impresora es requerido', 'error');
      return;
    }
    try {
      if (modalImpresora.editing) {
        const { error } = await supabase
          .from('impresoras')
          .update({ nombre: data.nombre, tipo: data.tipo, activo: data.activo })
          .eq('id', modalImpresora.editing.id);
        if (error) throw error;
        mostrarNotificacion('Impresora actualizada', 'success');
      } else {
        const { error } = await supabase
          .from('impresoras')
          .insert({ nombre: data.nombre, tipo: data.tipo, activo: data.activo });
        if (error) throw error;
        mostrarNotificacion('Impresora creada', 'success');
      }
      setModalImpresora({ open: false, editing: null, data: { nombre: '', tipo: 'ambas', activo: true } });
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error: ' + error.message, 'error');
    }
  }

  async function eliminarImpresora(id, nombre) {
    if (!puedeEliminarConfig) {
      mostrarNotificacion('No tienes permisos para eliminar impresoras', 'error');
      return;
    }
    if (!confirm(`¿Eliminar la impresora "${nombre}"?`)) return;
    const { error } = await supabase.from('impresoras').delete().eq('id', id);
    if (error) {
      mostrarNotificacion('Error al eliminar', 'error');
    } else {
      mostrarNotificacion('Impresora eliminada', 'success');
      cargarDatos();
    }
  }

  async function toggleImpresoraActivo(id, activoActual, nombre) {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para cambiar estado', 'error');
      return;
    }
    const { error } = await supabase
      .from('impresoras')
      .update({ activo: !activoActual })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error al cambiar estado', 'error');
    } else {
      mostrarNotificacion(`Impresora "${nombre}" ${!activoActual ? 'activada' : 'desactivada'}`, 'success');
      cargarDatos();
    }
  }

  // ========== FUNCIONES ASIGNACIÓN DE IMPRESORAS ==========
  async function crearAsignacionImpresora() {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para crear asignaciones', 'error');
      return;
    }
    
    // Determinar el tipo que falta
    const tieneTicket = configImpresion.some(c => c.tipo === 'ticket');
    const tieneComanda = configImpresion.some(c => c.tipo === 'comanda');
    
    let nuevoTipo = '';
    let nuevoNombre = '';
    
    if (!tieneTicket) {
      nuevoTipo = 'ticket';
      nuevoNombre = 'Ticket de Venta';
    } else if (!tieneComanda) {
      nuevoTipo = 'comanda';
      nuevoNombre = 'Comanda Cocina';
    } else {
      mostrarNotificacion('Ya existen ambas asignaciones (Ticket y Comanda)', 'info');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('config_impresion')
        .insert({
          nombre: nuevoNombre,
          tipo: nuevoTipo,
          activo: true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      mostrarNotificacion(`Asignación "${nuevoNombre}" creada`, 'success');
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error al crear asignación: ' + error.message, 'error');
    }
  }

  async function eliminarAsignacionImpresion(id, nombre) {
    if (!puedeEliminarConfig) {
      mostrarNotificacion('No tienes permisos para eliminar asignaciones', 'error');
      return;
    }
    
    if (!confirm(`¿Eliminar la asignación "${nombre}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('config_impresion')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      mostrarNotificacion(`Asignación "${nombre}" eliminada`, 'success');
      cargarDatos();
    } catch (error) {
      mostrarNotificacion('Error al eliminar asignación: ' + error.message, 'error');
    }
  }

  async function actualizarConfigImpresion(id, campo, valor) {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para modificar configuración', 'error');
      return;
    }
    const { error } = await supabase
      .from('config_impresion')
      .update({ [campo]: valor })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error al actualizar configuración', 'error');
    } else {
      mostrarNotificacion('Configuración actualizada', 'success');
      cargarDatos();
    }
  }

  async function actualizarConfigFacturacion(id, campo, valor) {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para modificar facturación', 'error');
      return;
    }
    const { error } = await supabase
      .from('config_facturacion')
      .update({ [campo]: valor })
      .eq('id', id);
    if (error) {
      mostrarNotificacion('Error al actualizar', 'error');
    } else {
      mostrarNotificacion('Configuración actualizada', 'success');
      cargarDatos();
    }
  }

  async function actualizarImpresionProducto(productoId, imprimir) {
    if (!puedeEditarConfig) {
      mostrarNotificacion('No tienes permisos para modificar configuración', 'error');
      return;
    }
    const existe = configProductos.find(cp => cp.producto_id === productoId);
    if (existe) {
      const { error } = await supabase
        .from('config_producto_impresion')
        .update({ imprimir_comanda: imprimir })
        .eq('producto_id', productoId);
      if (error) {
        mostrarNotificacion('Error al actualizar', 'error');
        return;
      }
    } else {
      const { error } = await supabase
        .from('config_producto_impresion')
        .insert({ producto_id: productoId, imprimir_comanda: imprimir });
      if (error) {
        mostrarNotificacion('Error al actualizar', 'error');
        return;
      }
    }
    mostrarNotificacion('Configuración de producto actualizada', 'success');
    cargarDatos();
  }

  function getConfigProducto(productoId) {
    const config = configProductos.find(cp => cp.producto_id === productoId);
    return config ? config.imprimir_comanda : true;
  }

  function detectarImpresoras() {
    if ('getPrinterList' in window) {
      window.getPrinterList().then(printers => {
        setImpresorasWindows(printers.map(p => p.name));
        if (printers.length === 0) {
          mostrarNotificacion('No se detectaron impresoras', 'info');
        } else {
          mostrarNotificacion(`Se detectaron ${printers.length} impresoras`, 'success');
        }
      }).catch(() => {
        mostrarNotificacion('No se pudo detectar impresoras automáticamente', 'info');
      });
    } else {
      mostrarNotificacion('Para ver impresoras, revisa configuración de Windows', 'info');
    }
  }

  function abrirModalMedioPago(editar = null) {
    if (editar) {
      setModalMedioPago({ open: true, editing: editar, nombre: editar.nombre, activo: editar.activo });
    } else {
      setModalMedioPago({ open: true, editing: null, nombre: '', activo: true });
    }
  }

  function abrirModalIVA(editar = null) {
    if (editar) {
      setModalIVA({ open: true, editing: editar, nombre: editar.nombre, porcentaje: editar.porcentaje, activo: editar.activo });
    } else {
      setModalIVA({ open: true, editing: null, nombre: '', porcentaje: '', activo: true });
    }
  }

  function abrirModalImpresora(editar = null) {
    if (editar) {
      setModalImpresora({
        open: true,
        editing: editar,
        data: { nombre: editar.nombre, tipo: editar.tipo, activo: editar.activo }
      });
    } else {
      setModalImpresora({
        open: true,
        editing: null,
        data: { nombre: '', tipo: 'ambas', activo: true }
      });
    }
    setImpresorasWindows([]);
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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Configuración.</p>
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
        <h1 className="text-3xl font-bold">⚙️ Configuración del Sistema</h1>
        <p className="text-white/80 mt-1">Administra medios de pago, IVA y configuración de impresión</p>
      </div>

      {/* Tabs - 3 pestañas */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setVistaActiva('medios-pago')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'medios-pago'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          💳 Medios de Pago
        </button>
        <button
          onClick={() => setVistaActiva('iva')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'iva'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          📊 Impuestos
        </button>
        <button
          onClick={() => setVistaActiva('impresion')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'impresion'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          🖨️ Impresión y Facturación
        </button>
      </div>

      {/* ========== VISTA DE MEDIOS DE PAGO ========== */}
      {vistaActiva === 'medios-pago' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div><p className="text-[#595959]">{mediosPago.length} medios de pago configurados</p></div>
            {puedeEditarConfig && (
              <button onClick={() => abrirModalMedioPago()} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Nuevo medio de pago
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mediosPago.map(mp => (
              <div key={mp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-[#025373]">{mp.nombre}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${mp.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {mp.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {puedeEditarConfig && (
                  <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                    <button onClick={() => abrirModalMedioPago(mp)} className="text-[#116EBF] hover:text-[#025373] text-sm">Editar</button>
                    <button onClick={() => toggleMedioPagoActivo(mp.id, mp.activo, mp.nombre)} className={`text-sm ${mp.activo ? 'text-orange-500' : 'text-green-500'}`}>
                      {mp.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    {puedeEliminarConfig && <button onClick={() => eliminarMedioPago(mp.id, mp.nombre)} className="text-red-500 text-sm">Eliminar</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== VISTA DE CONFIGURACIÓN IVA ========== */}
      {vistaActiva === 'iva' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div><p className="text-[#595959]">{configIva.length} tipos de IVA configurados</p></div>
            {puedeEditarConfig && (
              <button onClick={() => abrirModalIVA()} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all flex items-center gap-2 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Nuevo tipo de IVA
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configIva.map(iva => (
              <div key={iva.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <div><h3 className="text-lg font-semibold text-[#025373]">{iva.nombre}</h3><p className="text-3xl font-bold text-[#116EBF] mt-2">{iva.porcentaje}%</p></div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${iva.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {iva.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {puedeEditarConfig && (
                  <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                    <button onClick={() => abrirModalIVA(iva)} className="text-[#116EBF] hover:text-[#025373] text-sm">Editar</button>
                    <button onClick={() => toggleIVAActivo(iva.id, iva.activo, iva.nombre)} className={`text-sm ${iva.activo ? 'text-orange-500' : 'text-green-500'}`}>
                      {iva.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    {puedeEliminarConfig && <button onClick={() => eliminarIVA(iva.id, iva.nombre)} className="text-red-500 text-sm">Eliminar</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== VISTA DE IMPRESIÓN Y FACTURACIÓN ========== */}
      {vistaActiva === 'impresion' && (
        <div className="space-y-6">
          {/* Layout de dos columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* COLUMNA IZQUIERDA - Impresoras Registradas */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-[#025373]">🖨️ Impresoras Registradas</h2>
                {puedeEditarConfig && (
                  <button onClick={() => abrirModalImpresora()} className="px-3 py-1.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nueva impresora
                  </button>
                )}
              </div>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {impresoras.length === 0 ? (
                  <p className="text-center text-[#595959] py-8">No hay impresoras registradas</p>
                ) : (
                  impresoras.map(imp => (
                    <div key={imp.id} className="bg-[#F2F2F2] rounded-lg p-4 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🖨️</span>
                            <p className="font-semibold text-[#025373]">{imp.nombre}</p>
                          </div>
                          <p className="text-xs text-[#595959] mt-1">
                            Tipo: {imp.tipo === 'ticket' ? '📄 Ticket de venta' : imp.tipo === 'comanda' ? '🍳 Comanda de cocina' : '📄🍳 Ambas funciones'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${imp.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {imp.activo ? 'Activa' : 'Inactiva'}
                          </span>
                          {puedeEditarConfig && (
                            <div className="flex gap-1">
                              <button onClick={() => abrirModalImpresora(imp)} className="p-1.5 text-[#116EBF] hover:bg-[#116EBF]/10 rounded-lg" title="Editar">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => eliminarImpresora(imp.id, imp.nombre)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {puedeEditarConfig && (
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <button onClick={() => toggleImpresoraActivo(imp.id, imp.activo, imp.nombre)} className={`text-xs flex items-center gap-1 ${imp.activo ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" /></svg>
                            {imp.activo ? 'Desactivar impresora' : 'Activar impresora'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA - Asignación de Impresoras */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-[#025373]">📄 Asignación de Impresoras</h2>
                {puedeEditarConfig && (
                  <button onClick={crearAsignacionImpresora} className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nueva asignación
                  </button>
                )}
              </div>
              <p className="text-sm text-[#595959] mb-4">Configura qué impresora se usa para cada tipo de documento</p>
              
              <div className="space-y-4">
                {configImpresion.length === 0 ? (
                  <p className="text-center text-[#595959] py-8">No hay asignaciones configuradas</p>
                ) : (
                  configImpresion.map(config => (
                    <div key={config.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h3 className="font-semibold text-[#025373] flex items-center gap-2">
                            {config.tipo === 'ticket' ? '🧾 Ticket de Venta' : '🍳 Comanda de Cocina'}
                          </h3>
                          <p className="text-xs text-[#595959] mt-0.5">
                            {config.tipo === 'ticket' ? 'Impresión al finalizar pedido' : 'Impresión para el área de cocina'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {config.activo ? 'Activo' : 'Inactivo'}
                          </span>
                          {puedeEliminarConfig && (
                            <button
                              onClick={() => eliminarAsignacionImpresion(config.id, config.nombre)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Eliminar asignación"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-[#595959] mb-1">Impresora asignada</label>
                          <select
                            value={config.impresora_id || ''}
                            onChange={(e) => actualizarConfigImpresion(config.id, 'impresora_id', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3BD9D9] bg-white"
                            disabled={!puedeEditarConfig}
                          >
                            <option value="">-- Ninguna impresora --</option>
                            {impresoras.filter(i => i.activo).map(imp => (
                              <option key={imp.id} value={imp.id}>
                                {imp.nombre} {imp.tipo === 'ticket' ? '📄' : imp.tipo === 'comanda' ? '🍳' : '📄🍳'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#595959] mb-1">Estado</label>
                          <button
                            onClick={() => actualizarConfigImpresion(config.id, 'activo', !config.activo)}
                            disabled={!puedeEditarConfig}
                            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              config.activo 
                                ? 'bg-red-500 text-white hover:bg-red-600' 
                                : 'bg-green-500 text-white hover:bg-green-600'
                            } ${!puedeEditarConfig ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {config.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                      
                      {config.impresora_id && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="text-sm text-green-700">Impresora asignada correctamente</span>
                            </div>
                            <span className="text-xs font-mono text-green-600">{config.impresora?.nombre}</span>
                          </div>
                        </div>
                      )}
                      
                      {!config.impresora_id && config.activo && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span className="text-sm text-yellow-700">No hay impresora asignada</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Numeración de facturas - Ocupa todo el ancho */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xl font-semibold text-[#025373] mb-4">📄 Numeración de Facturas</h2>
            <p className="text-sm text-[#595959] mb-4">Configura el formato de numeración para tickets y facturas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {configFacturacion.map(config => (
                <div key={config.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-[#025373] flex items-center gap-2">
                      {config.tipo === 'ticket' ? '🧾 Ticket' : '📄 Factura'}
                    </h3>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {config.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#595959] mb-1">Prefijo</label>
                      <input type="text" value={config.prefijo} onChange={(e) => actualizarConfigFacturacion(config.id, 'prefijo', e.target.value)} disabled={!puedeEditarConfig} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#3BD9D9] disabled:bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#595959] mb-1">Número actual</label>
                      <input type="number" value={config.numero_actual} onChange={(e) => actualizarConfigFacturacion(config.id, 'numero_actual', parseInt(e.target.value))} disabled={!puedeEditarConfig} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#595959] mb-1">Número inicial</label>
                      <input type="number" value={config.numero_inicial} onChange={(e) => actualizarConfigFacturacion(config.id, 'numero_inicial', parseInt(e.target.value))} disabled={!puedeEditarConfig} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#595959] mb-1">Número final</label>
                      <input type="number" value={config.numero_final} onChange={(e) => actualizarConfigFacturacion(config.id, 'numero_final', parseInt(e.target.value))} disabled={!puedeEditarConfig} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-[#F2F2F2] rounded-lg text-center text-sm">
                    <span className="font-mono text-[#116EBF]">{config.prefijo}-{String(config.numero_actual).padStart(8, '0')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configuración por producto - Ocupa todo el ancho */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xl font-semibold text-[#025373] mb-4">🍔 Configuración de Comandas por Producto</h2>
            <p className="text-sm text-[#595959] mb-4">Define qué productos deben imprimir comanda en cocina</p>
            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-4 text-[#025373] font-semibold">Producto</th>
                    <th className="text-left py-3 px-4 text-[#025373] font-semibold">Categoría</th>
                    <th className="text-center py-3 px-4 text-[#025373] font-semibold">Imprimir comanda</th>
                    <th className="text-center py-3 px-4 text-[#025373] font-semibold">Acción</th>
                  </tr>
                  </thead>
                <tbody>
                  {productos.map(producto => {
                    const imprimir = getConfigProducto(producto.id);
                    return (
                      <tr key={producto.id} className="border-b border-gray-100 hover:bg-[#F2F2F2] transition-colors">
                        <td className="py-3 px-4 font-medium text-[#025373]">{producto.nombre}  </td>
                        <td className="py-3 px-4 text-[#595959]">{producto.categorias?.nombre || 'Sin categoría'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${imprimir ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {imprimir ? '✅ Imprime' : '❌ No imprime'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {puedeEditarConfig && (
                            <button onClick={() => actualizarImpresionProducto(producto.id, !imprimir)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${imprimir ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                              {imprimir ? 'Desactivar comanda' : 'Activar comanda'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MEDIO DE PAGO */}
      {modalMedioPago.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">{modalMedioPago.editing ? '✏️ Editar medio de pago' : '➕ Nuevo medio de pago'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" placeholder="Nombre *" value={modalMedioPago.nombre} onChange={(e) => setModalMedioPago({...modalMedioPago, nombre: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={modalMedioPago.activo} onChange={(e) => setModalMedioPago({...modalMedioPago, activo: e.target.checked})} className="w-4 h-4 text-[#116EBF]" /><span>Activo</span></label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalMedioPago({ open: false, editing: null, nombre: '', activo: true })} className="px-5 py-2.5 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={guardarMedioPago} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IVA */}
      {modalIVA.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">{modalIVA.editing ? '✏️ Editar tipo de IVA' : '➕ Nuevo tipo de IVA'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" placeholder="Nombre *" value={modalIVA.nombre} onChange={(e) => setModalIVA({...modalIVA, nombre: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
              <div className="relative"><span className="absolute left-3 top-2.5">%</span><input type="number" step="0.01" placeholder="Porcentaje *" value={modalIVA.porcentaje} onChange={(e) => setModalIVA({...modalIVA, porcentaje: e.target.value})} className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg" /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={modalIVA.activo} onChange={(e) => setModalIVA({...modalIVA, activo: e.target.checked})} className="w-4 h-4 text-[#116EBF]" /><span>Activo</span></label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalIVA({ open: false, editing: null, nombre: '', porcentaje: '', activo: true })} className="px-5 py-2.5 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={guardarIVA} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPRESORA */}
      {modalImpresora.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">{modalImpresora.editing ? '✏️ Editar impresora' : '➕ Nueva impresora'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input type="text" placeholder="Nombre de la impresora *" value={modalImpresora.data.nombre} onChange={(e) => setModalImpresora({...modalImpresora, data: {...modalImpresora.data, nombre: e.target.value}})} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg" />
                <button onClick={detectarImpresoras} className="px-3 py-2 bg-[#F2F2F2] border border-gray-200 rounded-lg hover:bg-[#3BD9D9]/20">🔍</button>
              </div>
              {impresorasWindows.length > 0 && (
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs font-medium text-[#025373] mb-2">Impresoras detectadas:</p>
                  <div className="max-h-32 overflow-y-auto">
                    {impresorasWindows.map((imp, idx) => (
                      <button key={idx} onClick={() => setModalImpresora({...modalImpresora, data: {...modalImpresora.data, nombre: imp}})} className="w-full text-left px-2 py-1 text-sm hover:bg-white rounded">{imp}</button>
                    ))}
                  </div>
                </div>
              )}
              <select value={modalImpresora.data.tipo} onChange={(e) => setModalImpresora({...modalImpresora, data: {...modalImpresora.data, tipo: e.target.value}})} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white">
                <option value="ticket">📄 Ticket de venta</option>
                <option value="comanda">🍳 Comanda de cocina</option>
                <option value="ambas">📄🍳 Ambas</option>
              </select>
              <label className="flex items-center gap-2"><input type="checkbox" checked={modalImpresora.data.activo} onChange={(e) => setModalImpresora({...modalImpresora, data: {...modalImpresora.data, activo: e.target.checked}})} className="w-4 h-4 text-[#116EBF]" /><span>Activa</span></label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalImpresora({ open: false, editing: null, data: { nombre: '', tipo: 'ambas', activo: true } })} className="px-5 py-2.5 border border-gray-300 rounded-lg">Cancelar</button>
              <button onClick={guardarImpresora} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg">Guardar</button>
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
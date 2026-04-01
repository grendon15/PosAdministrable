'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import TicketPrinter from '@/components/TicketPrinter';
import ComandaPrinter from '@/components/ComandaPrinter';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function POSPage() {
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [productosFiltrados, setProductosFiltrados] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [configIva, setConfigIva] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);
  const [configImpresion, setConfigImpresion] = useState({ ticket: true, comanda: true });
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Estado de caja
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [cierreActivo, setCierreActivo] = useState(null);
  const [verificandoCaja, setVerificandoCaja] = useState(true);
  
  // Permisos
  const { puedeVer, puedeCrear, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('pos');
  const puedeCrearPedido = puedeCrear('pos');
  
  const [modalCombo, setModalCombo] = useState({ 
    open: false, 
    combo: null, 
    productosSeleccionados: [] 
  });
  const [modalResumen, setModalResumen] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [pedidoCompletado, setPedidoCompletado] = useState(null);
  
  const [configPedido, setConfigPedido] = useState({
    tipo: 'mesa',
    mesa: '',
    iva_id: '',
    medio_pago_id: '',
    descuento_valor: 0,
    descuento_porcentaje: 0,
    observaciones: ''
  });
  
  const [pagoData, setPagoData] = useState({ monto_pagado: 0, cambio: 0 });

  const { imprimirTicket } = TicketPrinter();
  const { imprimirComanda } = ComandaPrinter();

  useEffect(() => {
    if (tienePermiso) {
      verificarCajaAbierta();
    } else {
      setCargando(false);
      setVerificandoCaja(false);
    }
  }, [tienePermiso]);

  useEffect(() => {
    if (cajaAbierta) {
      cargarDatos();
    }
  }, [cajaAbierta]);

  useEffect(() => {
    filtrarProductos();
  }, [productos, combos, categoriaSeleccionada, busqueda]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function verificarCajaAbierta() {
    setVerificandoCaja(true);
    const fecha = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('cierres_caja')
      .select('*')
      .eq('fecha', fecha)
      .eq('cerrado', false)
      .single();
    
    if (data) {
      setCajaAbierta(true);
      setCierreActivo(data);
    } else {
      setCajaAbierta(false);
      setCierreActivo(null);
    }
    setVerificandoCaja(false);
  }

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
    
    const { data: combosData } = await supabase
      .from('combos')
      .select(`
        *,
        combo_productos (
          *,
          productos (*)
        )
      `)
      .eq('activo', true)
      .order('nombre');
    
    const { data: recetasData } = await supabase
      .from('recetas')
      .select('*');
    
    const { data: ivaData } = await supabase
      .from('config_iva')
      .select('*')
      .eq('activo', true);
    
    const { data: mediosData } = await supabase
      .from('medios_pago')
      .select('*')
      .eq('activo', true);
    
    const { data: impresionData } = await supabase
      .from('config_impresion')
      .select('*');
    
    const configTicket = impresionData?.find(c => c.tipo === 'ticket')?.activo ?? true;
    const configComanda = impresionData?.find(c => c.tipo === 'comanda')?.activo ?? true;
    
    setConfigImpresion({ ticket: configTicket, comanda: configComanda });
    
    setCategorias(categoriasData || []);
    setProductos(productosData || []);
    setCombos(combosData || []);
    setRecetas(recetasData || []);
    setConfigIva(ivaData || []);
    setMediosPago(mediosData || []);
    
    if (ivaData && ivaData.length > 0 && !configPedido.iva_id) {
      setConfigPedido(prev => ({ ...prev, iva_id: ivaData[0].id.toString() }));
    }
    
    if (mediosData && mediosData.length > 0 && !configPedido.medio_pago_id) {
      setConfigPedido(prev => ({ ...prev, medio_pago_id: mediosData[0].id.toString() }));
    }
    
    setCargando(false);
  }

  function filtrarProductos() {
    let filtrados = [...productos];
    if (categoriaSeleccionada) {
      filtrados = filtrados.filter(p => p.categoria_id === parseInt(categoriaSeleccionada));
    }
    if (busqueda) {
      filtrados = filtrados.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    }
    setProductosFiltrados(filtrados);
  }

  function abrirSelectorCombo(combo) {
    const productosIniciales = combo.combo_productos.map(cp => ({
      id: cp.producto_id,
      nombre: cp.productos?.nombre || 'Producto',
      precio_adicional: cp.precio_adicional || 0,
      cantidad: cp.cantidad || 1,
      seleccionado: false
    }));
    setModalCombo({ open: true, combo: combo, productosSeleccionados: productosIniciales });
  }

  function calcularPrecioCombo(combo, productosSeleccionados) {
    let precioTotal = combo.precio_base || 0;
    productosSeleccionados.forEach(prod => {
      if (prod.seleccionado) {
        precioTotal += (prod.precio_adicional * prod.cantidad);
      }
    });
    return precioTotal;
  }

  function agregarComboPersonalizado() {
    const productosSeleccionados = modalCombo.productosSeleccionados.filter(p => p.seleccionado);
    if (productosSeleccionados.length === 0) {
      mostrarNotificacion('Selecciona al menos un producto del combo', 'error');
      return;
    }
    const precioTotal = calcularPrecioCombo(modalCombo.combo, modalCombo.productosSeleccionados);
    setCarrito([...carrito, {
      id: `combo-${modalCombo.combo.id}-${Date.now()}`,
      tipo: 'combo',
      nombre: `🎯 ${modalCombo.combo.nombre}`,
      precio_venta: precioTotal,
      cantidad: 1,
      subtotal: precioTotal,
      combo_original: { ...modalCombo.combo, productosSeleccionados: productosSeleccionados }
    }]);
    setModalCombo({ open: false, combo: null, productosSeleccionados: [] });
    mostrarNotificacion(`Combo "${modalCombo.combo.nombre}" agregado al pedido`, 'success');
  }

  function agregarProductoAlCarrito(producto) {
    const itemExistente = carrito.find(i => i.id === producto.id && i.tipo !== 'combo');
    if (itemExistente) {
      setCarrito(carrito.map(i =>
        i.id === producto.id && i.tipo !== 'combo'
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * producto.precio_venta }
          : i
      ));
    } else {
      setCarrito([...carrito, {
        id: producto.id,
        tipo: 'producto',
        nombre: producto.nombre,
        precio_venta: producto.precio_venta,
        cantidad: 1,
        subtotal: producto.precio_venta
      }]);
    }
    mostrarNotificacion(`${producto.nombre} agregado al pedido`, 'success');
  }

  function actualizarCantidad(id, nuevaCantidad, tipo = 'producto') {
    const itemId = tipo === 'combo' ? id : id;
    if (nuevaCantidad <= 0) {
      eliminarDelCarrito(itemId);
      return;
    }
    setCarrito(carrito.map(item =>
      item.id === itemId
        ? { ...item, cantidad: nuevaCantidad, subtotal: nuevaCantidad * item.precio_venta }
        : item
    ));
  }

  function eliminarDelCarrito(id) {
    setCarrito(carrito.filter(item => item.id !== id));
    mostrarNotificacion('Item eliminado del pedido', 'info');
  }

  function limpiarCarrito() {
    if (carrito.length > 0 && confirm('¿Limpiar todo el pedido?')) {
      setCarrito([]);
      mostrarNotificacion('Pedido limpiado', 'info');
    }
  }

  const totalProductos = carrito.reduce((sum, item) => sum + item.subtotal, 0);
  const ivaSeleccionado = configIva.find(i => i.id === parseInt(configPedido.iva_id));
  const porcentajeIva = ivaSeleccionado?.porcentaje || 0;
  const impuesto = totalProductos * (porcentajeIva / (100 + porcentajeIva));
  const subtotalSinIva = totalProductos - impuesto;
  
  const calcularDescuento = () => {
    const descuentoValor = configPedido.descuento_valor || 0;
    const descuentoPorcentaje = configPedido.descuento_porcentaje || 0;
    let descuento = descuentoValor;
    if (descuentoPorcentaje > 0) {
      descuento = totalProductos * (descuentoPorcentaje / 100);
    }
    return Math.min(descuento, totalProductos);
  };
  
  const descuentoAplicado = calcularDescuento();
  const totalNeto = totalProductos - descuentoAplicado;

  function abrirResumen() {
    if (carrito.length === 0) {
      mostrarNotificacion('Agrega productos al pedido', 'error');
      return;
    }
    if (configPedido.tipo === 'mesa' && !configPedido.mesa) {
      mostrarNotificacion('Ingresa el número de mesa', 'error');
      return;
    }
    if (!cajaAbierta) {
      mostrarNotificacion('La caja debe estar abierta para realizar pedidos', 'error');
      verificarCajaAbierta();
      return;
    }
    if (!puedeCrearPedido) {
      mostrarNotificacion('No tienes permisos para crear pedidos', 'error');
      return;
    }
    setModalResumen(true);
  }

  async function verificarInventario() {
    for (const item of carrito) {
      if (item.tipo === 'combo') {
        for (const comboProducto of item.combo_original?.productosSeleccionados || []) {
          const recetasProducto = recetas.filter(r => r.producto_id === comboProducto.id);
          for (const receta of recetasProducto) {
            const { data: itemInventario } = await supabase
              .from('items_inventario')
              .select('stock_actual, nombre')
              .eq('id', receta.item_inventario_id)
              .single();
            const cantidadNecesaria = receta.cantidad_necesaria * comboProducto.cantidad * item.cantidad;
            if (itemInventario && itemInventario.stock_actual < cantidadNecesaria) {
              return { suficiente: false, faltante: itemInventario.nombre, disponible: itemInventario.stock_actual, necesario: cantidadNecesaria };
            }
          }
        }
      } else {
        const recetasProducto = recetas.filter(r => r.producto_id === item.id);
        for (const receta of recetasProducto) {
          const { data: itemInventario } = await supabase
            .from('items_inventario')
            .select('stock_actual, nombre')
            .eq('id', receta.item_inventario_id)
            .single();
          const cantidadNecesaria = receta.cantidad_necesaria * item.cantidad;
          if (itemInventario && itemInventario.stock_actual < cantidadNecesaria) {
            return { suficiente: false, faltante: itemInventario.nombre, disponible: itemInventario.stock_actual, necesario: cantidadNecesaria };
          }
        }
      }
    }
    return { suficiente: true };
  }

  async function actualizarInventario() {
    for (const item of carrito) {
      if (item.tipo === 'combo') {
        for (const comboProducto of item.combo_original?.productosSeleccionados || []) {
          const recetasProducto = recetas.filter(r => r.producto_id === comboProducto.id);
          for (const receta of recetasProducto) {
            const cantidadDescontar = receta.cantidad_necesaria * comboProducto.cantidad * item.cantidad;
            await supabase.rpc('descontar_inventario', { p_item_id: receta.item_inventario_id, p_cantidad: cantidadDescontar });
          }
        }
      } else {
        const recetasProducto = recetas.filter(r => r.producto_id === item.id);
        for (const receta of recetasProducto) {
          const cantidadDescontar = receta.cantidad_necesaria * item.cantidad;
          await supabase.rpc('descontar_inventario', { p_item_id: receta.item_inventario_id, p_cantidad: cantidadDescontar });
        }
      }
    }
  }

  async function getConfigImpresionProducto(productoId) {
    const { data } = await supabase
      .from('config_producto_impresion')
      .select('imprimir_comanda')
      .eq('producto_id', productoId)
      .single();
    return data?.imprimir_comanda !== false;
  }

  async function finalizarPedido() {
    if (!cajaAbierta) {
      mostrarNotificacion('La caja debe estar abierta para realizar pedidos', 'error');
      verificarCajaAbierta();
      return;
    }
    
    if (!configPedido.medio_pago_id) {
      mostrarNotificacion('Selecciona un medio de pago', 'error');
      return;
    }
    if (pagoData.monto_pagado < totalNeto) {
      mostrarNotificacion(`El monto pagado ($${pagoData.monto_pagado.toLocaleString()}) es menor al total ($${totalNeto.toLocaleString()})`, 'error');
      return;
    }
    
    setProcesando(true);
    
    const inventarioCheck = await verificarInventario();
    if (!inventarioCheck.suficiente) {
      mostrarNotificacion(`Stock insuficiente: ${inventarioCheck.faltante}. Disponible: ${inventarioCheck.disponible}, Necesario: ${inventarioCheck.necesario}`, 'error');
      setProcesando(false);
      return;
    }
    
    try {
      const { data: numeroFactura } = await supabase
        .rpc('generar_numero_factura', { p_tipo: 'ticket' });
      
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          mesa: configPedido.tipo === 'mesa' ? configPedido.mesa : null,
          tipo: configPedido.tipo,
          estado: 'pagado',
          total_bruto: totalProductos,
          descuento: descuentoAplicado,
          impuesto: impuesto,
          propina: 0,
          total_neto: totalNeto,
          observaciones: configPedido.observaciones || null,
          medio_pago_id: parseInt(configPedido.medio_pago_id),
          monto_pagado: pagoData.monto_pagado,
          cambio: pagoData.cambio > 0 ? pagoData.cambio : 0,
          numero_factura: numeroFactura,
          tipo_documento: 'ticket',
          cierre_id: cierreActivo?.id,
          pagado_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (pedidoError) throw pedidoError;
      
      for (const item of carrito) {
        if (item.tipo === 'combo') {
          for (const comboProducto of item.combo_original?.productosSeleccionados || []) {
            await supabase
              .from('detalles_pedido')
              .insert({
                pedido_id: pedido.id,
                producto_id: comboProducto.id,
                cantidad: comboProducto.cantidad * item.cantidad,
                precio_unitario: comboProducto.precio_adicional,
                subtotal: comboProducto.precio_adicional * (comboProducto.cantidad * item.cantidad)
              });
          }
        } else {
          await supabase
            .from('detalles_pedido')
            .insert({
              pedido_id: pedido.id,
              producto_id: item.id,
              cantidad: item.cantidad,
              precio_unitario: item.precio_venta,
              subtotal: item.subtotal
            });
        }
      }
      
      await actualizarInventario();
      
      const { data: detallesCompletos } = await supabase
        .from('detalles_pedido')
        .select(`
          *,
          productos (id, nombre, precio_venta)
        `)
        .eq('pedido_id', pedido.id);
      
      if (configImpresion.ticket) {
        imprimirTicket(pedido, detallesCompletos, {
          nombre_restaurante: 'RESTAURANTE',
          direccion: '',
          telefono: '',
          nit: '',
          mensaje_pie: 'Gracias por su compra'
        });
      }
      
      if (configImpresion.comanda) {
        const productosConComanda = [];
        for (const detalle of detallesCompletos) {
          const imprimir = await getConfigImpresionProducto(detalle.producto_id);
          if (imprimir) {
            productosConComanda.push(detalle);
          }
        }
        if (productosConComanda.length > 0) {
          imprimirComanda(pedido, productosConComanda);
        }
      }
      
      setPedidoCompletado({
        ...pedido,
        cambio: pagoData.cambio > 0 ? pagoData.cambio : 0,
        total_neto: totalNeto,
        descuento_aplicado: descuentoAplicado,
        subtotal_sin_iva: subtotalSinIva
      });
      setModalResumen(false);
      setTimeout(() => setModalPago(true), 100);
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al procesar el pedido: ' + error.message, 'error');
    } finally {
      setProcesando(false);
    }
  }

  function resetPedido() {
    setCarrito([]);
    setConfigPedido({
      tipo: 'mesa',
      mesa: '',
      iva_id: configIva[0]?.id.toString() || '',
      medio_pago_id: mediosPago[0]?.id.toString() || '',
      descuento_valor: 0,
      descuento_porcentaje: 0,
      observaciones: ''
    });
    setPagoData({ monto_pagado: 0, cambio: 0 });
    setModalPago(false);
    setPedidoCompletado(null);
    mostrarNotificacion('Pedido completado. ¡Listo para nuevo pedido!', 'success');
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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo POS.</p>
        </div>
      </div>
    );
  }

  if (verificandoCaja || cargando || cargandoPermisos) {
    return <LoadingAnimation />;
  }

  if (!cajaAbierta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-center">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">🔴 Caja Cerrada</h1>
            <p className="text-white/80 text-sm mt-2">No se pueden realizar pedidos</p>
          </div>
          <div className="p-6 text-center">
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <p className="text-gray-600 font-medium mb-2">Para comenzar a tomar pedidos, es necesario abrir la caja primero.</p>
              <p className="text-sm text-gray-400">La caja registra todas las ventas del día y permite controlar los ingresos.</p>
            </div>
            <button
              onClick={() => window.location.href = '/pos/caja'}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all font-semibold shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Abrir Caja
            </button>
            <button
              onClick={verificarCajaAbierta}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ↻ Verificar estado de caja
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F2F2F2]">
      <NotificationToast
        show={notificacion.show}
        message={notificacion.message}
        type={notificacion.type}
        onClose={() => setNotificacion({ show: false, message: '', type: 'success' })}
      />

      <header className="bg-gradient-to-r from-[#025373] to-[#116EBF] text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🍽️ POS - Restaurante</h1>
            <p className="text-white/70 text-sm">Punto de Venta</p>
          </div>
          <div className="text-right">
            <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-500 text-white inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              🟢 Caja Abierta
            </div>
            {cierreActivo && (
              <p className="text-white/70 text-xs mt-1">
                Apertura: ${cierreActivo.apertura?.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto p-4 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Panel izquierdo - Productos */}
          <div className="lg:col-span-2 flex flex-col h-full bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar producto o combo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                />
                <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setCategoriaSeleccionada('')}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                    !categoriaSeleccionada ? 'bg-[#116EBF] text-white' : 'bg-[#F2F2F2] text-[#595959] hover:bg-[#3BD9D9]/20'
                  }`}
                >
                  Todos
                </button>
                {categorias.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoriaSeleccionada(cat.id.toString())}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                      categoriaSeleccionada === cat.id.toString() ? 'bg-[#116EBF] text-white' : 'bg-[#F2F2F2] text-[#595959] hover:bg-[#3BD9D9]/20'
                    }`}
                  >
                    {cat.nombre}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {combos.length > 0 && !categoriaSeleccionada && !busqueda && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#025373] mb-3 flex items-center gap-2">
                    <span className="text-2xl">🎯</span> Combos Especiales
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {combos.map(combo => (
                      <button
                        key={combo.id}
                        onClick={() => abrirSelectorCombo(combo)}
                        className="bg-gradient-to-r from-[#3BD9D9]/10 to-[#116EBF]/10 border-2 border-[#3BD9D9] rounded-xl p-3 hover:shadow-lg hover:scale-105 transition-all group"
                      >
                        <div className="text-3xl mb-2">🎯</div>
                        <h3 className="font-semibold text-[#025373] text-sm group-hover:text-[#116EBF]">{combo.nombre}</h3>
                        <p className="text-[#116EBF] font-bold text-lg mt-1">${combo.precio_base?.toLocaleString()} + adicionales</p>
                        <p className="text-xs text-[#595959] mt-1">{combo.combo_productos?.length || 0} productos disponibles</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <h3 className={`text-lg font-semibold text-[#025373] mb-3 flex items-center gap-2 ${combos.length > 0 && !categoriaSeleccionada && !busqueda ? '' : 'mt-0'}`}>
                <span className="text-2xl">🍔</span> Productos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {productosFiltrados.map(producto => (
                  <button
                    key={producto.id}
                    onClick={() => agregarProductoAlCarrito(producto)}
                    className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-lg hover:border-[#3BD9D9] transition-all group"
                  >
                    <div className="text-3xl mb-2">🍔</div>
                    <h3 className="font-semibold text-[#025373] text-sm group-hover:text-[#116EBF]">{producto.nombre}</h3>
                    <p className="text-[#116EBF] font-bold text-lg mt-1">${producto.precio_venta.toLocaleString()}</p>
                  </button>
                ))}
                {productosFiltrados.length === 0 && (
                  <div className="col-span-full text-center py-12 text-[#595959]">No hay productos disponibles</div>
                )}
              </div>
            </div>
          </div>

          {/* Panel derecho - Pedido Actual */}
          <div className="bg-white rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-[#F2F2F2] to-white">
              <h2 className="text-lg font-bold text-[#025373] flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Pedido Actual
                {carrito.length > 0 && <span className="text-sm text-[#116EBF]">({carrito.reduce((sum, i) => sum + i.cantidad, 0)} items)</span>}
              </h2>
            </div>
            
            <div className="p-4 bg-[#F2F2F2] border-b border-gray-100 space-y-2">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-[#595959]">Tipo de pedido</label>
                  <select
                    value={configPedido.tipo}
                    onChange={(e) => setConfigPedido({ ...configPedido, tipo: e.target.value, mesa: '' })}
                    className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="mesa">🍽️ Mesa</option>
                    <option value="para_llevar">🛍️ Para llevar</option>
                    <option value="domicilio">🏠 Domicilio</option>
                  </select>
                </div>
                {configPedido.tipo === 'mesa' && (
                  <div className="flex-1">
                    <label className="text-xs text-[#595959]">N° Mesa</label>
                    <input
                      type="text"
                      value={configPedido.mesa}
                      onChange={(e) => setConfigPedido({ ...configPedido, mesa: e.target.value })}
                      placeholder="Ej: 5"
                      className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-[#595959]">Observaciones</label>
                <textarea
                  value={configPedido.observaciones}
                  onChange={(e) => setConfigPedido({ ...configPedido, observaciones: e.target.value })}
                  placeholder="Ej: Sin cebolla, extra queso..."
                  rows="1"
                  className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {carrito.length === 0 ? (
                <div className="text-center py-12 text-[#595959]">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p>Carrito vacío</p>
                  <p className="text-sm mt-1">Selecciona productos o combos del menú</p>
                </div>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-[#F2F2F2] rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-[#025373]">{item.nombre}</p>
                      <p className="text-xs text-[#595959]">${item.precio_venta.toLocaleString()} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => actualizarCantidad(item.tipo === 'combo' ? item.id : item.id, item.cantidad - 1, item.tipo)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 text-[#116EBF] hover:bg-[#116EBF] hover:text-white transition-colors"
                      >-</button>
                      <span className="w-8 text-center font-semibold">{item.cantidad}</span>
                      <button
                        onClick={() => actualizarCantidad(item.tipo === 'combo' ? item.id : item.id, item.cantidad + 1, item.tipo)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 text-[#116EBF] hover:bg-[#116EBF] hover:text-white transition-colors"
                      >+</button>
                      <button onClick={() => eliminarDelCarrito(item.id)} className="ml-1 p-1 text-red-500 hover:bg-red-50 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {carrito.length > 0 && (
              <div className="border-t border-gray-100 p-4 space-y-3 bg-white">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Total productos:</span>
                    <span>${totalProductos.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Subtotal (sin IVA):</span>
                    <span>${subtotalSinIva.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#595959]">{ivaSeleccionado?.nombre || 'IVA'} ({porcentajeIva}%):</span>
                    <span>${impuesto.toLocaleString()}</span>
                  </div>
                  {descuentoAplicado > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Descuento:</span>
                      <span>-${descuentoAplicado.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-bold text-[#025373]">TOTAL:</span>
                    <span className="text-xl font-bold text-[#116EBF]">${totalNeto.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button onClick={limpiarCarrito} className="flex-1 py-2.5 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 transition-colors font-medium">Limpiar</button>
                  <button onClick={abrirResumen} className="flex-1 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-all font-medium shadow-md">📋 Terminar Orden</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE SELECCIÓN DE PRODUCTOS DEL COMBO */}
      {modalCombo.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">🎯 {modalCombo.combo?.nombre}</h3>
              <p className="text-white/70 text-sm mt-1">Precio base: <span className="font-bold">${modalCombo.combo?.precio_base?.toLocaleString()}</span></p>
              <p className="text-white/60 text-xs mt-1">Selecciona los productos adicionales que deseas incluir</p>
            </div>
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {modalCombo.productosSeleccionados.map((prod, idx) => (
                <div key={prod.id} className="flex items-center justify-between p-3 border-b border-gray-100">
                  <div className="flex items-center gap-3 flex-1">
                    <input type="checkbox" checked={prod.seleccionado} onChange={(e) => {
                      const nuevos = [...modalCombo.productosSeleccionados];
                      nuevos[idx].seleccionado = e.target.checked;
                      setModalCombo({ ...modalCombo, productosSeleccionados: nuevos });
                    }} className="w-5 h-5 text-[#116EBF] rounded" />
                    <div>
                      <p className="font-medium text-[#025373]">{prod.nombre}</p>
                      <p className="text-sm text-[#595959]">+${prod.precio_adicional.toLocaleString()} c/u</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      const nuevos = [...modalCombo.productosSeleccionados];
                      nuevos[idx].cantidad = Math.max(1, (nuevos[idx].cantidad || 1) - 1);
                      setModalCombo({ ...modalCombo, productosSeleccionados: nuevos });
                    }} className="w-7 h-7 rounded-full bg-gray-100 text-[#116EBF] disabled:opacity-50" disabled={!prod.seleccionado}>-</button>
                    <span className="w-8 text-center font-semibold">{prod.cantidad || 1}</span>
                    <button onClick={() => {
                      const nuevos = [...modalCombo.productosSeleccionados];
                      nuevos[idx].cantidad = (nuevos[idx].cantidad || 1) + 1;
                      setModalCombo({ ...modalCombo, productosSeleccionados: nuevos });
                    }} className="w-7 h-7 rounded-full bg-gray-100 text-[#116EBF] disabled:opacity-50" disabled={!prod.seleccionado}>+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 bg-[#F2F2F2]">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-[#025373]">Total del combo:</span>
                <span className="text-xl font-bold text-[#116EBF]">${calcularPrecioCombo(modalCombo.combo, modalCombo.productosSeleccionados).toLocaleString()}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalCombo({ open: false, combo: null, productosSeleccionados: [] })} className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
                <button onClick={agregarComboPersonalizado} className="flex-1 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373]">Agregar al pedido</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RESUMEN DE ORDEN */}
      {modalResumen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] px-6 py-4 rounded-t-2xl sticky top-0">
              <h3 className="text-xl font-bold text-white">📋 Resumen de la Orden</h3>
              <p className="text-white/70 text-sm mt-1">Revisa los detalles antes de finalizar</p>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs text-[#595959]">Tipo de pedido</p>
                  <p className="font-semibold text-[#025373]">
                    {configPedido.tipo === 'mesa' ? `🍽️ Mesa ${configPedido.mesa}` : configPedido.tipo === 'para_llevar' ? '🛍️ Para llevar' : '🏠 Domicilio'}
                  </p>
                </div>
                <div className="bg-[#F2F2F2] rounded-lg p-3">
                  <p className="text-xs text-[#595959]">Medio de pago</p>
                  <select
                    value={configPedido.medio_pago_id}
                    onChange={(e) => setConfigPedido({ ...configPedido, medio_pago_id: e.target.value })}
                    className="w-full mt-1 px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    {mediosPago.map(mp => (<option key={mp.id} value={mp.id}>{mp.nombre}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[#025373] mb-3">🛒 Productos</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {carrito.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-[#F2F2F2] rounded-lg">
                      <div>
                        <p className="font-medium text-[#025373]">{item.nombre}</p>
                        <p className="text-xs text-[#595959]">${item.precio_venta.toLocaleString()} x {item.cantidad}</p>
                      </div>
                      <p className="font-semibold text-[#116EBF]">${item.subtotal.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#F2F2F2] rounded-lg p-4">
                <h4 className="font-semibold text-[#025373] mb-3">💰 Descuento</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#595959]">Porcentaje (%)</label>
                    <input
                      type="number"
                      value={configPedido.descuento_porcentaje}
                      onChange={(e) => setConfigPedido({ ...configPedido, descuento_porcentaje: parseFloat(e.target.value) || 0, descuento_valor: 0 })}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#595959]">Valor ($)</label>
                    <input
                      type="number"
                      value={configPedido.descuento_valor}
                      onChange={(e) => setConfigPedido({ ...configPedido, descuento_valor: parseFloat(e.target.value) || 0, descuento_porcentaje: 0 })}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
                {descuentoAplicado > 0 && (
                  <p className="text-xs text-green-600 mt-2">Descuento aplicado: ${descuentoAplicado.toLocaleString()}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#595959] mb-1">IVA</label>
                <select
                  value={configPedido.iva_id}
                  onChange={(e) => setConfigPedido({ ...configPedido, iva_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  {configIva.map(iva => (<option key={iva.id} value={iva.id}>{iva.nombre} ({iva.porcentaje}%)</option>))}
                </select>
              </div>

              <div className="bg-[#F2F2F2] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total productos:</span>
                  <span>${totalProductos.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Subtotal (sin IVA):</span>
                  <span>${subtotalSinIva.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{ivaSeleccionado?.nombre} ({porcentajeIva}%):</span>
                  <span>${impuesto.toLocaleString()}</span>
                </div>
                {descuentoAplicado > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Descuento:</span>
                    <span>-${descuentoAplicado.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="font-bold text-[#025373]">TOTAL:</span>
                  <span className="text-xl font-bold text-[#116EBF]">${totalNeto.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-[#F2F2F2] rounded-lg p-4">
                <h4 className="font-semibold text-[#025373] mb-3">💵 Pago</h4>
                <div>
                  <label className="block text-xs font-medium text-[#595959] mb-1">Monto pagado ($)</label>
                  <input
                    type="number"
                    value={pagoData.monto_pagado}
                    onChange={(e) => {
                      const monto = parseFloat(e.target.value) || 0;
                      setPagoData({ monto_pagado: monto, cambio: monto - totalNeto });
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-lg font-semibold"
                  />
                </div>
                {pagoData.cambio > 0 && (
                  <div className="mt-3 p-3 bg-green-100 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-semibold text-green-700">Cambio:</span>
                      <span className="text-xl font-bold text-green-700">${pagoData.cambio.toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {pagoData.monto_pagado > 0 && pagoData.monto_pagado < totalNeto && (
                  <div className="mt-3 p-3 bg-red-100 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-semibold text-red-700">Faltante:</span>
                      <span className="text-xl font-bold text-red-700">${(totalNeto - pagoData.monto_pagado).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {configPedido.observaciones && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-yellow-700 font-medium">Observaciones:</p>
                  <p className="text-sm text-yellow-800">{configPedido.observaciones}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl sticky bottom-0">
              <button onClick={() => setModalResumen(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
              <button
                onClick={finalizarPedido}
                disabled={procesando || pagoData.monto_pagado < totalNeto}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 font-semibold"
              >
                {procesando ? 'Procesando...' : '✅ Confirmar y Cobrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pago exitoso */}
      {modalPago && pedidoCompletado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full text-center">
            <div className="p-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[#025373] mb-2">¡Pedido completado!</h3>
              <p className="text-[#595959] mb-2">
                Ticket: <span className="text-lg font-bold text-[#116EBF]">{pedidoCompletado.numero_factura}</span>
              </p>
              <p className="text-[#595959] mb-2">
                Total: <span className="text-xl font-bold text-[#116EBF]">${pedidoCompletado.total_neto.toLocaleString()}</span>
              </p>
              {pedidoCompletado.cambio > 0 && (
                <p className="text-green-600 font-semibold mb-2">Cambio: ${pedidoCompletado.cambio.toLocaleString()}</p>
              )}
              <div className="bg-[#F2F2F2] rounded-lg p-3 mb-4 text-left text-sm">
                <p>📋 {configPedido.tipo === 'mesa' ? `Mesa ${configPedido.mesa}` : configPedido.tipo === 'para_llevar' ? 'Para llevar' : 'Domicilio'}</p>
                <p className="mt-1">💳 {mediosPago.find(mp => mp.id === parseInt(configPedido.medio_pago_id))?.nombre}</p>
                {configPedido.observaciones && <p className="mt-1">📝 {configPedido.observaciones}</p>}
              </div>
              <button
                onClick={resetPedido}
                className="w-full py-3 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373] transition-colors font-semibold"
              >
                Nuevo pedido
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
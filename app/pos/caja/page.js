'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { generarPDFCierre } from '@/components/ReporteCierre';
import ModalCierreProfesional from '@/components/ModalCierreProfesional';

export default function CajaPOSPage() {
  const [cargando, setCargando] = useState(true);
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  const router = useRouter();
  
  const { puedeVer, puedeEditar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('caja');
  const puedeEditarCaja = puedeEditar('caja');
  
  const [configCaja, setConfigCaja] = useState({ fondo_inicial: 500000 });
  const [ventasPeriodo, setVentasPeriodo] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0,
    subtotal_sin_iva: 0,
    impuesto_total: 0
  });
  const [cierreActual, setCierreActual] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [pedidosPendientes, setPedidosPendientes] = useState([]);
  
  const [fondoApertura, setFondoApertura] = useState('');
  const [efectivoContado, setEfectivoContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  
  const [modalApertura, setModalApertura] = useState({ open: false });
  const [modalMovimiento, setModalMovimiento] = useState({ open: false, tipo: '', concepto: '', monto: '' });
  const [modalCierreProfesional, setModalCierreProfesional] = useState({ open: false });

  // Configuración de la empresa
  const [configEmpresa, setConfigEmpresa] = useState({
    nombre: 'Mi Restaurante',
    nit: '900.000.000-0',
    telefono: '310 000 0000',
    direccion: 'Cra 1 # 0-00'
  });

  useEffect(() => {
    cargarConfigEmpresa();
  }, []);

  useEffect(() => {
    if (tienePermiso) {
      cargarDatos();
      const interval = setInterval(() => {
        if (cajaAbierta) {
          cargarVentasPeriodo();
          cargarMovimientos();
          cargarPedidosPendientes(cierreActual?.id);
        }
      }, 30000);
      return () => clearInterval(interval);
    } else {
      setCargando(false);
    }
  }, [tienePermiso]);

  useEffect(() => {
    if (cierreActual) {
      setCajaAbierta(!cierreActual.cerrado);
      // Guardar en localStorage para que layout.js detecte el cambio
      if (!cierreActual.cerrado) {
        localStorage.setItem('cajaAbierta', 'true');
      } else {
        localStorage.setItem('cajaAbierta', 'false');
      }
      // Disparar evento para actualizar layout
      window.dispatchEvent(new Event('storage'));
    }
  }, [cierreActual]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function cargarConfigEmpresa() {
    const { data } = await supabase
      .from('config_empresa')
      .select('*')
      .maybeSingle();
    
    if (data) {
      setConfigEmpresa({
        nombre: data.nombre || 'Mi Restaurante',
        nit: data.nit || '900.000.000-0',
        telefono: data.telefono || '310 000 0000',
        direccion: data.direccion || 'Cra 1 # 0-00'
      });
    }
  }

  async function cargarDatos() {
    setCargando(true);
    
    const { data: configData } = await supabase
      .from('config_caja')
      .select('*')
      .order('fecha_config', { ascending: false })
      .limit(1)
      .single();
    
    if (configData) {
      setConfigCaja(configData);
      setFondoApertura(configData.fondo_inicial.toString());
    }
    
    await cargarCierreActual();
    await cargarVentasPeriodo();
    
    setCargando(false);
  }

  async function cargarCierreActual() {
    const fecha = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('cierres_caja')
      .select('*')
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      setCierreActual(data[0]);
      if (!data[0].cerrado) {
        await cargarMovimientos(data[0].id);
        await cargarPedidosPendientes(data[0].id);
      }
    } else {
      setCierreActual(null);
      setCajaAbierta(false);
    }
  }

  async function cargarPedidosPendientes(cierreId) {
    if (!cierreId) return;
    
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('cierre_id', cierreId)
      .in('estado', ['pendiente', 'en_preparacion'])
      .order('created_at', { ascending: false });
    
    setPedidosPendientes(data || []);
  }

  async function cargarMovimientos(cierreId = null) {
    const id = cierreId || cierreActual?.id;
    if (!id) return;
    
    const { data } = await supabase
      .from('movimientos_caja')
      .select('*')
      .eq('cierre_id', id)
      .order('created_at', { ascending: false });
    
    setMovimientos(data || []);
  }

  async function cargarVentasPeriodo() {
    if (!cierreActual) {
      setVentasPeriodo({ efectivo: 0, tarjeta: 0, transferencia: 0, total: 0, subtotal_sin_iva: 0, impuesto_total: 0 });
      return;
    }
    
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select(`
        *,
        medio_pago:medios_pago (nombre)
      `)
      .eq('estado', 'pagado')
      .eq('cierre_id', cierreActual.id);
    
    let efectivo = 0;
    let tarjeta = 0;
    let transferencia = 0;
    let total = 0;
    let subtotalSinIva = 0;
    let impuestoTotal = 0;
    
    pedidos?.forEach(pedido => {
      const medio = pedido.medio_pago?.nombre?.toLowerCase() || '';
      const monto = pedido.total_neto || 0;
      const impuesto = pedido.impuesto || 0;
      
      if (medio.includes('efectivo')) {
        efectivo += monto;
      } else if (medio.includes('tarjeta')) {
        tarjeta += monto;
      } else if (medio.includes('transferencia')) {
        transferencia += monto;
      } else {
        efectivo += monto;
      }
      total += monto;
      subtotalSinIva += (monto - impuesto);
      impuestoTotal += impuesto;
    });
    
    setVentasPeriodo({ efectivo, tarjeta, transferencia, total, subtotal_sin_iva: subtotalSinIva, impuesto_total: impuestoTotal });
  }

  async function registrarMovimiento() {
    if (!puedeEditarCaja) {
      mostrarNotificacion('No tienes permisos para registrar movimientos', 'error');
      return;
    }
    
    if (!modalMovimiento.concepto.trim()) {
      mostrarNotificacion('Ingresa un concepto', 'error');
      return;
    }
    if (!modalMovimiento.monto || modalMovimiento.monto <= 0) {
      mostrarNotificacion('Ingresa un monto válido', 'error');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('movimientos_caja')
        .insert({
          cierre_id: cierreActual.id,
          tipo: modalMovimiento.tipo,
          concepto: modalMovimiento.concepto,
          monto: parseFloat(modalMovimiento.monto)
        });
      
      if (error) throw error;
      
      mostrarNotificacion(
        `${modalMovimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado: $${parseFloat(modalMovimiento.monto).toLocaleString()}`,
        'success'
      );
      
      await cargarMovimientos();
      await cargarVentasPeriodo();
      
      setModalMovimiento({ open: false, tipo: '', concepto: '', monto: '' });
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al registrar movimiento: ' + error.message, 'error');
    }
  }

  async function abrirCaja() {
    if (!puedeEditarCaja) {
      mostrarNotificacion('No tienes permisos para abrir caja', 'error');
      return;
    }
    
    // VALIDACIÓN: Verificar si ya hay una caja abierta hoy
    const fecha = new Date().toISOString().split('T')[0];
    const { data: cajaExistente } = await supabase
      .from('cierres_caja')
      .select('id, cerrado')
      .eq('fecha', fecha)
      .eq('cerrado', false)
      .maybeSingle();
    
    if (cajaExistente) {
      mostrarNotificacion('❌ Ya hay una caja abierta para el día de hoy. No se puede abrir otra.', 'error');
      return;
    }
    
    const fondo = parseFloat(fondoApertura);
    
    if (!fondoApertura || fondo <= 0) {
      mostrarNotificacion('Ingresa un fondo inicial válido', 'error');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('cierres_caja')
        .insert({
          fecha: fecha,
          apertura: fondo,
          usuario_nombre: 'Administrador',
          cerrado: false
        })
        .select();
      
      if (error) throw error;
      
      mostrarNotificacion(`✅ Caja abierta con fondo inicial: $${fondo.toLocaleString()}`, 'success');
      setModalApertura({ open: false });
      await cargarDatos();
      
      // Forzar recarga de layout para mostrar botón POS
      localStorage.setItem('cajaAbierta', 'true');
      window.dispatchEvent(new Event('storage'));
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al abrir caja: ' + error.message, 'error');
    }
  }

  async function cerrarCajaProfesional({ efectivoContado: efectivoContadoNum, observaciones: obs }) {
    if (!puedeEditarCaja) {
      mostrarNotificacion('No tienes permisos para cerrar caja', 'error');
      return;
    }
    
    const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    const efectivoEsperadoVal = cierreActual.apertura + ventasPeriodo.efectivo + totalIngresos - totalEgresos;
    const diferencia = efectivoContadoNum - efectivoEsperadoVal;
    
    try {
      await supabase
        .from('cierres_caja')
        .update({
          ventas_efectivo: ventasPeriodo.efectivo,
          ventas_tarjeta: ventasPeriodo.tarjeta,
          ventas_transferencia: ventasPeriodo.transferencia,
          ventas_total: ventasPeriodo.total,
          subtotal_sin_iva: ventasPeriodo.subtotal_sin_iva,
          impuesto_total: ventasPeriodo.impuesto_total,
          efectivo_contado: efectivoContadoNum,
          diferencia: diferencia,
          observaciones: obs,
          cerrado: true,
          cerrado_at: new Date().toISOString()
        })
        .eq('id', cierreActual.id);
      
      const datosCierre = {
        cierre: { ...cierreActual, cerrado_at: new Date().toISOString(), efectivo_contado: efectivoContadoNum, diferencia, observaciones: obs },
        ventasPeriodo,
        movimientos,
        pedidosPendientes,
        empresaData: configEmpresa
      };
      
      await generarPDFCierre(datosCierre);
      
      mostrarNotificacion(
        `✅ Cierre de caja completado\nDiferencia: ${diferencia >= 0 ? '+' : ''}$${diferencia.toLocaleString()}\nSe ha generado el PDF de cierre.`,
        diferencia === 0 ? 'success' : diferencia > 0 ? 'warning' : 'error'
      );
      
      setModalCierreProfesional({ open: false });
      setEfectivoContado('');
      setObservaciones('');
      await cargarDatos();
      
      // Forzar recarga de layout para ocultar botón POS
      localStorage.setItem('cajaAbierta', 'false');
      window.dispatchEvent(new Event('storage'));
      
      setTimeout(() => {
        window.location.href = '/pos';
      }, 2000);
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al realizar cierre: ' + error.message, 'error');
    }
  }

  const efectivoEsperado = () => {
    if (!cierreActual) return 0;
    const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    return cierreActual.apertura + ventasPeriodo.efectivo + totalIngresos - totalEgresos;
  };

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
          <p className="text-[#595959]">No tienes permisos para acceder al módulo de Caja.</p>
        </div>
      </div>
    );
  }

  if (cargando || cargandoPermisos) {
    return <LoadingAnimation />;
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <NotificationToast
        show={notificacion.show}
        message={notificacion.message}
        type={notificacion.type}
        onClose={() => setNotificacion({ show: false, message: '', type: 'success' })}
      />

      <header className="bg-gradient-to-r from-[#025373] to-[#116EBF] text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">💰 Caja - POS</h1>
            <p className="text-white/70 text-sm">Apertura y cierre de caja</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/70">{new Date().toLocaleDateString('es-CO')}</p>
            <p className="text-xs text-white/60">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        <div className={`rounded-xl shadow-sm p-6 mb-6 ${cajaAbierta ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">
                {cajaAbierta ? (
                  <span className="text-green-600">🟢 Caja ABIERTA</span>
                ) : (
                  <span className="text-red-600">🔴 Caja CERRADA</span>
                )}
              </h2>
              {cajaAbierta && cierreActual && (
                <p className="text-sm text-gray-600 mt-1">
                  Apertura: ${cierreActual.apertura?.toLocaleString()} | 
                  Hora: {new Date(cierreActual.created_at).toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#116EBF]">${ventasPeriodo.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Ventas del periodo</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {!cajaAbierta ? (
            <button
              onClick={() => setModalApertura({ open: true })}
              className="py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all font-semibold shadow-md text-lg"
            >
              🔓 Abrir Caja
            </button>
          ) : (
            <>
              <button
                onClick={() => setModalMovimiento({ open: true, tipo: 'ingreso', concepto: '', monto: '' })}
                className="py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold shadow-md"
              >
                + Ingreso
              </button>
              <button
                onClick={() => setModalMovimiento({ open: true, tipo: 'egreso', concepto: '', monto: '' })}
                className="py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold shadow-md"
              >
                - Egreso
              </button>
            </>
          )}
        </div>

        {cajaAbierta && (
          <>
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-[#025373] mb-4">📊 Ventas del período</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#F2F2F2] rounded-lg p-3 text-center">
                  <p className="text-sm text-[#595959]">Efectivo</p>
                  <p className="text-xl font-bold text-[#116EBF]">${ventasPeriodo.efectivo.toLocaleString()}</p>
                </div>
                <div className="bg-[#F2F2F2] rounded-lg p-3 text-center">
                  <p className="text-sm text-[#595959]">Tarjeta</p>
                  <p className="text-xl font-bold text-[#116EBF]">${ventasPeriodo.tarjeta.toLocaleString()}</p>
                </div>
                <div className="bg-[#F2F2F2] rounded-lg p-3 text-center">
                  <p className="text-sm text-[#595959]">Transferencia</p>
                  <p className="text-xl font-bold text-[#116EBF]">${ventasPeriodo.transferencia.toLocaleString()}</p>
                </div>
                <div className="bg-[#116EBF]/5 rounded-lg p-3 text-center">
                  <p className="text-sm text-[#595959]">Subtotal sin IVA</p>
                  <p className="text-lg font-bold text-[#025373]">${ventasPeriodo.subtotal_sin_iva.toLocaleString()}</p>
                </div>
                <div className="bg-[#116EBF]/5 rounded-lg p-3 text-center">
                  <p className="text-sm text-[#595959]">Impuesto total</p>
                  <p className="text-lg font-bold text-[#025373]">${ventasPeriodo.impuesto_total.toLocaleString()}</p>
                </div>
                <div className="bg-[#116EBF]/10 rounded-lg p-3 text-center">
                  <p className="text-sm text-[#595959] font-semibold">TOTAL VENTAS</p>
                  <p className="text-2xl font-bold text-[#116EBF]">${ventasPeriodo.total.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-[#025373] mb-4">💰 Movimientos de Caja</h2>
              
              {movimientos.length === 0 ? (
                <p className="text-center text-[#595959] py-4">No hay movimientos registrados</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {movimientos.map(mov => (
                    <div key={mov.id} className="flex justify-between items-center p-3 bg-[#F2F2F2] rounded-lg">
                      <div>
                        <p className="font-medium text-[#025373]">{mov.concepto}</p>
                        <p className="text-xs text-[#595959]">{new Date(mov.created_at).toLocaleTimeString()}</p>
                      </div>
                      <div className={`text-right font-bold ${mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'}`}>
                        {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pedidosPendientes.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="text-red-500 text-xl">⚠️</div>
                  <div>
                    <h3 className="font-bold text-red-700">Pedidos pendientes de pago</h3>
                    <p className="text-sm text-red-600">
                      Hay {pedidosPendientes.length} pedido(s) sin pagar. No se puede cerrar la caja hasta que estén pagados.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-[#025373] mb-4">🔒 Cierre de Caja</h2>
              
              <button
                onClick={() => setModalCierreProfesional({ open: true })}
                disabled={pedidosPendientes.length > 0}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all font-semibold shadow-md disabled:opacity-50"
              >
                🔒 Cerrar Caja
              </button>
            </div>
          </>
        )}
      </div>

      {/* MODAL APERTURA DE CAJA */}
      {modalApertura.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">🔓 Apertura de Caja</h3>
              <p className="text-white/80 text-sm mt-1">Ingresa el fondo inicial para comenzar la jornada</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Fondo inicial *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#595959]">$</span>
                  <input
                    type="number"
                    value={fondoApertura}
                    onChange={(e) => setFondoApertura(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-[#595959] mt-1">Monto inicial para operaciones del día</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-blue-700 font-medium">📌 Información</p>
                <p className="text-xs text-blue-600 mt-1">
                  Al abrir caja, se registrará el fondo inicial y podrás comenzar a operar.
                  Solo puede haber una caja abierta por día.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalApertura({ open: false })} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
              <button onClick={abrirCaja} className="px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-md">Abrir Caja</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MOVIMIENTO */}
      {modalMovimiento.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className={`px-6 py-4 rounded-t-2xl ${modalMovimiento.tipo === 'ingreso' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
              <h3 className="text-xl font-bold text-white">
                {modalMovimiento.tipo === 'ingreso' ? '💰 Nuevo Ingreso' : '💸 Nuevo Egreso'}
              </h3>
              <p className="text-white/80 text-sm mt-1">Registra un movimiento de caja</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Concepto *</label>
                <input
                  type="text"
                  value={modalMovimiento.concepto}
                  onChange={(e) => setModalMovimiento({ ...modalMovimiento, concepto: e.target.value })}
                  placeholder="Ej: Venta adicional, Compra insumos..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#595959] mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#595959]">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={modalMovimiento.monto}
                    onChange={(e) => setModalMovimiento({ ...modalMovimiento, monto: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-[#F2F2F2] rounded-b-2xl">
              <button onClick={() => setModalMovimiento({ open: false, tipo: '', concepto: '', monto: '' })} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-white">Cancelar</button>
              <button onClick={registrarMovimiento} className="px-5 py-2.5 bg-[#116EBF] text-white rounded-lg hover:bg-[#025373]">Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CIERRE PROFESIONAL */}
      <ModalCierreProfesional
        isOpen={modalCierreProfesional.open}
        onClose={() => setModalCierreProfesional({ open: false })}
        onConfirm={cerrarCajaProfesional}
        data={{
          cierreActual,
          ventasPeriodo,
          movimientos,
          efectivoEsperado,
          efectivoContado,
          observaciones
        }}
      />

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
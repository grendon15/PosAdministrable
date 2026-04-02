'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import NotificationToast from '@/components/NotificationToast';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';

export default function CajaPOSPage() {
  const [cargando, setCargando] = useState(true);
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  const router = useRouter();
  
  // Permisos
  const { puedeVer, puedeEditar, cargando: cargandoPermisos } = usePermissions();
  const tienePermiso = puedeVer('caja');
  const puedeEditarCaja = puedeEditar('caja');
  
  // Datos
  const [configCaja, setConfigCaja] = useState({ fondo_inicial: 500000 });
  const [ventasPeriodo, setVentasPeriodo] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0
  });
  const [cierreActual, setCierreActual] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  
  // Estados para formularios
  const [fondoApertura, setFondoApertura] = useState('');
  const [efectivoContado, setEfectivoContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  
  // Modales
  const [modalApertura, setModalApertura] = useState({ open: false });
  const [modalMovimiento, setModalMovimiento] = useState({ open: false, tipo: '', concepto: '', monto: '' });

  useEffect(() => {
    if (tienePermiso) {
      cargarDatos();
      const interval = setInterval(() => {
        if (cajaAbierta) {
          cargarVentasPeriodo();
          cargarMovimientos();
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
    }
  }, [cierreActual]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
  };

  async function cargarDatos() {
    setCargando(true);
    
    // Cargar configuración de caja
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
      }
    } else {
      setCierreActual(null);
      setCajaAbierta(false);
    }
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
      setVentasPeriodo({ efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 });
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
    
    pedidos?.forEach(pedido => {
      const medio = pedido.medio_pago?.nombre?.toLowerCase() || '';
      const monto = pedido.total_neto || 0;
      
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
    });
    
    setVentasPeriodo({ efectivo, tarjeta, transferencia, total });
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
    console.log('abrirCaja - Inicio');
    
    if (!puedeEditarCaja) {
      mostrarNotificacion('No tienes permisos para abrir caja', 'error');
      return;
    }
    
    const fondo = parseFloat(fondoApertura);
    console.log('Fondo a aperturar:', fondo);
    
    if (!fondoApertura || fondo <= 0) {
      mostrarNotificacion('Ingresa un fondo inicial válido', 'error');
      return;
    }
    
    try {
      const fecha = new Date().toISOString().split('T')[0];
      console.log('Fecha:', fecha);
      
      const { data, error } = await supabase
        .from('cierres_caja')
        .insert({
          fecha: fecha,
          apertura: fondo,
          usuario_nombre: 'Administrador',
          cerrado: false
        })
        .select();
      
      console.log('Respuesta Supabase:', { data, error });
      
      if (error) throw error;
      
      mostrarNotificacion(`✅ Caja abierta con fondo inicial: $${fondo.toLocaleString()}`, 'success');
      setModalApertura({ open: false });
      await cargarDatos();
      
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al abrir caja: ' + error.message, 'error');
    }
  }

  async function cerrarCaja() {
    console.log('cerrarCaja - Inicio');
    
    if (!puedeEditarCaja) {
      mostrarNotificacion('No tienes permisos para cerrar caja', 'error');
      return;
    }
    
    if (!efectivoContado || parseFloat(efectivoContado) < 0) {
      mostrarNotificacion('Ingresa el efectivo contado', 'error');
      return;
    }
    
    const efectivoContadoNum = parseFloat(efectivoContado);
    const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    const efectivoEsperado = cierreActual.apertura + ventasPeriodo.efectivo + totalIngresos - totalEgresos;
    const diferencia = efectivoContadoNum - efectivoEsperado;
    
    console.log('Datos cierre:', { efectivoContadoNum, efectivoEsperado, diferencia });
    
    const confirmar = confirm(
      `📊 Resumen de Cierre\n\n` +
      `Fondo inicial: $${cierreActual.apertura?.toLocaleString()}\n` +
      `Ventas en efectivo: $${ventasPeriodo.efectivo.toLocaleString()}\n` +
      `Ingresos adicionales: $${totalIngresos.toLocaleString()}\n` +
      `Egresos: $${totalEgresos.toLocaleString()}\n` +
      `─────────────────────────\n` +
      `Efectivo esperado: $${efectivoEsperado.toLocaleString()}\n` +
      `Efectivo contado: $${efectivoContadoNum.toLocaleString()}\n` +
      `─────────────────────────\n` +
      `Diferencia: ${diferencia >= 0 ? '+' : ''}$${diferencia.toLocaleString()}\n\n` +
      `¿Confirmar cierre de caja?`
    );
    
    if (!confirmar) return;
    
    try {
      const { error } = await supabase
        .from('cierres_caja')
        .update({
          ventas_efectivo: ventasPeriodo.efectivo,
          ventas_tarjeta: ventasPeriodo.tarjeta,
          ventas_transferencia: ventasPeriodo.transferencia,
          ventas_total: ventasPeriodo.total,
          efectivo_contado: efectivoContadoNum,
          diferencia: diferencia,
          observaciones: observaciones,
          cerrado: true,
          cerrado_at: new Date().toISOString()
        })
        .eq('id', cierreActual.id);
      
      if (error) throw error;
      
      mostrarNotificacion(
        `✅ Cierre de caja completado\nDiferencia: ${diferencia >= 0 ? '+' : ''}$${diferencia.toLocaleString()}`,
        diferencia === 0 ? 'success' : diferencia > 0 ? 'warning' : 'error'
      );
      
      setEfectivoContado('');
      setObservaciones('');
      await cargarDatos();
      
      // Redirigir al POS para que el usuario vea que la caja está cerrada
      setTimeout(() => {
        router.push('/pos');
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

      {/* Header */}
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
        {/* Estado de la caja */}
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

        {/* Botones de acción */}
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

        {/* Caja Abierta - Contenido */}
        {cajaAbierta && (
          <>
            {/* Ventas del periodo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-sm text-[#595959]">Efectivo</p>
                <p className="text-xl font-bold text-[#116EBF]">${ventasPeriodo.efectivo.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-sm text-[#595959]">Tarjeta</p>
                <p className="text-xl font-bold text-[#116EBF]">${ventasPeriodo.tarjeta.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-sm text-[#595959]">Transferencia</p>
                <p className="text-xl font-bold text-[#116EBF]">${ventasPeriodo.transferencia.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center bg-[#116EBF]/5">
                <p className="text-sm text-[#595959]">Total Ventas</p>
                <p className="text-xl font-bold text-[#116EBF]">${ventasPeriodo.total.toLocaleString()}</p>
              </div>
            </div>

            {/* Movimientos de caja */}
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

            {/* Cierre de caja */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-[#025373] mb-4">🔒 Cierre de Caja</h2>
              
              <div className="space-y-4">
                <div className="bg-[#F2F2F2] rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-[#595959]">Fondo inicial:</span>
                    <span className="font-semibold">${cierreActual?.apertura?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[#595959]">Ventas en efectivo:</span>
                    <span className="font-semibold">+${ventasPeriodo.efectivo.toLocaleString()}</span>
                  </div>
                  {movimientos.filter(m => m.tipo === 'ingreso').length > 0 && (
                    <div className="flex justify-between mb-2 text-green-600">
                      <span>Ingresos adicionales:</span>
                      <span>+${movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0).toLocaleString()}</span>
                    </div>
                  )}
                  {movimientos.filter(m => m.tipo === 'egreso').length > 0 && (
                    <div className="flex justify-between mb-2 text-red-500">
                      <span>Egresos:</span>
                      <span>-${movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-300">
                    <span className="font-bold text-[#025373]">Efectivo esperado:</span>
                    <span className="text-xl font-bold text-[#116EBF]">${efectivoEsperado().toLocaleString()}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Efectivo contado *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[#595959]">$</span>
                    <input
                      type="number"
                      value={efectivoContado}
                      onChange={(e) => setEfectivoContado(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#595959] mb-1">Observaciones</label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Notas sobre el cierre..."
                    rows="2"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] resize-none"
                  />
                </div>
                
                {efectivoContado && (
                  <div className={`rounded-lg p-3 ${parseFloat(efectivoContado) === efectivoEsperado() ? 'bg-green-50 border border-green-200' : parseFloat(efectivoContado) > efectivoEsperado() ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[#595959]">Diferencia:</span>
                      <span className={`text-xl font-bold ${parseFloat(efectivoContado) === efectivoEsperado() ? 'text-green-600' : parseFloat(efectivoContado) > efectivoEsperado() ? 'text-yellow-600' : 'text-red-600'}`}>
                        {parseFloat(efectivoContado) >= efectivoEsperado() ? '+' : ''}{(parseFloat(efectivoContado) - efectivoEsperado()).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={cerrarCaja}
                  disabled={!efectivoContado}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all font-semibold shadow-md disabled:opacity-50"
                >
                  🔒 Cerrar Caja
                </button>
              </div>
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
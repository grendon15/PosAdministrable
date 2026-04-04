'use client';
import { useState, useEffect } from 'react';

export default function ModalCierreProfesional({ 
  isOpen, 
  onClose, 
  onConfirm, 
  data 
}) {
  const [animating, setAnimating] = useState(false);
  const [efectivoContadoLocal, setEfectivoContadoLocal] = useState(data?.efectivoContado || '');
  const [observacionesLocal, setObservacionesLocal] = useState(data?.observaciones || '');

  useEffect(() => {
    if (isOpen) {
      setAnimating(true);
      setEfectivoContadoLocal(data?.efectivoContado || '');
      setObservacionesLocal(data?.observaciones || '');
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const {
    cierreActual,
    ventasPeriodo,
    movimientos,
    efectivoEsperado
  } = data;

  const totalIngresos = movimientos?.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0) || 0;
  const totalEgresos = movimientos?.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0) || 0;
  const efectivoEsperadoVal = efectivoEsperado();
  const diferencia = parseFloat(efectivoContadoLocal || 0) - efectivoEsperadoVal;
  const puedeCerrar = efectivoContadoLocal && parseFloat(efectivoContadoLocal) >= 0;

  const handleConfirm = () => {
    if (puedeCerrar) {
      onConfirm({
        efectivoContado: parseFloat(efectivoContadoLocal),
        observaciones: observacionesLocal
      });
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${animating ? 'opacity-100' : 'opacity-0'}`}>
      {/* Fondo oscuro con blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden animate-fadeInUp">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Cierre de Caja</h3>
              <p className="text-white/80 text-sm mt-1">Verifica los datos antes de finalizar la jornada</p>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Resumen de ventas */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-[#025373] mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#116EBF] rounded-full"></span>
              Resumen de Ventas
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
                <p className="text-xs text-green-600">💵 Efectivo</p>
                <p className="text-xl font-bold text-green-700">${ventasPeriodo?.efectivo?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-200">
                <p className="text-xs text-blue-600">💳 Tarjeta</p>
                <p className="text-xl font-bold text-blue-700">${ventasPeriodo?.tarjeta?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-200">
                <p className="text-xs text-purple-600">🔄 Transferencia</p>
                <p className="text-xl font-bold text-purple-700">${ventasPeriodo?.transferencia?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-[#116EBF]/10 rounded-xl p-3 text-center border border-[#116EBF]/30">
                <p className="text-xs text-[#025373]">📊 Total Ventas</p>
                <p className="text-xl font-bold text-[#116EBF]">${ventasPeriodo?.total?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          {/* Detalle de impuestos */}
          <div className="mb-6 bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Subtotal sin IVA:</span>
              <span className="font-semibold">${ventasPeriodo?.subtotal_sin_iva?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Impuesto total:</span>
              <span className="font-semibold">${ventasPeriodo?.impuesto_total?.toLocaleString() || 0}</span>
            </div>
          </div>

          {/* Movimientos de caja */}
          {movimientos && movimientos.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-[#025373] mb-3 flex items-center gap-2">
                <span className="w-1 h-6 bg-[#116EBF] rounded-full"></span>
                Movimientos del día
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {movimientos.map((mov, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">{mov.concepto}</p>
                      <p className="text-xs text-gray-400">{new Date(mov.created_at).toLocaleTimeString()}</p>
                    </div>
                    <span className={`font-bold ${mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-sm font-medium">
                <span>Total ingresos extras:</span>
                <span className="text-green-600">+${totalIngresos.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Total egresos:</span>
                <span className="text-red-600">-${totalEgresos.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Cálculo de efectivo */}
          <div className="mb-6 bg-gradient-to-r from-[#025373] to-[#116EBF] rounded-xl p-5 text-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-white/70">Fondo inicial</p>
                <p className="text-2xl font-bold">${cierreActual?.apertura?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-sm text-white/70">Ventas en efectivo</p>
                <p className="text-2xl font-bold">+${ventasPeriodo?.efectivo?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-sm text-white/70">Ingresos extras</p>
                <p className="text-2xl font-bold text-green-300">+${totalIngresos.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-white/70">Egresos</p>
                <p className="text-2xl font-bold text-red-300">-${totalEgresos.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Efectivo esperado:</span>
                <span className="text-2xl font-bold">${efectivoEsperadoVal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Formulario de cierre */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                💵 Efectivo contado <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={efectivoContadoLocal}
                  onChange={(e) => setEfectivoContadoLocal(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-[#116EBF] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
            </div>

            {efectivoContadoLocal && (
              <div className={`rounded-xl p-4 ${
                diferencia === 0 ? 'bg-green-50 border border-green-200' :
                diferencia > 0 ? 'bg-yellow-50 border border-yellow-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Diferencia:</span>
                  <span className={`text-2xl font-bold ${
                    diferencia === 0 ? 'text-green-600' :
                    diferencia > 0 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {diferencia >= 0 ? '+' : ''}{diferencia.toLocaleString()}
                  </span>
                </div>
                {diferencia !== 0 && (
                  <p className="text-xs mt-2 text-gray-500">
                    {diferencia > 0 ? '💰 Sobreante en caja' : '⚠️ Faltante en caja'}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📝 Observaciones
              </label>
              <textarea
                value={observacionesLocal}
                onChange={(e) => setObservacionesLocal(e.target.value)}
                placeholder="Notas sobre el cierre, novedades, etc..."
                rows="3"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#116EBF] focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer con botones */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!puedeCerrar}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Confirmar Cierre
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
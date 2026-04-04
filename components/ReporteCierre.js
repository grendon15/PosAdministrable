'use client';
import jsPDF from 'jspdf';

export const generarPDFCierre = async (data) => {
  const {
    cierre,
    ventasPeriodo,
    movimientos,
    pedidosPendientes = [],
    empresaData = {}
  } = data;

  const doc = new jsPDF();
  
  const empresa = {
    nombre: empresaData.nombre || "Mi Restaurante",
    nit: empresaData.nit || "900.000.000-0",
    telefono: empresaData.telefono || "310 000 0000",
    direccion: empresaData.direccion || "Cra 1 # 0-00"
  };

  let y = 20;

  // Título
  doc.setFontSize(18);
  doc.text(empresa.nombre, 105, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.text(`NIT: ${empresa.nit}`, 105, y, { align: 'center' });
  y += 6;
  doc.text(`Tel: ${empresa.telefono} | ${empresa.direccion}`, 105, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(14);
  doc.text('REPORTE DE CIERRE DE CAJA', 105, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date(cierre.fecha).toLocaleDateString('es-CO')}`, 20, y);
  y += 6;
  doc.text(`Hora apertura: ${new Date(cierre.created_at).toLocaleTimeString()}`, 20, y);
  y += 6;
  doc.text(`Hora cierre: ${new Date(cierre.cerrado_at).toLocaleTimeString()}`, 20, y);
  y += 6;
  doc.text(`Cajero: ${cierre.usuario_nombre || 'Administrador'}`, 20, y);
  y += 15;

  // Ventas
  doc.setFontSize(12);
  doc.text('VENTAS DEL PERÍODO', 20, y);
  y += 8;
  
  const ventasData = [
    ['Efectivo:', `$${(ventasPeriodo.efectivo || 0).toLocaleString()}`],
    ['Tarjeta:', `$${(ventasPeriodo.tarjeta || 0).toLocaleString()}`],
    ['Transferencia:', `$${(ventasPeriodo.transferencia || 0).toLocaleString()}`],
    ['TOTAL VENTAS:', `$${(ventasPeriodo.total || 0).toLocaleString()}`],
    ['Subtotal sin IVA:', `$${(ventasPeriodo.subtotal_sin_iva || 0).toLocaleString()}`],
    ['Impuesto total:', `$${(ventasPeriodo.impuesto_total || 0).toLocaleString()}`]
  ];
  
  ventasData.forEach(row => {
    doc.text(row[0], 25, y);
    doc.text(row[1], 120, y);
    y += 6;
  });
  y += 5;

  // Movimientos
  if (movimientos && movimientos.length > 0) {
    doc.text('MOVIMIENTOS DE CAJA', 20, y);
    y += 8;
    
    const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const egresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    
    movimientos.forEach(mov => {
      doc.text(`${mov.concepto} (${mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'})`, 25, y);
      doc.text(`${mov.tipo === 'ingreso' ? '+' : '-'}$${mov.monto.toLocaleString()}`, 120, y);
      y += 5;
    });
    
    doc.text(`Total Ingresos extras: +$${ingresos.toLocaleString()}`, 25, y);
    y += 5;
    doc.text(`Total Egresos: -$${egresos.toLocaleString()}`, 25, y);
    y += 10;
  }

  // Cierre
  doc.text('DETALLE DE CIERRE', 20, y);
  y += 8;
  
  const totalIngresos = movimientos?.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0) || 0;
  const totalEgresos = movimientos?.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0) || 0;
  const efectivoEsperado = (cierre.apertura || 0) + (ventasPeriodo.efectivo || 0) + totalIngresos - totalEgresos;
  
  const cierreData = [
    ['Fondo inicial:', `$${(cierre.apertura || 0).toLocaleString()}`],
    ['Ventas en efectivo:', `+$${(ventasPeriodo.efectivo || 0).toLocaleString()}`],
    ['Ingresos adicionales:', `+$${totalIngresos.toLocaleString()}`],
    ['Egresos:', `-$${totalEgresos.toLocaleString()}`],
    ['EFECTIVO ESPERADO:', `$${efectivoEsperado.toLocaleString()}`],
    ['EFECTIVO CONTADO:', `$${(cierre.efectivo_contado || 0).toLocaleString()}`],
    ['DIFERENCIA:', `${(cierre.diferencia || 0) >= 0 ? '+' : ''}$${(cierre.diferencia || 0).toLocaleString()}`]
  ];
  
  cierreData.forEach(row => {
    doc.text(row[0], 25, y);
    doc.text(row[1], 120, y);
    y += 6;
  });
  y += 10;

  // Pedidos pendientes
  if (pedidosPendientes && pedidosPendientes.length > 0) {
    doc.setTextColor(255, 0, 0);
    doc.text('⚠️ PEDIDOS PENDIENTES DE PAGO', 20, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
    
    pedidosPendientes.forEach(p => {
      doc.text(`Ticket ${p.numero_factura || 'N/A'} - Mesa ${p.mesa || '-'} - $${(p.total_neto || 0).toLocaleString()}`, 25, y);
      y += 5;
    });
    y += 5;
  }

  // Observaciones
  if (cierre.observaciones) {
    doc.text('Observaciones:', 20, y);
    y += 6;
    const splitObs = doc.splitTextToSize(cierre.observaciones, 170);
    doc.text(splitObs, 25, y);
  }

  // Guardar
  doc.save(`cierre_caja_${cierre.fecha}.pdf`);
};
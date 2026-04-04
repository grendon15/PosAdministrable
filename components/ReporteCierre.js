'use client';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  // Título
  doc.setFontSize(18);
  doc.text(empresa.nombre, 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`NIT: ${empresa.nit}`, 105, 28, { align: 'center' });
  doc.text(`Tel: ${empresa.telefono} | ${empresa.direccion}`, 105, 34, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('REPORTE DE CIERRE DE CAJA', 105, 45, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date(cierre.fecha).toLocaleDateString('es-CO')}`, 20, 55);
  doc.text(`Hora apertura: ${new Date(cierre.created_at).toLocaleTimeString()}`, 20, 61);
  doc.text(`Hora cierre: ${new Date(cierre.cerrado_at).toLocaleTimeString()}`, 20, 67);
  doc.text(`Cajero: ${cierre.usuario_nombre || 'Administrador'}`, 20, 73);

  // Resumen de ventas
  doc.setFontSize(12);
  doc.text('VENTAS DEL PERÍODO', 20, 85);
  
  doc.autoTable({
    startY: 90,
    head: [['Medio de pago', 'Monto']],
    body: [
      ['Efectivo', `$${ventasPeriodo.efectivo.toLocaleString()}`],
      ['Tarjeta', `$${ventasPeriodo.tarjeta.toLocaleString()}`],
      ['Transferencia', `$${ventasPeriodo.transferencia.toLocaleString()}`],
      ['TOTAL VENTAS', `$${ventasPeriodo.total.toLocaleString()}`]
    ],
    theme: 'striped',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [2, 83, 115] }
  });

  let y = doc.lastAutoTable.finalY + 10;

  // Movimientos de caja
  if (movimientos.length > 0) {
    doc.text('MOVIMIENTOS DE CAJA', 20, y);
    const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const egresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    
    doc.autoTable({
      startY: y + 5,
      head: [['Concepto', 'Tipo', 'Monto']],
      body: movimientos.map(m => [m.concepto, m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso', `$${m.monto.toLocaleString()}`]),
      foot: [['', 'Total Ingresos:', `+$${ingresos.toLocaleString()}`], ['', 'Total Egresos:', `-$${egresos.toLocaleString()}`]],
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [2, 83, 115] }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Detalle de cierre
  doc.setFontSize(12);
  doc.text('DETALLE DE CIERRE', 20, y);
  
  const efectivoEsperado = cierre.apertura + ventasPeriodo.efectivo + 
    movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0) -
    movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);

  doc.autoTable({
    startY: y + 5,
    body: [
      ['Fondo inicial de apertura', `$${cierre.apertura?.toLocaleString()}`],
      ['Ventas en efectivo', `+$${ventasPeriodo.efectivo.toLocaleString()}`],
      ['Ingresos adicionales', `+$${movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0).toLocaleString()}`],
      ['Egresos', `-$${movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0).toLocaleString()}`],
      ['EFECTIVO ESPERADO', `$${efectivoEsperado.toLocaleString()}`],
      ['EFECTIVO CONTADO', `$${cierre.efectivo_contado?.toLocaleString()}`],
      ['DIFERENCIA', `${cierre.diferencia >= 0 ? '+' : ''}$${cierre.diferencia?.toLocaleString()}`]
    ],
    theme: 'plain',
    styles: { fontSize: 10 },
    bodyStyles: { textColor: [0, 0, 0] }
  });

  y = doc.lastAutoTable.finalY + 15;

  // Pedidos pendientes (si los hay)
  if (pedidosPendientes.length > 0) {
    doc.setTextColor(255, 0, 0);
    doc.text('⚠️ PEDIDOS PENDIENTES DE PAGO', 20, y);
    doc.setTextColor(0, 0, 0);
    
    doc.autoTable({
      startY: y + 5,
      head: [['Ticket', 'Mesa', 'Total', 'Estado']],
      body: pedidosPendientes.map(p => [
        p.numero_factura || 'N/A',
        p.mesa || '-',
        `$${p.total_neto?.toLocaleString()}`,
        p.estado
      ]),
      theme: 'striped',
      styles: { fontSize: 9, textColor: [255, 0, 0] }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Observaciones
  if (cierre.observaciones) {
    doc.text('Observaciones:', 20, y);
    doc.setFontSize(9);
    doc.text(cierre.observaciones, 20, y + 5);
  }

  // Pie de página
  doc.setFontSize(8);
  doc.text('Documento generado por POS Administrable', 105, 280, { align: 'center' });
  
  // Abrir PDF
  doc.save(`cierre_caja_${cierre.fecha}.pdf`);
};
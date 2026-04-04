'use client';

// Función directa para imprimir ticket (no como componente)
export const imprimirTicket = (pedido, configuracion = {}) => {
  // Extraer detalles del pedido (pueden venir en pedido.detalles o como segundo parámetro)
  const detalles = pedido.detalles || [];
  
  // Configuración por defecto
  const config = {
    nombre_restaurante: 'Mi Restaurante',
    direccion: 'Cra 1 # 0-00',
    telefono: '310 000 0000',
    nit: '900.000.000-0',
    mensaje_pie: '¡Gracias por su compra!',
    ...configuracion
  };

  // Calcular valores si no vienen en el pedido
  const subtotal = pedido.total_bruto || (pedido.total_neto - (pedido.impuesto || 0));
  const ivaPorcentaje = pedido.impuesto && pedido.total_bruto 
    ? Math.round((pedido.impuesto / pedido.total_bruto) * 100) 
    : 19;

  const contenido = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket de Venta</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 80mm;
          margin: 0 auto;
          padding: 8px;
          background: white;
        }
        .header {
          text-align: center;
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .header h1 {
          font-size: 16px;
          margin: 0 0 4px 0;
        }
        .header p {
          margin: 2px 0;
          font-size: 10px;
        }
        .info-cliente {
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .info-cliente p {
          margin: 2px 0;
          font-size: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
        }
        th, td {
          text-align: left;
          padding: 4px 0;
          font-size: 11px;
        }
        th {
          border-bottom: 1px dotted #000;
        }
        td.cantidad {
          width: 40px;
          text-align: center;
        }
        td.precio, td.total {
          text-align: right;
          width: 70px;
        }
        td.descripcion {
          text-align: left;
        }
        .totales {
          border-top: 1px dashed #000;
          padding-top: 8px;
          margin-top: 8px;
          text-align: right;
        }
        .totales p {
          margin: 3px 0;
          font-size: 11px;
        }
        .totales p strong {
          font-size: 13px;
        }
        .pago {
          border-top: 1px dashed #000;
          padding-top: 8px;
          margin-top: 8px;
          text-align: right;
        }
        .footer {
          text-align: center;
          border-top: 1px dashed #000;
          padding-top: 8px;
          margin-top: 8px;
          font-size: 10px;
        }
        hr {
          border: none;
          border-top: 1px dashed #000;
          margin: 5px 0;
        }
        .gracias {
          text-align: center;
          margin-top: 10px;
          font-size: 12px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${config.nombre_restaurante}</h1>
        <p>${config.direccion}</p>
        <p>Tel: ${config.telefono} | NIT: ${config.nit}</p>
        <hr>
        <p><strong>${pedido.tipo_documento === 'factura' ? 'FACTURA DE VENTA' : 'TICKET DE VENTA'}</strong></p>
        <p>N°: ${pedido.numero_factura || pedido.numero_pedido || '0001'}</p>
        <p>Fecha: ${new Date(pedido.pagado_at || pedido.created_at).toLocaleString('es-CO')}</p>
      </div>

      <div class="info-cliente">
        <p><strong>Tipo:</strong> ${pedido.tipo === 'mesa' ? `Mesa ${pedido.mesa}` : pedido.tipo === 'para_llevar' ? '📦 Para llevar' : '🏠 Domicilio'}</p>
        ${pedido.observaciones ? `<p><strong>Observaciones:</strong> ${pedido.observaciones}</p>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Cant</th>
            <th>Descripción</th>
            <th>Precio</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${detalles.map(detalle => `
            <tr>
              <td class="cantidad">${detalle.cantidad}</td>
              <td class="descripcion">${detalle.productos?.nombre || detalle.producto_nombre || 'Producto'}</td>
              <td class="precio">$${detalle.precio_unitario?.toLocaleString()}</td>
              <td class="total">$${detalle.subtotal?.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totales">
        <p>Subtotal: $${(subtotal).toLocaleString()}</p>
        ${pedido.descuento > 0 ? `<p>Descuento: -$${pedido.descuento.toLocaleString()}</p>` : ''}
        <p>IVA (${ivaPorcentaje}%): $${(pedido.impuesto || 0).toLocaleString()}</p>
        ${pedido.propina > 0 ? `<p>Propina: $${pedido.propina.toLocaleString()}</p>` : ''}
        <p><strong>TOTAL: $${(pedido.total_neto || 0).toLocaleString()}</strong></p>
      </div>

      <div class="pago">
        <p>Pagado con: ${pedido.medio_pago_nombre || pedido.medio_pago?.nombre || 'Efectivo'}</p>
        <p>Monto pagado: $${(pedido.monto_pagado || pedido.total_neto).toLocaleString()}</p>
        ${pedido.cambio > 0 ? `<p>Cambio: $${pedido.cambio.toLocaleString()}</p>` : ''}
      </div>

      <div class="footer">
        <p>${config.mensaje_pie}</p>
        <p>*** Ticket generado por POS ***</p>
      </div>
      <div class="gracias">
        ¡GRACIAS POR SU COMPRA!
      </div>
    </body>
    </html>
  `;

  // Abrir ventana de impresión
  const ventana = window.open('', '_blank');
  if (ventana) {
    ventana.document.write(contenido);
    ventana.document.close();
    
    // Pequeño delay para asegurar que el contenido se cargó
    setTimeout(() => {
      ventana.print();
      // No cerramos automáticamente para que el usuario pueda ver el ticket
      // ventana.close();
    }, 250);
  } else {
    console.error('No se pudo abrir la ventana de impresión');
    alert('Por favor, permite las ventanas emergentes para imprimir el ticket');
  }
};

// También exportamos como default por si se necesita
export default imprimirTicket;
'use client';

export default function TicketPrinter() {
  const imprimirTicket = (pedido, detalles, configuracion) => {
    const contenido = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket de Venta</title>
        <style>
          body {
            font-family: monospace;
            font-size: 12px;
            width: 80mm;
            margin: 0;
            padding: 10px;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .header h1 {
            font-size: 16px;
            margin: 0;
          }
          .header p {
            margin: 2px 0;
          }
          .items {
            width: 100%;
            border-bottom: 1px dashed #000;
            margin-bottom: 10px;
          }
          .items th, .items td {
            text-align: left;
            padding: 4px 0;
          }
          .items th {
            border-bottom: 1px dotted #000;
          }
          .items td.quantity {
            width: 30px;
            text-align: center;
          }
          .items td.price {
            text-align: right;
          }
          .totales {
            text-align: right;
            margin-top: 10px;
          }
          .footer {
            text-align: center;
            border-top: 1px dashed #000;
            padding-top: 10px;
            margin-top: 10px;
            font-size: 10px;
          }
          hr {
            border: none;
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${configuracion.nombre_restaurante || 'RESTAURANTE'}</h1>
          <p>${configuracion.direccion || 'Dirección'}</p>
          <p>Tel: ${configuracion.telefono || 'Teléfono'}</p>
          <p>NIT: ${configuracion.nit || 'NIT'}</p>
          <hr>
          <p><strong>${pedido.tipo_documento === 'factura' ? 'FACTURA' : 'TICKET'}</strong></p>
          <p>N°: ${pedido.numero_factura || pedido.numero_pedido}</p>
          <p>Fecha: ${new Date(pedido.created_at).toLocaleString('es-CO')}</p>
          <p>Mesa: ${pedido.mesa || (pedido.tipo === 'para_llevar' ? 'Para llevar' : 'Domicilio')}</p>
          ${pedido.observaciones ? `<p>Obs: ${pedido.observaciones}</p>` : ''}
        </div>

        <table class="items">
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
                <td class="quantity">${detalle.cantidad}</td>
                <td>${detalle.productos?.nombre || 'Producto'}</td>
                <td class="price">$${detalle.precio_unitario?.toLocaleString()}</td>
                <td class="price">$${detalle.subtotal?.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totales">
          <p>Subtotal: $${pedido.total_bruto?.toLocaleString()}</p>
          ${pedido.descuento > 0 ? `<p>Descuento: -$${pedido.descuento?.toLocaleString()}</p>` : ''}
          <p>IVA (19%): $${pedido.impuesto?.toLocaleString()}</p>
          ${pedido.propina > 0 ? `<p>Propina: $${pedido.propina?.toLocaleString()}</p>` : ''}
          <p><strong>TOTAL: $${pedido.total_neto?.toLocaleString()}</strong></p>
          <hr>
          <p>Pagado: $${pedido.monto_pagado?.toLocaleString()}</p>
          <p>Cambio: $${pedido.cambio?.toLocaleString()}</p>
          <p>Medio de pago: ${pedido.medio_pago?.nombre || 'Efectivo'}</p>
        </div>

        <div class="footer">
          <p>¡Gracias por su compra!</p>
          <p>Vuelva pronto</p>
          <hr>
          <p>${configuracion.mensaje_pie || 'www.restaurante.com'}</p>
        </div>
      </body>
      </html>
    `;

    const ventana = window.open('', '_blank');
    ventana.document.write(contenido);
    ventana.document.close();
    
    // Si hay una impresora específica configurada, podemos intentar usarla
    if (configuracion.impresora_nombre && configuracion.impresora_nombre !== '') {
      // En navegadores modernos, podemos sugerir la impresora
      ventana.print();
    } else {
      ventana.print();
    }
    
    ventana.close();
  };

  return { imprimirTicket };
}
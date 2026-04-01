'use client';

export default function ComandaPrinter() {
  const imprimirComanda = (pedido, detalles) => {
    const contenido = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Comanda - Cocina</title>
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
            color: #d32f2f;
          }
          .pedido-info {
            margin: 10px 0;
            padding: 5px;
            background: #f5f5f5;
          }
          .items {
            width: 100%;
            margin: 10px 0;
          }
          .items .item {
            padding: 5px 0;
            border-bottom: 1px dotted #ccc;
          }
          .item-name {
            font-weight: bold;
            font-size: 14px;
          }
          .item-quantity {
            font-size: 12px;
            color: #666;
          }
          .observaciones {
            margin-top: 10px;
            padding: 5px;
            background: #fff3e0;
            border-left: 3px solid #ff9800;
          }
          .footer {
            text-align: center;
            border-top: 1px dashed #000;
            padding-top: 10px;
            margin-top: 10px;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍳 COMANDA DE COCINA</h1>
          <p>Pedido: ${pedido.numero_pedido || `PED-${pedido.id}`}</p>
          <p>${new Date(pedido.created_at).toLocaleString('es-CO')}</p>
        </div>

        <div class="pedido-info">
          <p><strong>Mesa:</strong> ${pedido.mesa || (pedido.tipo === 'para_llevar' ? 'Para llevar' : 'Domicilio')}</p>
          ${pedido.observaciones ? `<p><strong>Observaciones:</strong> ${pedido.observaciones}</p>` : ''}
        </div>

        <div class="items">
          <h3>📋 PRODUCTOS</h3>
          ${detalles.map(detalle => `
            <div class="item">
              <div class="item-name">${detalle.productos?.nombre || 'Producto'}</div>
              <div class="item-quantity">Cantidad: ${detalle.cantidad}</div>
            </div>
          `).join('')}
        </div>

        ${pedido.observaciones ? `
          <div class="observaciones">
            <strong>📝 Notas especiales:</strong><br>
            ${pedido.observaciones}
          </div>
        ` : ''}

        <div class="footer">
          <p>Hora: ${new Date().toLocaleTimeString()}</p>
          <p>Gracias por su atención</p>
        </div>
      </body>
      </html>
    `;

    const ventana = window.open('', '_blank');
    ventana.document.write(contenido);
    ventana.document.close();
    ventana.print();
    ventana.close();
  };

  return { imprimirComanda };
}
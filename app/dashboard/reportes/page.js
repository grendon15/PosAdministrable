'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingAnimation from '@/components/LoadingAnimation';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import * as XLSX from 'xlsx';

export default function ReportesUnificadosPage() {
  const [cargando, setCargando] = useState(true);
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });
  
  // Datos
  const [productos, setProductos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [itemsInventario, setItemsInventario] = useState([]);
  const [detallesVentas, setDetallesVentas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  // Filtros
  const [filtroFechaInicio, setFiltroFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]
  );
  const [filtroFechaFin, setFiltroFechaFin] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroProducto, setFiltroProducto] = useState('');
  const [vistaActiva, setVistaActiva] = useState('ventas'); // 'ventas', 'rentabilidad', 'ganancias'
  
  // Datos procesados
  const [ventasDiarias, setVentasDiarias] = useState([]);
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ventasPorCategoria, setVentasPorCategoria] = useState([]);
  const [resumenVentas, setResumenVentas] = useState({
    totalVentas: 0,
    totalIngresos: 0,
    totalImpuestos: 0,
    totalPropinas: 0,
    ticketPromedio: 0
  });
  
  // Datos de rentabilidad
  const [rentabilidadProductos, setRentabilidadProductos] = useState([]);
  const [rentabilidadTotal, setRentabilidadTotal] = useState({ ingresos: 0, costos: 0, utilidad: 0, margen: 0 });
  const [tendencias, setTendencias] = useState([]);
  const [proyecciones, setProyecciones] = useState([]);
  
  // Datos de ganancias por mes
  const [gananciasPorMes, setGananciasPorMes] = useState([]);
  const [gananciasPorCategoria, setGananciasPorCategoria] = useState([]);
  const [gananciasTotales, setGananciasTotales] = useState({
    ingresos: 0,
    costos: 0,
    utilidad: 0,
    margen: 0
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (productos.length > 0 && pedidos.length > 0) {
      procesarDatosVentas();
      procesarDatosRentabilidad();
      procesarDatosGanancias();
    }
  }, [productos, recetas, itemsInventario, detallesVentas, pedidos, filtroFechaInicio, filtroFechaFin, filtroCategoria, filtroProducto]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
    setTimeout(() => setNotificacion({ show: false, message: '', type: 'success' }), 3000);
  };

  async function cargarDatos() {
    setCargando(true);
    
    const { data: productosData } = await supabase
      .from('productos')
      .select('*, categorias(*)')
      .eq('activo', true);
    
    const { data: recetasData } = await supabase
      .from('recetas')
      .select('*');
    
    const { data: itemsData } = await supabase
      .from('items_inventario')
      .select('*');
    
    const { data: detallesData } = await supabase
      .from('detalles_pedido')
      .select(`
        *,
        productos (*),
        pedidos (*)
      `);
    
    const { data: pedidosData } = await supabase
      .from('pedidos')
      .select('*')
      .eq('estado', 'pagado');
    
    const { data: categoriasData } = await supabase
      .from('categorias')
      .select('*')
      .eq('activo', true);
    
    setProductos(productosData || []);
    setRecetas(recetasData || []);
    setItemsInventario(itemsData || []);
    setDetallesVentas(detallesData || []);
    setPedidos(pedidosData || []);
    setCategorias(categoriasData || []);
    setCargando(false);
  }

  // Calcular costo de un producto según recetas
  function calcularCostoProducto(productoId) {
    const recetasProducto = recetas.filter(r => r.producto_id === productoId);
    let costoTotal = 0;
    
    recetasProducto.forEach(receta => {
      const item = itemsInventario.find(i => i.id === receta.item_inventario_id);
      if (item) {
        const valorUnitario = item.valor_unitario_receta || item.valor_unidad_inventario || 0;
        costoTotal += valorUnitario * receta.cantidad_necesaria;
      }
    });
    
    return costoTotal;
  }

  // Procesar datos de ventas
  function procesarDatosVentas() {
    const fechaInicio = new Date(filtroFechaInicio);
    const fechaFin = new Date(filtroFechaFin);
    fechaFin.setHours(23, 59, 59);
    
    const pedidosFiltrados = pedidos.filter(pedido => {
      const fechaPedido = new Date(pedido.created_at);
      return fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
    });
    
    const detallesFiltrados = detallesVentas.filter(detalle => 
      pedidosFiltrados.some(p => p.id === detalle.pedido_id)
    );
    
    // Ventas diarias
    const ventasPorDia = {};
    pedidosFiltrados.forEach(pedido => {
      const fecha = new Date(pedido.created_at).toISOString().split('T')[0];
      if (!ventasPorDia[fecha]) {
        ventasPorDia[fecha] = { fecha, ventas: 0, ingresos: 0 };
      }
      ventasPorDia[fecha].ventas += 1;
      ventasPorDia[fecha].ingresos += pedido.total_neto || 0;
    });
    setVentasDiarias(Object.values(ventasPorDia).sort((a, b) => a.fecha.localeCompare(b.fecha)));
    
    // Productos más vendidos
    const ventasProductos = {};
    detallesFiltrados.forEach(detalle => {
      if (!ventasProductos[detalle.producto_id]) {
        ventasProductos[detalle.producto_id] = {
          nombre: detalle.productos?.nombre || 'Producto',
          cantidad: 0,
          ingresos: 0
        };
      }
      ventasProductos[detalle.producto_id].cantidad += detalle.cantidad;
      ventasProductos[detalle.producto_id].ingresos += detalle.subtotal;
    });
    setProductosMasVendidos(Object.values(ventasProductos).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10));
    
    // Ventas por categoría
    const ventasCat = {};
    detallesFiltrados.forEach(detalle => {
      const categoria = detalle.productos?.categorias?.nombre || 'Sin categoría';
      if (!ventasCat[categoria]) {
        ventasCat[categoria] = { nombre: categoria, total: 0 };
      }
      ventasCat[categoria].total += detalle.subtotal;
    });
    setVentasPorCategoria(Object.values(ventasCat).sort((a, b) => b.total - a.total));
    
    // Resumen
    const totalVentas = pedidosFiltrados.length;
    const totalIngresos = pedidosFiltrados.reduce((sum, p) => sum + (p.total_neto || 0), 0);
    const totalImpuestos = pedidosFiltrados.reduce((sum, p) => sum + (p.impuesto || 0), 0);
    const totalPropinas = pedidosFiltrados.reduce((sum, p) => sum + (p.propina || 0), 0);
    const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0;
    
    setResumenVentas({ totalVentas, totalIngresos, totalImpuestos, totalPropinas, ticketPromedio });
  }

  // Procesar datos de rentabilidad
  function procesarDatosRentabilidad() {
    const fechaInicio = new Date(filtroFechaInicio);
    const fechaFin = new Date(filtroFechaFin);
    fechaFin.setHours(23, 59, 59);
    
    const pedidosFiltrados = pedidos.filter(pedido => {
      const fechaPedido = new Date(pedido.created_at);
      return fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
    });
    
    const detallesFiltrados = detallesVentas.filter(detalle => 
      pedidosFiltrados.some(p => p.id === detalle.pedido_id)
    );
    
    let detallesFinal = detallesFiltrados;
    if (filtroProducto) {
      detallesFinal = detallesFinal.filter(d => d.producto_id === parseInt(filtroProducto));
    }
    
    const rentabilidadMap = new Map();
    
    detallesFinal.forEach(detalle => {
      const producto = productos.find(p => p.id === detalle.producto_id);
      if (!producto) return;
      
      const costoUnitario = calcularCostoProducto(producto.id);
      const utilidadUnitario = detalle.precio_unitario - costoUnitario;
      
      if (!rentabilidadMap.has(producto.id)) {
        rentabilidadMap.set(producto.id, {
          id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categorias?.nombre || 'Sin categoría',
          precio_venta: producto.precio_venta,
          costo_unitario: costoUnitario,
          cantidad_vendida: 0,
          ingresos_totales: 0,
          costos_totales: 0,
          utilidad_total: 0
        });
      }
      
      const prod = rentabilidadMap.get(producto.id);
      const cantidad = detalle.cantidad;
      prod.cantidad_vendida += cantidad;
      prod.ingresos_totales += detalle.subtotal;
      prod.costos_totales += costoUnitario * cantidad;
      prod.utilidad_total = prod.ingresos_totales - prod.costos_totales;
    });
    
    const rentabilidadArray = Array.from(rentabilidadMap.values()).sort((a, b) => b.utilidad_total - a.utilidad_total);
    setRentabilidadProductos(rentabilidadArray);
    
    const ingresosTotales = rentabilidadArray.reduce((sum, p) => sum + p.ingresos_totales, 0);
    const costosTotales = rentabilidadArray.reduce((sum, p) => sum + p.costos_totales, 0);
    const utilidadTotal = ingresosTotales - costosTotales;
    const margenTotal = ingresosTotales > 0 ? (utilidadTotal / ingresosTotales) * 100 : 0;
    
    setRentabilidadTotal({ ingresos: ingresosTotales, costos: costosTotales, utilidad: utilidadTotal, margen: margenTotal });
    
    // Tendencias mensuales
    const tendenciasMap = new Map();
    pedidosFiltrados.forEach(pedido => {
      const fecha = new Date(pedido.created_at);
      const nombreMes = fecha.toLocaleString('es-CO', { month: 'short', year: 'numeric' });
      if (!tendenciasMap.has(nombreMes)) {
        tendenciasMap.set(nombreMes, { mes: nombreMes, ventas: 0 });
      }
      tendenciasMap.get(nombreMes).ventas += pedido.total_neto || 0;
    });
    const tendenciasArray = Array.from(tendenciasMap.values());
    setTendencias(tendenciasArray);
    
    // Proyecciones
    if (tendenciasArray.length >= 3) {
      const ultimos3 = tendenciasArray.slice(-3);
      const promedio = ultimos3.reduce((sum, t) => sum + t.ventas, 0) / 3;
      const siguienteMes = new Date();
      siguienteMes.setMonth(siguienteMes.getMonth() + 1);
      const nombreProx = siguienteMes.toLocaleString('es-CO', { month: 'short', year: 'numeric' });
      setProyecciones([...tendenciasArray, { mes: nombreProx, ventas: promedio, proyeccion: true }]);
    } else {
      setProyecciones(tendenciasArray);
    }
  }

  // Procesar datos de ganancias por mes
  function procesarDatosGanancias() {
    const fechaInicio = new Date(filtroFechaInicio);
    const fechaFin = new Date(filtroFechaFin);
    fechaFin.setHours(23, 59, 59);
    
    const pedidosFiltrados = pedidos.filter(pedido => {
      const fechaPedido = new Date(pedido.created_at);
      return fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
    });
    
    // Ganancias por mes
    const gananciasMap = new Map();
    pedidosFiltrados.forEach(pedido => {
      const fecha = new Date(pedido.created_at);
      const mes = fecha.toLocaleString('es-CO', { month: 'long', year: 'numeric' });
      const mesKey = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
      
      if (!gananciasMap.has(mesKey)) {
        gananciasMap.set(mesKey, { mes, ingresos: 0, costos: 0, utilidad: 0 });
      }
      
      const detallePedido = detallesVentas.filter(d => d.pedido_id === pedido.id);
      let costoPedido = 0;
      
      detallePedido.forEach(detalle => {
        const costoUnitario = calcularCostoProducto(detalle.producto_id);
        costoPedido += costoUnitario * detalle.cantidad;
      });
      
      const ganancia = gananciasMap.get(mesKey);
      ganancia.ingresos += pedido.total_neto || 0;
      ganancia.costos += costoPedido;
      ganancia.utilidad = ganancia.ingresos - ganancia.costos;
    });
    
    const gananciasArray = Array.from(gananciasMap.values()).sort((a, b) => {
      return a.mes.localeCompare(b.mes);
    });
    setGananciasPorMes(gananciasArray);
    
    // Ganancias por categoría
    const gananciasCatMap = new Map();
    const detallesFiltrados = detallesVentas.filter(detalle => 
      pedidosFiltrados.some(p => p.id === detalle.pedido_id)
    );
    
    detallesFiltrados.forEach(detalle => {
      const categoria = detalle.productos?.categorias?.nombre || 'Sin categoría';
      const costoUnitario = calcularCostoProducto(detalle.producto_id);
      const utilidad = detalle.subtotal - (costoUnitario * detalle.cantidad);
      
      if (!gananciasCatMap.has(categoria)) {
        gananciasCatMap.set(categoria, { nombre: categoria, ingresos: 0, costos: 0, utilidad: 0 });
      }
      const cat = gananciasCatMap.get(categoria);
      cat.ingresos += detalle.subtotal;
      cat.costos += costoUnitario * detalle.cantidad;
      cat.utilidad = cat.ingresos - cat.costos;
    });
    
    setGananciasPorCategoria(Array.from(gananciasCatMap.values()).sort((a, b) => b.utilidad - a.utilidad));
    
    // Totales
    const totalIngresos = gananciasArray.reduce((sum, g) => sum + g.ingresos, 0);
    const totalCostos = gananciasArray.reduce((sum, g) => sum + g.costos, 0);
    const totalUtilidad = totalIngresos - totalCostos;
    const margenTotal = totalIngresos > 0 ? (totalUtilidad / totalIngresos) * 100 : 0;
    
    setGananciasTotales({ ingresos: totalIngresos, costos: totalCostos, utilidad: totalUtilidad, margen: margenTotal });
  }

  async function exportarExcel() {
    try {
      const wsData = [];
      
      if (vistaActiva === 'ventas') {
        wsData.push(['REPORTE DE VENTAS']);
        wsData.push(['Período:', `${filtroFechaInicio} al ${filtroFechaFin}`]);
        wsData.push([]);
        wsData.push(['Resumen de Ventas']);
        wsData.push(['Total Ventas', resumenVentas.totalVentas]);
        wsData.push(['Total Ingresos', resumenVentas.totalIngresos]);
        wsData.push(['Total Impuestos', resumenVentas.totalImpuestos]);
        wsData.push(['Total Propinas', resumenVentas.totalPropinas]);
        wsData.push(['Ticket Promedio', resumenVentas.ticketPromedio]);
        wsData.push([]);
        wsData.push(['Top 10 Productos Más Vendidos']);
        wsData.push(['Producto', 'Cantidad', 'Ingresos']);
        productosMasVendidos.forEach(p => {
          wsData.push([p.nombre, p.cantidad, p.ingresos]);
        });
      } else if (vistaActiva === 'rentabilidad') {
        wsData.push(['REPORTE DE RENTABILIDAD']);
        wsData.push(['Período:', `${filtroFechaInicio} al ${filtroFechaFin}`]);
        wsData.push([]);
        wsData.push(['Resumen General']);
        wsData.push(['Ingresos Totales', rentabilidadTotal.ingresos]);
        wsData.push(['Costos Totales', rentabilidadTotal.costos]);
        wsData.push(['Utilidad Total', rentabilidadTotal.utilidad]);
        wsData.push(['Margen Promedio', `${rentabilidadTotal.margen.toFixed(1)}%`]);
        wsData.push([]);
        wsData.push(['Rentabilidad por Producto']);
        wsData.push(['Producto', 'Categoría', 'Precio Venta', 'Costo Unitario', 'Cantidad Vendida', 'Ingresos', 'Costos', 'Utilidad']);
        rentabilidadProductos.forEach(p => {
          wsData.push([p.nombre, p.categoria, p.precio_venta, p.costo_unitario, p.cantidad_vendida, p.ingresos_totales, p.costos_totales, p.utilidad_total]);
        });
      } else {
        wsData.push(['REPORTE DE GANANCIAS POR MES']);
        wsData.push(['Período:', `${filtroFechaInicio} al ${filtroFechaFin}`]);
        wsData.push([]);
        wsData.push(['Resumen General']);
        wsData.push(['Ingresos Totales', gananciasTotales.ingresos]);
        wsData.push(['Costos Totales', gananciasTotales.costos]);
        wsData.push(['Utilidad Total', gananciasTotales.utilidad]);
        wsData.push(['Margen Promedio', `${gananciasTotales.margen.toFixed(1)}%`]);
        wsData.push([]);
        wsData.push(['Ganancias por Mes']);
        wsData.push(['Mes', 'Ingresos', 'Costos', 'Utilidad', 'Margen']);
        gananciasPorMes.forEach(g => {
          const margen = g.ingresos > 0 ? (g.utilidad / g.ingresos) * 100 : 0;
          wsData.push([g.mes, g.ingresos, g.costos, g.utilidad, `${margen.toFixed(1)}%`]);
        });
        wsData.push([]);
        wsData.push(['Ganancias por Categoría']);
        wsData.push(['Categoría', 'Ingresos', 'Costos', 'Utilidad', 'Margen']);
        gananciasPorCategoria.forEach(c => {
          const margen = c.ingresos > 0 ? (c.utilidad / c.ingresos) * 100 : 0;
          wsData.push([c.nombre, c.ingresos, c.costos, c.utilidad, `${margen.toFixed(1)}%`]);
        });
      }
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
      XLSX.writeFile(wb, `reporte_${vistaActiva}_${filtroFechaInicio}_${filtroFechaFin}.xlsx`);
      mostrarNotificacion('Reporte exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error:', error);
      mostrarNotificacion('Error al exportar', 'error');
    }
  }

  const COLORS = ['#116EBF', '#3BD9D9', '#025373', '#F2F2F2', '#595959', '#FF8042', '#FFBB28'];

  if (cargando) {
    return <LoadingAnimation />;
  }

  return (
    <div className="space-y-6">
      {/* Notificación */}
      {notificacion.show && (
        <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
          <div className={`rounded-xl shadow-2xl p-4 flex items-center gap-3 min-w-[320px] ${
            notificacion.type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'
          }`}>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">{notificacion.message}</p>
            </div>
            <button onClick={() => setNotificacion({ show: false, message: '', type: 'success' })} className="text-white/70 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#025373] to-[#116EBF] rounded-2xl p-6 text-white">
        <h1 className="text-3xl font-bold">📊 Centro de Reportes</h1>
        <p className="text-white/80 mt-1">Análisis de ventas, rentabilidad y ganancias</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Fecha inicio</label>
            <input
              type="date"
              value={filtroFechaInicio}
              onChange={(e) => setFiltroFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Fecha fin</label>
            <input
              type="date"
              value={filtroFechaFin}
              onChange={(e) => setFiltroFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Categoría</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
            >
              <option value="">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#595959] mb-1">Producto</label>
            <select
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3BD9D9] bg-white"
            >
              <option value="">Todos los productos</option>
              {productos.filter(p => !filtroCategoria || p.categoria_id === parseInt(filtroCategoria)).map(prod => (
                <option key={prod.id} value={prod.id}>{prod.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => {
              setFiltroFechaInicio(new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]);
              setFiltroFechaFin(new Date().toISOString().split('T')[0]);
              setFiltroCategoria('');
              setFiltroProducto('');
            }}
            className="text-sm text-[#116EBF] hover:text-[#025373]"
          >
            Restablecer filtros
          </button>
          <button
            onClick={exportarExcel}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setVistaActiva('ventas')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'ventas'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          📊 Reporte de Ventas
        </button>
        <button
          onClick={() => setVistaActiva('rentabilidad')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'rentabilidad'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          📈 Rentabilidad
        </button>
        <button
          onClick={() => setVistaActiva('ganancias')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            vistaActiva === 'ganancias'
              ? 'bg-[#116EBF] text-white shadow-md'
              : 'text-[#595959] hover:bg-[#F2F2F2]'
          }`}
        >
          💰 Ganancias por Mes
        </button>
      </div>

      {/* VISTA DE VENTAS */}
      {vistaActiva === 'ventas' && (
        <div className="space-y-6">
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#116EBF]">
              <p className="text-sm text-[#595959]">Total ventas</p>
              <p className="text-2xl font-bold text-[#025373]">{resumenVentas.totalVentas}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
              <p className="text-sm text-[#595959]">Total ingresos</p>
              <p className="text-2xl font-bold text-green-600">${resumenVentas.totalIngresos.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#3BD9D9]">
              <p className="text-sm text-[#595959]">Ticket promedio</p>
              <p className="text-2xl font-bold text-[#3BD9D9]">${resumenVentas.ticketPromedio.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-500">
              <p className="text-sm text-[#595959]">Impuestos + Propinas</p>
              <p className="text-2xl font-bold text-orange-500">${(resumenVentas.totalImpuestos + resumenVentas.totalPropinas).toLocaleString()}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">📈 Ventas diarias</h3>
              {ventasDiarias.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={ventasDiarias}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="ventas" stroke="#116EBF" name="N° Ventas" />
                    <Line yAxisId="right" type="monotone" dataKey="ingresos" stroke="#3BD9D9" name="Ingresos ($)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#595959] py-12">No hay datos</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">🏆 Top 10 productos más vendidos</h3>
              {productosMasVendidos.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productosMasVendidos} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="nombre" width={80} />
                    <Tooltip formatter={(value) => `${value} unidades`} />
                    <Bar dataKey="cantidad" fill="#116EBF" name="Cantidad vendida" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#595959] py-12">No hay datos</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">🥘 Ventas por categoría</h3>
              {ventasPorCategoria.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={ventasPorCategoria} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="total">
                      {ventasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#595959] py-12">No hay datos</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">📋 Detalle de productos más vendidos</h3>
              {productosMasVendidos.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {productosMasVendidos.slice(0, 5).map((prod, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-[#F2F2F2] rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#116EBF] text-white flex items-center justify-center font-bold">{idx + 1}</div>
                        <span className="font-medium text-[#025373]">{prod.nombre}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#116EBF]">{prod.cantidad} unid.</p>
                        <p className="text-xs text-[#595959]">${prod.ingresos.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-[#595959] py-12">No hay datos</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE RENTABILIDAD */}
      {vistaActiva === 'rentabilidad' && (
        <div className="space-y-6">
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#116EBF]">
              <p className="text-sm text-[#595959]">Ingresos Totales</p>
              <p className="text-2xl font-bold text-[#025373]">${rentabilidadTotal.ingresos.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-red-500">
              <p className="text-sm text-[#595959]">Costos Totales</p>
              <p className="text-2xl font-bold text-red-500">${rentabilidadTotal.costos.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
              <p className="text-sm text-[#595959]">Utilidad Total</p>
              <p className="text-2xl font-bold text-green-600">${rentabilidadTotal.utilidad.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#3BD9D9]">
              <p className="text-sm text-[#595959]">Margen Promedio</p>
              <p className="text-2xl font-bold text-[#3BD9D9]">{rentabilidadTotal.margen.toFixed(1)}%</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">📈 Tendencias Mensuales</h3>
              {tendencias.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={tendencias}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Area type="monotone" dataKey="ventas" stroke="#116EBF" fill="#3BD9D9" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#595959] py-12">No hay datos suficientes</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">🔮 Proyecciones</h3>
              {proyecciones.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={proyecciones}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="ventas" fill="#116EBF" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#595959] py-12">No hay datos suficientes</p>
              )}
            </div>
          </div>

          {/* Tabla de rentabilidad */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-[#F2F2F2]">
              <h3 className="text-lg font-semibold text-[#025373]">📊 Rentabilidad por Producto</h3>
              <p className="text-sm text-[#595959] mt-1">{rentabilidadProductos.length} productos analizados</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Producto</th>
                    <th className="text-left py-4 px-5 text-[#025373]">Categoría</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Precio Venta</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Costo Unitario</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Cantidad</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Ingresos</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Costos</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Utilidad</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {rentabilidadProductos.map(prod => (
                    <tr key={prod.id} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                      <td className="py-4 px-5 font-medium text-[#025373]">{prod.nombre}</td>
                      <td className="py-4 px-5 text-[#595959]">{prod.categoria}</td>
                      <td className="py-4 px-5 text-right">${prod.precio_venta?.toLocaleString()}</td>
                      <td className="py-4 px-5 text-right text-red-500">${prod.costo_unitario.toFixed(2)}</td>
                      <td className="py-4 px-5 text-right font-semibold">{prod.cantidad_vendida}</td>
                      <td className="py-4 px-5 text-right">${prod.ingresos_totales.toLocaleString()}</td>
                      <td className="py-4 px-5 text-right">${prod.costos_totales.toLocaleString()}</td>
                      <td className={`py-4 px-5 text-right font-bold ${prod.utilidad_total >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ${prod.utilidad_total.toLocaleString()}
                      </td>
                      <td className={`py-4 px-5 text-right font-semibold ${prod.utilidad_total >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {prod.ingresos_totales > 0 ? ((prod.utilidad_total / prod.ingresos_totales) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#F2F2F2] border-t border-gray-200">
                  <tr>
                    <td colSpan="5" className="py-4 px-5 text-right font-bold">TOTALES:</td>
                    <td className="py-4 px-5 text-right font-bold">${rentabilidadTotal.ingresos.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-bold">${rentabilidadTotal.costos.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-bold text-green-600">${rentabilidadTotal.utilidad.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-bold">{rentabilidadTotal.margen.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE GANANCIAS POR MES */}
      {vistaActiva === 'ganancias' && (
        <div className="space-y-6">
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#116EBF]">
              <p className="text-sm text-[#595959]">Ingresos Totales</p>
              <p className="text-2xl font-bold text-[#025373]">${gananciasTotales.ingresos.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-red-500">
              <p className="text-sm text-[#595959]">Costos Totales</p>
              <p className="text-2xl font-bold text-red-500">${gananciasTotales.costos.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
              <p className="text-sm text-[#595959]">Utilidad Total</p>
              <p className="text-2xl font-bold text-green-600">${gananciasTotales.utilidad.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#3BD9D9]">
              <p className="text-sm text-[#595959]">Margen Promedio</p>
              <p className="text-2xl font-bold text-[#3BD9D9]">{gananciasTotales.margen.toFixed(1)}%</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">📊 Ganancias por Mes</h3>
              {gananciasPorMes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={gananciasPorMes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="ingresos" fill="#116EBF" name="Ingresos" />
                    <Bar dataKey="utilidad" fill="#3BD9D9" name="Utilidad" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#595959] py-12">No hay datos</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold text-[#025373] mb-4">🥘 Ganancias por Categoría</h3>
              {gananciasPorCategoria.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={gananciasPorCategoria} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="utilidad">
                      {gananciasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-[#595959] py-12">No hay datos</p>
              )}
            </div>
          </div>

          {/* Tabla de ganancias por mes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-[#F2F2F2]">
              <h3 className="text-lg font-semibold text-[#025373]">📊 Detalle de Ganancias por Mes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Mes</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Ingresos</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Costos</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Utilidad</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {gananciasPorMes.map((g, idx) => {
                    const margen = g.ingresos > 0 ? (g.utilidad / g.ingresos) * 100 : 0;
                    return (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                        <td className="py-4 px-5 font-medium text-[#025373]">{g.mes}</td>
                        <td className="py-4 px-5 text-right">${g.ingresos.toLocaleString()}</td>
                        <td className="py-4 px-5 text-right text-red-500">${g.costos.toLocaleString()}</td>
                        <td className="py-4 px-5 text-right font-bold text-green-600">${g.utilidad.toLocaleString()}</td>
                        <td className="py-4 px-5 text-right font-semibold text-[#3BD9D9]">{margen.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#F2F2F2] border-t border-gray-200">
                  <tr>
                    <td className="py-4 px-5 text-right font-bold">TOTALES:</td>
                    <td className="py-4 px-5 text-right font-bold">${gananciasTotales.ingresos.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-bold">${gananciasTotales.costos.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-bold text-green-600">${gananciasTotales.utilidad.toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-bold">{gananciasTotales.margen.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tabla de ganancias por categoría */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-[#F2F2F2]">
              <h3 className="text-lg font-semibold text-[#025373]">📊 Ganancias por Categoría</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2] border-b border-gray-200">
                  <tr>
                    <th className="text-left py-4 px-5 text-[#025373]">Categoría</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Ingresos</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Costos</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Utilidad</th>
                    <th className="text-right py-4 px-5 text-[#025373]">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {gananciasPorCategoria.map((c, idx) => {
                    const margen = c.ingresos > 0 ? (c.utilidad / c.ingresos) * 100 : 0;
                    return (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-[#F2F2F2]">
                        <td className="py-4 px-5 font-medium text-[#025373]">{c.nombre}</td>
                        <td className="py-4 px-5 text-right">${c.ingresos.toLocaleString()}</td>
                        <td className="py-4 px-5 text-right text-red-500">${c.costos.toLocaleString()}</td>
                        <td className="py-4 px-5 text-right font-bold text-green-600">${c.utilidad.toLocaleString()}</td>
                        <td className="py-4 px-5 text-right font-semibold text-[#3BD9D9]">{margen.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
      `}</style>
    </div>
  );
}
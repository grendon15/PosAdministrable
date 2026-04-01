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
  ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';

export default function VentasPage() {
  const [cargando, setCargando] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [productos, setProductos] = useState([]);
  
  // Filtros
  const [filtroFechaInicio, setFiltroFechaInicio] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [filtroFechaFin, setFiltroFechaFin] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [categorias, setCategorias] = useState([]);
  
  // Datos procesados
  const [ventasFiltradas, setVentasFiltradas] = useState([]);
  const [ventasDiarias, setVentasDiarias] = useState([]);
  const [productosMasVendidos, setProductosMasVendidos] = useState([]);
  const [ventasPorCategoria, setVentasPorCategoria] = useState([]);
  const [resumen, setResumen] = useState({
    totalVentas: 0,
    totalIngresos: 0,
    totalImpuestos: 0,
    totalPropinas: 0,
    ticketPromedio: 0,
    ventasPeriodoAnterior: 0,
    variacionPorcentaje: 0
  });
  
  const [notificacion, setNotificacion] = useState({ show: false, message: '', type: 'success' });

  // Colores para gráficos
  const COLORS = ['#116EBF', '#3BD9D9', '#025373', '#F2F2F2', '#595959', '#FF8042', '#FFBB28'];

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    procesarDatos();
  }, [pedidos, detalles, filtroFechaInicio, filtroFechaFin, filtroCategoria]);

  const mostrarNotificacion = (message, type = 'success') => {
    setNotificacion({ show: true, message, type });
    setTimeout(() => setNotificacion({ show: false, message: '', type: 'success' }), 3000);
  };

  async function cargarDatos() {
    setCargando(true);
    
    // Cargar categorías
    const { data: categoriasData } = await supabase
      .from('categorias')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    
    // Cargar pedidos pagados
    const { data: pedidosData } = await supabase
      .from('pedidos')
      .select('*')
      .eq('estado', 'pagado')
      .order('created_at', { ascending: true });
    
    // Cargar detalles de pedidos
    const { data: detallesData } = await supabase
      .from('detalles_pedido')
      .select(`
        *,
        productos (
          id,
          nombre,
          precio_venta,
          categoria_id,
          categorias (*)
        )
      `);
    
    // Cargar productos
    const { data: productosData } = await supabase
      .from('productos')
      .select('*, categorias(*)')
      .eq('activo', true);
    
    setCategorias(categoriasData || []);
    setPedidos(pedidosData || []);
    setDetalles(detallesData || []);
    setProductos(productosData || []);
    setCargando(false);
  }

  function procesarDatos() {
    // Filtrar pedidos por fecha
    const fechaInicio = new Date(filtroFechaInicio);
    const fechaFin = new Date(filtroFechaFin);
    fechaFin.setHours(23, 59, 59);
    
    const pedidosFiltrados = pedidos.filter(pedido => {
      const fechaPedido = new Date(pedido.created_at);
      return fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
    });
    
    // Filtrar detalles por categoría si es necesario
    let detallesFiltrados = detalles;
    if (filtroCategoria) {
      const detallesEnCategoria = detalles.filter(detalle => 
        detalle.productos?.categoria_id === parseInt(filtroCategoria)
      );
      detallesFiltrados = detallesEnCategoria;
    }
    
    setVentasFiltradas(pedidosFiltrados);
    
    // Calcular resumen
    const totalVentas = pedidosFiltrados.length;
    const totalIngresos = pedidosFiltrados.reduce((sum, p) => sum + (p.total_neto || 0), 0);
    const totalImpuestos = pedidosFiltrados.reduce((sum, p) => sum + (p.impuesto || 0), 0);
    const totalPropinas = pedidosFiltrados.reduce((sum, p) => sum + (p.propina || 0), 0);
    const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0;
    
    // Calcular período anterior para comparación
    const diasPeriodo = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));
    const fechaInicioAnterior = new Date(fechaInicio);
    fechaInicioAnterior.setDate(fechaInicioAnterior.getDate() - diasPeriodo);
    const fechaFinAnterior = new Date(fechaInicio);
    fechaFinAnterior.setDate(fechaFinAnterior.getDate() - 1);
    
    const pedidosAnteriores = pedidos.filter(pedido => {
      const fechaPedido = new Date(pedido.created_at);
      return fechaPedido >= fechaInicioAnterior && fechaPedido <= fechaFinAnterior;
    });
    const ingresosAnteriores = pedidosAnteriores.reduce((sum, p) => sum + (p.total_neto || 0), 0);
    const variacionPorcentaje = ingresosAnteriores > 0 
      ? ((totalIngresos - ingresosAnteriores) / ingresosAnteriores) * 100 
      : totalIngresos > 0 ? 100 : 0;
    
    setResumen({
      totalVentas,
      totalIngresos,
      totalImpuestos,
      totalPropinas,
      ticketPromedio,
      ventasPeriodoAnterior: ingresosAnteriores,
      variacionPorcentaje
    });
    
    // Procesar ventas diarias para gráfico
    const ventasPorDia = {};
    pedidosFiltrados.forEach(pedido => {
      const fecha = new Date(pedido.created_at).toISOString().split('T')[0];
      if (!ventasPorDia[fecha]) {
        ventasPorDia[fecha] = { fecha, ventas: 0, ingresos: 0 };
      }
      ventasPorDia[fecha].ventas += 1;
      ventasPorDia[fecha].ingresos += pedido.total_neto || 0;
    });
    const ventasDiariasArray = Object.values(ventasPorDia).sort((a, b) => a.fecha.localeCompare(b.fecha));
    setVentasDiarias(ventasDiariasArray);
    
    // Procesar productos más vendidos
    const productosVentas = {};
    detallesFiltrados.forEach(detalle => {
      const productoId = detalle.producto_id;
      if (!productosVentas[productoId]) {
        productosVentas[productoId] = {
          id: productoId,
          nombre: detalle.productos?.nombre || 'Producto',
          cantidad: 0,
          ingresos: 0
        };
      }
      productosVentas[productoId].cantidad += detalle.cantidad;
      productosVentas[productoId].ingresos += detalle.subtotal;
    });
    const productosMasVendidosArray = Object.values(productosVentas)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
    setProductosMasVendidos(productosMasVendidosArray);
    
    // Procesar ventas por categoría
    const ventasPorCategoriaObj = {};
    detallesFiltrados.forEach(detalle => {
      const categoria = detalle.productos?.categorias?.nombre || 'Sin categoría';
      const categoriaId = detalle.productos?.categoria_id || 0;
      if (!ventasPorCategoriaObj[categoria]) {
        ventasPorCategoriaObj[categoria] = {
          nombre: categoria,
          id: categoriaId,
          total: 0,
          cantidad: 0
        };
      }
      ventasPorCategoriaObj[categoria].total += detalle.subtotal;
      ventasPorCategoriaObj[categoria].cantidad += detalle.cantidad;
    });
    const ventasPorCategoriaArray = Object.values(ventasPorCategoriaObj).sort((a, b) => b.total - a.total);
    setVentasPorCategoria(ventasPorCategoriaArray);
  }

  function exportarExcel() {
    try {
      // Preparar datos para Excel
      const dataVentas = ventasFiltradas.map(pedido => ({
        'N° Pedido': pedido.numero_pedido,
        'Mesa': pedido.mesa || '-',
        'Tipo': pedido.tipo === 'mesa' ? 'Mesa' : pedido.tipo === 'para_llevar' ? 'Para llevar' : 'Domicilio',
        'Fecha': new Date(pedido.created_at).toLocaleString('es-CO'),
        'Total Bruto': pedido.total_bruto,
        'Descuento': pedido.descuento,
        'Impuesto': pedido.impuesto,
        'Propina': pedido.propina,
        'Total Neto': pedido.total_neto
      }));
      
      // Crear libro de Excel
      const ws = XLSX.utils.json_to_sheet(dataVentas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
      
      // Agregar resumen
      const dataResumen = [
        ['RESUMEN DE VENTAS'],
        ['Período', `${filtroFechaInicio} al ${filtroFechaFin}`],
        ['Total Ventas', resumen.totalVentas],
        ['Total Ingresos', `$${resumen.totalIngresos.toLocaleString()}`],
        ['Ticket Promedio', `$${resumen.ticketPromedio.toLocaleString()}`],
        ['Total Impuestos', `$${resumen.totalImpuestos.toLocaleString()}`],
        ['Total Propinas', `$${resumen.totalPropinas.toLocaleString()}`]
      ];
      const wsResumen = XLSX.utils.aoa_to_sheet(dataResumen);
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
      
      // Descargar archivo
      XLSX.writeFile(wb, `reporte_ventas_${filtroFechaInicio}_al_${filtroFechaFin}.xlsx`);
      mostrarNotificacion('Reporte exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error al exportar:', error);
      mostrarNotificacion('Error al exportar reporte', 'error');
    }
  }

  if (cargando) {
    return <LoadingAnimation />;
  }

  return (
    <div className="space-y-6">
      {/* Notificación profesional */}
      {notificacion.show && (
        <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
          <div className={`rounded-xl shadow-2xl p-4 flex items-center gap-3 min-w-[320px] ${
            notificacion.type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'
          }`}>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              {notificacion.type === 'success' ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
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
        <h1 className="text-3xl font-bold">💰 Reporte de Ventas</h1>
        <p className="text-white/80 mt-1">Analiza el rendimiento de tu negocio con métricas y gráficos detallados</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => {
              setFiltroFechaInicio(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
              setFiltroFechaFin(new Date().toISOString().split('T')[0]);
              setFiltroCategoria('');
            }}
            className="text-sm text-[#116EBF] hover:text-[#025373]"
          >
            Restablecer filtros
          </button>
          <button
            onClick={exportarExcel}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#116EBF]">
          <p className="text-sm text-[#595959]">Total ventas</p>
          <p className="text-2xl font-bold text-[#025373]">{resumen.totalVentas}</p>
          <p className="text-xs text-[#595959] mt-1">pedidos completados</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
          <p className="text-sm text-[#595959]">Total ingresos</p>
          <p className="text-2xl font-bold text-green-600">${resumen.totalIngresos.toLocaleString()}</p>
          <p className={`text-xs mt-1 ${resumen.variacionPorcentaje >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {resumen.variacionPorcentaje >= 0 ? '↑' : '↓'} {Math.abs(resumen.variacionPorcentaje).toFixed(1)}% vs período anterior
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#3BD9D9]">
          <p className="text-sm text-[#595959]">Ticket promedio</p>
          <p className="text-2xl font-bold text-[#3BD9D9]">${resumen.ticketPromedio.toLocaleString()}</p>
          <p className="text-xs text-[#595959] mt-1">por pedido</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-500">
          <p className="text-sm text-[#595959]">Impuestos + Propinas</p>
          <p className="text-2xl font-bold text-orange-500">${(resumen.totalImpuestos + resumen.totalPropinas).toLocaleString()}</p>
          <p className="text-xs text-[#595959] mt-1">impuestos: ${resumen.totalImpuestos.toLocaleString()} | propinas: ${resumen.totalPropinas.toLocaleString()}</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de ventas diarias */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-lg font-semibold text-[#025373] mb-4">📈 Ventas diarias</h3>
          {ventasDiarias.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ventasDiarias}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="ventas" stroke="#116EBF" name="N° Ventas" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="ingresos" stroke="#3BD9D9" name="Ingresos ($)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-[#595959] py-12">No hay datos para mostrar en este período</p>
          )}
        </div>

        {/* Gráfico de productos más vendidos */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-lg font-semibold text-[#025373] mb-4">🏆 Top 10 productos más vendidos</h3>
          {productosMasVendidos.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productosMasVendidos} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(value) => `${value} unidades`} />
                <Legend />
                <Bar dataKey="cantidad" fill="#116EBF" name="Cantidad vendida" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-[#595959] py-12">No hay datos para mostrar en este período</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de ventas por categoría */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-lg font-semibold text-[#025373] mb-4">🥘 Ventas por categoría</h3>
          {ventasPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ventasPorCategoria}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="total"
                >
                  {ventasPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-[#595959] py-12">No hay datos para mostrar en este período</p>
          )}
        </div>

        {/* Tabla de productos más vendidos (detalle) */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-lg font-semibold text-[#025373] mb-4">📋 Detalle de productos más vendidos</h3>
          {productosMasVendidos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F2F2F2]">
                  <tr>
                    <th className="text-left py-2 px-3 text-[#025373]">Producto</th>
                    <th className="text-right py-2 px-3 text-[#025373]">Cantidad</th>
                    <th className="text-right py-2 px-3 text-[#025373]">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {productosMasVendidos.slice(0, 5).map((producto, idx) => (
                    <tr key={producto.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-[#025373]">
                        <span className="font-medium">{idx + 1}.</span> {producto.nombre}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">{producto.cantidad} unid.</td>
                      <td className="py-2 px-3 text-right text-[#116EBF]">${producto.ingresos.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-[#595959] py-12">No hay datos para mostrar</p>
          )}
        </div>
      </div>

      {/* Tabla detallada de ventas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-[#F2F2F2]">
          <h3 className="text-lg font-semibold text-[#025373]">📋 Detalle de ventas</h3>
          <p className="text-sm text-[#595959] mt-1">{ventasFiltradas.length} pedidos en el período seleccionado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F2F2F2] border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-[#025373] font-semibold">N° Pedido</th>
                <th className="text-left py-3 px-4 text-[#025373] font-semibold">Mesa/Tipo</th>
                <th className="text-left py-3 px-4 text-[#025373] font-semibold">Fecha</th>
                <th className="text-right py-3 px-4 text-[#025373] font-semibold">Total Bruto</th>
                <th className="text-right py-3 px-4 text-[#025373] font-semibold">Descuento</th>
                <th className="text-right py-3 px-4 text-[#025373] font-semibold">Impuesto</th>
                <th className="text-right py-3 px-4 text-[#025373] font-semibold">Propina</th>
                <th className="text-right py-3 px-4 text-[#025373] font-semibold">Total Neto</th>
              </tr>
            </thead>
            <tbody>
              {ventasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-[#595959]">
                    No hay ventas en el período seleccionado
                  </td>
                </tr>
              ) : (
                ventasFiltradas.map(pedido => (
                  <tr key={pedido.id} className="border-b border-gray-100 hover:bg-[#F2F2F2] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#025373]">{pedido.numero_pedido || `PED-${pedido.id}`}</td>
                    <td className="py-3 px-4 text-[#595959]">{pedido.mesa || (pedido.tipo === 'para_llevar' ? 'Para llevar' : pedido.tipo === 'domicilio' ? 'Domicilio' : 'Mesa')}</td>
                    <td className="py-3 px-4 text-[#595959]">{new Date(pedido.created_at).toLocaleString('es-CO')}</td>
                    <td className="py-3 px-4 text-right text-[#595959]">${pedido.total_bruto?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-red-500">${pedido.descuento?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-[#595959]">${pedido.impuesto?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-[#595959]">${pedido.propina?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-semibold text-[#116EBF]">${pedido.total_neto?.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-[#F2F2F2] border-t border-gray-200">
              <tr>
                <td colSpan="3" className="py-3 px-4 text-right font-bold text-[#025373]">Totales:</td>
                <td className="py-3 px-4 text-right font-bold">${ventasFiltradas.reduce((s, p) => s + (p.total_bruto || 0), 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-red-500">${ventasFiltradas.reduce((s, p) => s + (p.descuento || 0), 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold">${ventasFiltradas.reduce((s, p) => s + (p.impuesto || 0), 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold">${ventasFiltradas.reduce((s, p) => s + (p.propina || 0), 0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-[#116EBF]">${resumen.totalIngresos.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
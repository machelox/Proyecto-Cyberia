/**
 * Módulo: Dashboard y Reportes
 * Depende de: Constants.gs, Utils.gs
 */

function obtenerDatosDashboard(filtros) {
  const { headers, data: historialCompleto } = obtenerDatosHoja(SHEETS.RESUMENES_CIERRE);
  if (!historialCompleto.length) return { historial: [], resumenGrafico: { labels: [], ventas: [], egresos: [] } };

  const inicio = new Date(filtros.fechaInicio + 'T00:00:00');
  const fin = new Date(filtros.fechaFin + 'T23:59:59');

  const historialFiltrado = historialCompleto.filter(row => {
    const fechaCierre = new Date(row[headers.indexOf('FechaCierre')]);
    return fechaCierre >= inicio && fechaCierre <= fin;
  });

  const resumenGrafico = { labels: [], ventas: [], egresos: [] };
  const datosAgrupados = {};
  historialFiltrado.forEach(row => {
    const fecha = Utilities.formatDate(new Date(row[headers.indexOf('FechaCierre')]), TIMEZONE, 'yyyy-MM-dd');
    if (!datosAgrupados[fecha]) datosAgrupados[fecha] = { ventas: 0, egresos: 0 };
    datosAgrupados[fecha].ventas += Number(row[headers.indexOf('TotalVentasApp')]) || 0;
    datosAgrupados[fecha].egresos += Number(row[headers.indexOf('TotalEgresos')]) || 0;
  });

  const fechasOrdenadas = Object.keys(datosAgrupados).sort();
  fechasOrdenadas.forEach(fecha => {
    resumenGrafico.labels.push(fecha);
    resumenGrafico.ventas.push(datosAgrupados[fecha].ventas);
    resumenGrafico.egresos.push(datosAgrupados[fecha].egresos);
  });
  
  return { historial: historialFiltrado, resumenGrafico };
}

function obtenerReporteFlujoDinero(filtros) {
  const { data: movData, headers: movHeaders } = obtenerDatosHoja(SHEETS.MOVIMIENTOS_CAJA);
  if (!movData.length) return {};

  const inicio = new Date(filtros.fechaInicio + 'T00:00:00');
  const fin = new Date(filtros.fechaFin + 'T23:59:59');

  const movFiltrados = movData.filter(row => {
    const fechaMov = new Date(row[movHeaders.indexOf('FechaHora')]);
    return fechaMov >= inicio && fechaMov <= fin;
  });

  const totales = {
    ingresosPorVentas: 0,
    ingresosPorDeudas: 0,
    totalEgresos: 0,
    creditosOtorgados: 0
  };

  movFiltrados.forEach(row => {
    const tipo = row[movHeaders.indexOf('TipoMovimiento')];
    const monto = Number(row[movHeaders.indexOf('Monto')]);

    if (tipo.includes('PAGO_CLIENTE')) {
      totales.ingresosPorVentas += monto;
    } else if (tipo.includes('PAGO_DEUDA')) {
      totales.ingresosPorDeudas += monto;
    } else if (tipo === 'CREDITO_OTORGADO') {
      totales.creditosOtorgados += Math.abs(monto);
    } else if (monto < 0) {
      totales.totalEgresos += Math.abs(monto);
    }
  });

  return totales;
}

function obtenerReporteRentabilidad(filtros) {
  const { data: ventasData, headers: ventasHeaders } = obtenerDatosHoja(SHEETS.VENTAS);
  const inicio = new Date(filtros.fechaInicio + 'T00:00:00');
  const fin = new Date(filtros.fechaFin + 'T23:59:59');

  const ventasDelPeriodo = ventasData.filter(row => {
    const fechaVenta = new Date(row[ventasHeaders.indexOf('FechaHora')]);
    return fechaVenta >= inicio && fechaVenta <= fin;
  });
  const ventaIDs = new Set(ventasDelPeriodo.map(v => v[ventasHeaders.indexOf('VentaID')]));

  const { data: detallesData, headers: detallesHeaders } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
  const detallesDelPeriodo = detallesData.filter(d => ventaIDs.has(d[detallesHeaders.indexOf('VentaID')]));

  const { data: prodsData, headers: prodsHeaders } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  const mapaCostos = prodsData.reduce((map, p) => {
    map[p[prodsHeaders.indexOf('SKU')]] = Number(p[prodsHeaders.indexOf('PrecioCosto')]) || 0;
    return map;
  }, {});

  let totalVentasBrutas = 0;
  let totalCostoMercaderia = 0;
  detallesDelPeriodo.forEach(d => {
    const subtotal = Number(d[detallesHeaders.indexOf('Subtotal')]);
    const cantidad = Number(d[detallesHeaders.indexOf('Cantidad')]);
    const sku = d[detallesHeaders.indexOf('SKU')];
    
    totalVentasBrutas += subtotal;
    totalCostoMercaderia += (mapaCostos[sku] || 0) * cantidad;
  });

  const utilidadBruta = totalVentasBrutas - totalCostoMercaderia;

  const { data: egresosData, headers: egresosHeaders } = obtenerDatosHoja(SHEETS.EGRESOS);
  const totalEgresos = egresosData
    .filter(row => {
      const fechaEgreso = new Date(row[egresosHeaders.indexOf('FechaHora')]);
      return fechaEgreso >= inicio && fechaEgreso <= fin;
    })
    .reduce((sum, row) => sum + (Number(row[egresosHeaders.indexOf('Monto')]) || 0), 0);
  
  const utilidadNeta = utilidadBruta - totalEgresos;

  return { totalVentasBrutas, totalCostoMercaderia, utilidadBruta, totalEgresos, utilidadNeta };
}

function obtenerMetricasBI(filtros) {
  const { data: ventasData, headers: ventasHeaders } = obtenerDatosHoja(SHEETS.VENTAS);
  const inicio = new Date(filtros.fechaInicio + 'T00:00:00');
  const fin = new Date(filtros.fechaFin + 'T23:59:59');

  const ventasDelPeriodo = ventasData.filter(row => {
    const fechaVenta = new Date(row[ventasHeaders.indexOf('FechaHora')]);
    return fechaVenta >= inicio && fechaVenta <= fin;
  });
  const ventaIDs = new Set(ventasDelPeriodo.map(v => v[ventasHeaders.indexOf('VentaID')]));

  const { data: detallesData, headers: detallesHeaders } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
  const detallesDelPeriodo = detallesData.filter(d => ventaIDs.has(d[detallesHeaders.indexOf('VentaID')]));
  
  const productosResumen = {};
  const categoriaResumen = {};
  const horasResumen = Array(24).fill(0);

  detallesDelPeriodo.forEach(d => {
    const nombre = d[detallesHeaders.indexOf('ProductoNombre')];
    const categoria = d[detallesHeaders.indexOf('Categoria')] || 'Sin Categoría';
    const cantidad = Number(d[detallesHeaders.indexOf('Cantidad')]);
    const subtotal = Number(d[detallesHeaders.indexOf('Subtotal')]);

    if (!productosResumen[nombre]) productosResumen[nombre] = { cantidad: 0, monto: 0 };
    productosResumen[nombre].cantidad += cantidad;
    productosResumen[nombre].monto += subtotal;
    
    if (!categoriaResumen[categoria]) categoriaResumen[categoria] = 0;
    categoriaResumen[categoria] += subtotal;
  });

  ventasDelPeriodo.forEach(v => {
    const hora = new Date(v[ventasHeaders.indexOf('FechaHora')]).getHours();
    horasResumen[hora]++;
  });

  const topProductos = Object.entries(productosResumen).map(([nombre, data]) => ({ nombre, ...data }));

  return {
    topProductosCantidad: [...topProductos].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5),
    topProductosMonto: [...topProductos].sort((a, b) => b.monto - a.monto).slice(0, 5),
    ventasPorCategoria: categoriaResumen,
    actividadPorHora: horasResumen
  };
}

function obtenerResumenProductosVendidos(filtros) {
  const { headers: ventasHeaders, data: ventasData } = obtenerDatosHoja(SHEETS.VENTAS);
  let ventasFiltradas = [];

  if (filtros && filtros.sesionID) {
    const sesionIdIndex = ventasHeaders.indexOf('SesionID');
    ventasFiltradas = ventasData.filter(row => row[sesionIdIndex] === filtros.sesionID);
  } else if (filtros && filtros.fechaInicio && filtros.fechaFin) {
    const inicio = new Date(filtros.fechaInicio + 'T00:00:00');
    const fin = new Date(filtros.fechaFin + 'T23:59:59');
    const fechaIndex = ventasHeaders.indexOf('FechaHora');
    
    ventasFiltradas = ventasData.filter(row => {
      const fechaVenta = new Date(row[fechaIndex]);
      return fechaVenta >= inicio && fechaVenta <= fin;
    });
  } else {
    return {};
  }
  
  if (ventasFiltradas.length === 0) return {};

  const ventaIDsFiltrados = new Set(ventasFiltradas.map(row => row[ventasHeaders.indexOf('VentaID')]));

  const { headers, data } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
  const detallesFiltrados = data.filter(row => ventaIDsFiltrados.has(row[headers.indexOf('VentaID')]));
  if (detallesFiltrados.length === 0) return {};

  const indices = {
    categoria: headers.indexOf('Categoria'),
    nombre: headers.indexOf('ProductoNombre'),
    cantidad: headers.indexOf('Cantidad'),
    subtotal: headers.indexOf('Subtotal')
  };

  const reporte = {};
  detallesFiltrados.forEach(row => {
    const categoria = row[indices.categoria] || 'Sin Categoría';
    const nombre = row[indices.nombre];
    const cantidad = Number(row[indices.cantidad]) || 0;
    const subtotal = Number(row[indices.subtotal]) || 0;

    if (!reporte[categoria]) {
      reporte[categoria] = { productos: {}, totalCantidad: 0, totalVenta: 0 };
    }
    if (!reporte[categoria].productos[nombre]) {
      reporte[categoria].productos[nombre] = { cantidad: 0, venta: 0 };
    }
    reporte[categoria].productos[nombre].cantidad += cantidad;
    reporte[categoria].productos[nombre].venta += subtotal;
  });

  for (const cat in reporte) {
    let totalCatCantidad = 0;
    let totalCatVenta = 0;
    for (const prod in reporte[cat].productos) {
      totalCatCantidad += reporte[cat].productos[prod].cantidad;
      totalCatVenta += reporte[cat].productos[prod].venta;
    }
    reporte[cat].totalCantidad = totalCatCantidad;
    reporte[cat].totalVenta = totalCatVenta;
  }

  return reporte;
}

function obtenerResumenProductosVendidosPorSesion(sesionID) {
  const { data: ventasData, headers: ventasHeaders } = obtenerDatosHoja(SHEETS.VENTAS);
  const ventaIDsDeSesion = new Set(
    ventasData
      .filter(row => row[ventasHeaders.indexOf('SesionID')] === sesionID)
      .map(row => row[ventasHeaders.indexOf('VentaID')])
  );

  if (ventaIDsDeSesion.size === 0) {
    return [];
  }

  const { data: detallesData, headers: detallesHeaders } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
  const detallesDeSesion = detallesData.filter(row => ventaIDsDeSesion.has(row[detallesHeaders.indexOf('VentaID')]));

  const resumen = {};
  const idx = {
    sku: detallesHeaders.indexOf('SKU'),
    nombre: detallesHeaders.indexOf('ProductoNombre'),
    cantidad: detallesHeaders.indexOf('Cantidad'),
    subtotal: detallesHeaders.indexOf('Subtotal')
  };

  detallesDeSesion.forEach(row => {
    const sku = row[idx.sku];
    if (!resumen[sku]) {
      resumen[sku] = {
        SKU: sku,
        ProductoNombre: row[idx.nombre],
        CantidadTotal: 0,
        VentaTotal: 0
      };
    }
    resumen[sku].CantidadTotal += Number(row[idx.cantidad]);
    resumen[sku].VentaTotal += Number(row[idx.subtotal]);
  });

  return Object.values(resumen).sort((a, b) => a.ProductoNombre.localeCompare(b.ProductoNombre));
}


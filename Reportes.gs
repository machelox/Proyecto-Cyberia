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

/**
 * Genera un reporte completo de ventas para un rango de fechas y lo exporta a Google Drive.
 * @param {string} fechaInicio Fecha de inicio en formato 'YYYY-MM-DD'
 * @param {string} fechaFin Fecha de fin en formato 'YYYY-MM-DD'
 * @param {string} [formato='csv'] Formato de exportación: 'csv' o 'pdf'
 * @param {string} [emailAdmin] Email del administrador para notificación (opcional)
 * @returns {Object} Objeto con información del archivo generado y ubicación
 */
function generarReporteVentas(fechaInicio, fechaFin, formato = 'csv', emailAdmin = null) {
  try {
    registrarLog('REPORTE_VENTAS_INICIADO', `Generando reporte desde ${fechaInicio} hasta ${fechaFin}`, 'SISTEMA');
    
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T23:59:59');
    
    // Obtener datos de ventas
    const { headers: ventasHeaders, data: ventasData } = obtenerDatosHoja(SHEETS.VENTAS);
    const ventasDelPeriodo = ventasData.filter(row => {
      const fechaVenta = new Date(row[ventasHeaders.indexOf('FechaHora')]);
      return fechaVenta >= inicio && fechaVenta <= fin;
    });
    
    if (ventasDelPeriodo.length === 0) {
      registrarLog('REPORTE_VENTAS_VACIO', 'No se encontraron ventas en el período', 'SISTEMA');
      throw new Error('No se encontraron ventas en el período especificado.');
    }
    
    // Obtener detalles de ventas
    const ventaIDs = new Set(ventasDelPeriodo.map(v => v[ventasHeaders.indexOf('VentaID')]));
    const { headers: detallesHeaders, data: detallesData } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
    const detallesDelPeriodo = detallesData.filter(d => ventaIDs.has(d[detallesHeaders.indexOf('VentaID')]));
    
    // Calcular totales
    const totalVentas = ventasDelPeriodo.reduce((sum, v) => 
      sum + (Number(v[ventasHeaders.indexOf('TotalVenta')]) || 0), 0);
    const totalItems = detallesDelPeriodo.reduce((sum, d) => 
      sum + (Number(d[detallesHeaders.indexOf('Cantidad')]) || 0), 0);
    
    // Preparar datos del reporte
    const reporteData = [];
    reporteData.push(['REPORTE DE VENTAS']);
    reporteData.push(['Período:', `${fechaInicio} al ${fechaFin}`]);
    reporteData.push(['Fecha de generación:', Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")]);
    reporteData.push([]);
    reporteData.push(['RESUMEN']);
    reporteData.push(['Total de ventas:', ventasDelPeriodo.length]);
    reporteData.push(['Total de items vendidos:', totalItems]);
    reporteData.push(['Total de ingresos:', `S/ ${totalVentas.toFixed(2)}`]);
    reporteData.push([]);
    reporteData.push(['DETALLE DE VENTAS']);
    
    // Encabezados del detalle
    const columnasVenta = ['VentaID', 'FechaHora', 'ClienteDNI', 'ClienteNombre', 'TotalVenta', 'EstadoPago'];
    reporteData.push(columnasVenta);
    
    // Datos de ventas
    ventasDelPeriodo.forEach(venta => {
      const fila = columnasVenta.map(col => {
        const idx = ventasHeaders.indexOf(col);
        if (idx === -1) return '';
        const valor = venta[idx];
        if (col === 'FechaHora' && valor instanceof Date) {
          return Utilities.formatDate(valor, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
        }
        return valor;
      });
      reporteData.push(fila);
    });
    
    reporteData.push([]);
    reporteData.push(['DETALLE DE PRODUCTOS VENDIDOS']);
    const columnasDetalle = ['VentaID', 'SKU', 'ProductoNombre', 'Categoria', 'Cantidad', 'PrecioUnitario', 'Subtotal'];
    reporteData.push(columnasDetalle);
    
    // Datos de detalles
    detallesDelPeriodo.forEach(detalle => {
      const fila = columnasDetalle.map(col => {
        const idx = detallesHeaders.indexOf(col);
        if (idx === -1) return '';
        return detalle[idx];
      });
      reporteData.push(fila);
    });
    
    // Crear archivo temporal en Sheets para exportación
    const nombreArchivo = `Reporte_Ventas_${fechaInicio}_${fechaFin}`;
    const folder = DriveApp.getRootFolder(); // O cambiar por una carpeta específica
    
    let archivo;
    
    if (formato.toLowerCase() === 'csv') {
      // Generar CSV
      const csvContent = reporteData.map(row => 
        row.map(cell => {
          const cellStr = String(cell || '');
          // Escapar comillas y encerrar en comillas si contiene comas o comillas
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ).join('\n');
      
      archivo = folder.createFile(nombreArchivo + '.csv', csvContent, MimeType.CSV);
      registrarLog('REPORTE_VENTAS_EXPORTADO', `Archivo CSV creado: ${archivo.getName()}`, 'SISTEMA');
      
    } else if (formato.toLowerCase() === 'pdf') {
      // Generar PDF creando una hoja temporal
      const hojaTemp = SPREADSHEET.insertSheet(`Temp_Reporte_${Date.now()}`);
      try {
        hojaTemp.getRange(1, 1, reporteData.length, reporteData[0].length).setValues(reporteData);
        hojaTemp.getRange(1, 1, 1, reporteData[0].length).setFontWeight('bold');
        hojaTemp.setColumnWidth(1, 150);
        hojaTemp.setColumnWidth(2, 180);
        
        const pdfBlob = hojaTemp.getAs('application/pdf');
        archivo = folder.createFile(pdfBlob.setName(nombreArchivo + '.pdf'));
        registrarLog('REPORTE_VENTAS_EXPORTADO', `Archivo PDF creado: ${archivo.getName()}`, 'SISTEMA');
      } finally {
        SPREADSHEET.deleteSheet(hojaTemp);
      }
    } else {
      throw new Error('Formato no soportado. Use "csv" o "pdf".');
    }
    
    const resultado = {
      status: 'ok',
      message: `Reporte generado exitosamente: ${archivo.getName()}`,
      archivo: {
        id: archivo.getId(),
        nombre: archivo.getName(),
        url: archivo.getUrl(),
        tamaño: archivo.getSize()
      },
      resumen: {
        totalVentas: ventasDelPeriodo.length,
        totalItems: totalItems,
        totalIngresos: totalVentas
      }
    };
    
    // Enviar notificación por correo si se proporciona email
    if (emailAdmin) {
      enviarNotificacionReporte(emailAdmin, resultado, fechaInicio, fechaFin);
    }
    
    return resultado;
    
  } catch (error) {
    registrarLog('REPORTE_VENTAS_ERROR', `Error al generar reporte: ${error.message}`, 'SISTEMA');
    throw error;
  }
}


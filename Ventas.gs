/**
 * Módulo: Ventas y Pagos
 * Depende de: Constants.gs, Utils.gs
 */

function registrarOrdenDeVenta(ordenData) {
  const ss = SPREADSHEET;
  const ahora = new Date();
  
  const productosData = obtenerDatosHoja(SHEETS.PRODUCTOS);
  const skuIndex = productosData.headers.indexOf('SKU');
  const precioIndex = productosData.headers.indexOf('PrecioVenta');
  const catIndex = productosData.headers.indexOf('Categoria');
  const stockIndex = productosData.headers.indexOf('Stock');

  let totalVentaCalculado = 0;
  
  const carritoValidado = ordenData.carrito.map(itemCarrito => {
    const productoEncontrado = productosData.data.find(row => row[skuIndex] === itemCarrito.sku);
    if (!productoEncontrado) throw new Error(`Producto con SKU ${itemCarrito.sku} no encontrado.`);
    if (Number(productoEncontrado[stockIndex]) < itemCarrito.cantidad) throw new Error(`Stock insuficiente para: ${itemCarrito.nombre}.`);

    const precioUnitario = Number(productoEncontrado[precioIndex]);
    const categoria = productoEncontrado[catIndex] || 'Sin Categoría';
    totalVentaCalculado += precioUnitario * itemCarrito.cantidad;
    return { ...itemCarrito, precio: precioUnitario, categoria: categoria };
  });

  const ventaID = `VTA-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}`;
  const fechaHora = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  
  ss.getSheetByName(SHEETS.VENTAS).appendRow([
    ventaID, fechaHora, ordenData.sesionID, ordenData.usuarioEmail, ordenData.cliente.dni, 
    ordenData.cliente.nombre, ordenData.pc, totalVentaCalculado, 'Pendiente'
  ]);

  const detalleSheet = ss.getSheetByName(SHEETS.SALES_DETAILS);
  const detallesParaGuardar = carritoValidado.map(item => [
      `${ventaID}-${item.sku}`, ventaID, item.sku, item.nombre, 
      item.categoria, item.cantidad, item.precio, item.precio * item.cantidad
  ]);
  detalleSheet.getRange(detalleSheet.getLastRow() + 1, 1, detallesParaGuardar.length, detallesParaGuardar[0].length).setValues(detallesParaGuardar);

  SpreadsheetApp.flush();

  return { ventaID: ventaID, total: totalVentaCalculado };
}

function registrarPagoConsolidado(pagoData) {
  const { cliente, totalACobrar, montoPagado, metodoPago, sesionID, usuarioEmail } = pagoData;

  if (!totalACobrar || !montoPagado || !metodoPago || !sesionID || !usuarioEmail) throw new Error("Faltan datos esenciales para registrar el pago.");
  if (Number(montoPagado) > Number(totalACobrar)) throw new Error("El monto pagado no puede ser mayor al total a cobrar.");

  const ahora = new Date();
  const fechaHora = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  const movimientosSheet = SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_CAJA);
  
  let tipoMovimiento = (metodoPago === 'Efectivo') ? 'PAGO_CLIENTE_EFECTIVO' : 'PAGO_CLIENTE_YAPE_PLIN';

  movimientosSheet.appendRow([
    `MOV-PAGO-${Utilities.getUuid()}`, sesionID, fechaHora, usuarioEmail,
    tipoMovimiento, `Pago de consumo de ${cliente.nombre || 'Cliente Varios'}`, montoPagado
  ]);

  const diferencia = Number(totalACobrar) - Number(montoPagado);
  let mensajeDeuda = "";

  if (diferencia > 0.01) {
    if (!cliente.dni || cliente.dni.toLowerCase() === 'varios') throw new Error("No se puede generar una deuda a un cliente sin DNI ('Varios').");
    
    crearNuevaDeuda({
      cliente: cliente, monto: diferencia,
      notas: `Saldo pendiente del consumo total de S/ ${totalACobrar.toFixed(2)}`,
      sesionID: sesionID, usuarioEmail: usuarioEmail
    }); 
    mensajeDeuda = ` Se generó una deuda por S/ ${diferencia.toFixed(2)}.`;
  }
  
  actualizarEstadoVentasDeSesion(sesionID, 'Pagada');

  return { status: 'ok', message: `Pago de S/ ${Number(montoPagado).toFixed(2)} registrado.${mensajeDeuda}` };
}

function actualizarEstadoVentasDeSesion(sesionID, nuevoEstado) {
  const ventasSheet = SPREADSHEET.getSheetByName(SHEETS.VENTAS);
  const { headers, data } = obtenerDatosHoja(SHEETS.VENTAS);
  const idx = { sesionId: headers.indexOf('SesionID'), estado: headers.indexOf('EstadoPago') };

  data.forEach((row, index) => {
    if (row[idx.sesionId] === sesionID && row[idx.estado] === 'Pendiente') {
      ventasSheet.getRange(index + 2, idx.estado + 1).setValue(nuevoEstado);
    }
  });
}

function gestionarOrdenVenta(ventaID, accion) {
  const ss = SPREADSHEET;
  const ventasSheet = ss.getSheetByName(SHEETS.VENTAS);
  const { headers: ventasHeaders, data: ventasData } = obtenerDatosHoja(SHEETS.VENTAS);
  
  const idxVenta = {
    ventaId: ventasHeaders.indexOf('VentaID'),
    estado: ventasHeaders.indexOf('EstadoPago')
  };
  const idVentaRecortado = String(ventaID).trim(); 
  const filaVentaIndex = ventasData.findIndex(row => String(row[idxVenta.ventaId]).trim() === idVentaRecortado);

  if (filaVentaIndex === -1) {
    throw new Error("Error: No se encontró la venta.");
  }
  
  const estadoActual = ventasData[filaVentaIndex][idxVenta.estado];
  const filaAActualizar = filaVentaIndex + 2;

  switch (accion.toUpperCase()) {
    case 'CONFIRMAR':
      if (estadoActual !== 'Pendiente') {
        throw new Error(`Error: Solo se pueden confirmar ventas en estado 'Pendiente'. Estado actual: ${estadoActual}.`);
      }

      const detalles = obtenerDetallesDeVenta(ventaID);
      const itemsVenta = detalles.map(item => ({
        sku: item.SKU,
        cantidad: item.Cantidad,
        nombre: item.ProductoNombre
      }));

      procesarVenta(itemsVenta, ventasData[filaVentaIndex][ventasHeaders.indexOf('UsuarioEmail')]);

      ventasSheet.getRange(filaAActualizar, idxVenta.estado + 1).setValue('Confirmado');
      SpreadsheetApp.flush();
      return `Venta ${ventaID} confirmada y stock descontado con éxito.`;

    case 'CANCELAR':
      if (estadoActual === 'Cancelada') {
        throw new Error("Error: Esta venta ya ha sido cancelada.");
      }
      
      ventasSheet.getRange(filaAActualizar, idxVenta.estado + 1).setValue('Cancelada');
      SpreadsheetApp.flush();
      if (estadoActual === 'Pendiente') {
        const detallesAll = obtenerDatosHoja(SHEETS.SALES_DETAILS);
        const idxDetalle = { 
          ventaId: detallesAll.headers.indexOf('VentaID'), 
          sku: detallesAll.headers.indexOf('SKU'), 
          cantidad: detallesAll.headers.indexOf('Cantidad') 
        };
        
        const itemsDevueltos = detallesAll.data
          .filter(row => row[idxDetalle.ventaId] === ventaID)
          .map(row => ({ sku: row[idxDetalle.sku], cantidad: row[idxDetalle.cantidad] }));

        for (const item of itemsDevueltos) {
          registrarMovimientoInventario({
            sku: item.sku,
            tipo: 'DEVOLUCION_CANCELACION',
            cantidad: Math.abs(item.cantidad),
            notas: `Devolución por cancelación de Venta ${ventaID}`,
            emailUsuario: 'SISTEMA'
          });
        }
        return `Venta ${ventaID} cancelada y stock devuelto.`;
      }
      return `Venta ${ventaID} marcada como cancelada. El stock no se modificó porque la venta no estaba 'Pendiente'.`;
    
    default:
      throw new Error("Acción no reconocida.");
  }
}

function obtenerHistorialVentas() {
  const { headers, data } = obtenerDatosHoja(SHEETS.VENTAS);
  
  const historial = data.map(ventaRow => {
    const ventaObj = {};
    headers.forEach((header, i) => {
      let value = ventaRow[i];
      if (header === 'FechaHora' && value instanceof Date) {
        ventaObj[header] = Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
      } else {
        ventaObj[header] = value;
      }
    });
    return ventaObj;
  }).sort((a, b) => new Date(b.FechaHora) - new Date(a.FechaHora));

  return historial;
}

function obtenerDetallesDeVenta(ventaID) {
  const { headers, data } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
  const ventaIdIndex = headers.indexOf('VentaID');
  
  return data
    .filter(row => row[ventaIdIndex] === ventaID)
    .map(row => {
      const detalle = {};
      headers.forEach((h, i) => detalle[h] = row[i]);
      return detalle;
    });
}

function obtenerClientes() {
  const { headers, data } = obtenerDatosHoja(SHEETS.CLIENTES);
  if (!headers.length) return [];

  const idx = {
    dni: headers.indexOf('DNI'),
    nombres: headers.indexOf('Nombres'),
    alias: headers.indexOf('Alias')
  };

  return data
    .filter(row => row[idx.dni] && row[idx.nombres])
    .map(row => {
      const alias = row[idx.alias] || '';
      const nombre = row[idx.nombres];
      const dni = row[idx.dni];
      const texto = alias ? `${alias} - ${nombre} (${dni})` : `${nombre} (${dni})`;
      return { dni: dni, texto: texto };
    });
}

function registrarNuevoCliente(cliente) {
  const hoja = SPREADSHEET.getSheetByName(SHEETS.CLIENTES);
  const nuevoId = hoja.getLastRow();
  hoja.appendRow([
    nuevoId,
    cliente.dni,
    cliente.nombres,
    cliente.email || '',
    cliente.alias || '',
    cliente.celular || ''
  ]);
  return cliente;
}


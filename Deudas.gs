/**
 * Módulo: Deudas de Clientes
 * Depende de: Constants.gs, Utils.gs
 */

function obtenerDatosCompletosDeudas() {
  return {
    pendientes: obtenerDeudasPendientes(),
    historialDeudas: obtenerHistorialCompletoDeudas(),
    historialPagos: obtenerHistorialPagosDeuda()
  };
}

function obtenerDeudasPendientes() {
  const { headers, data } = obtenerDatosHoja(SHEETS.DEUDAS_CLIENTES);
  if (!headers.length) return [];
  
  const estadoIndex = headers.indexOf('Estado');
  
  return data
    .filter(row => row[estadoIndex] === 'Pendiente')
    .map(row => {
        const deuda = {};
        headers.forEach((header, i) => {
           let value = row[i];
           if ((header === 'FechaCreacion' || header === 'FechaVencimiento') && value instanceof Date) {
             deuda[header] = Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd");
           } else {
             deuda[header] = value;
           }
        });
        return deuda;
    });
}

function obtenerHistorialCompletoDeudas() {
  const { headers, data } = obtenerDatosHoja(SHEETS.DEUDAS_CLIENTES);
  if (!headers.length) return [];

  const historial = data.map(row => {
      const deuda = {};
      headers.forEach((header, i) => {
        let value = row[i];
        if ((header === 'FechaCreacion' || header === 'FechaVencimiento') && value instanceof Date) {
          deuda[header] = Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd");
        } else {
          deuda[header] = value;
        }
      });
      return deuda;
    });
    
  historial.sort((a, b) => new Date(b.FechaCreacion) - new Date(a.FechaCreacion));
  return historial;
}

function obtenerHistorialPagosDeuda() {
  const { headers, data } = obtenerDatosHoja(SHEETS.PAGO_DEUDAS);
  if (!headers.length) return [];

  const historial = data.map(row => {
      const pago = {};
      headers.forEach((h, i) => {
          pago[h] = row[i] instanceof Date ? Utilities.formatDate(row[i], TIMEZONE, "yyyy-MM-dd HH:mm:ss") : row[i];
      });
      return pago;
    });
    
  historial.sort((a, b) => new Date(b.FechaHora) - new Date(a.FechaHora));
  return historial;
}

function crearNuevaDeuda(datosDeuda) {
  if (!datosDeuda.monto || datosDeuda.monto <= 0) throw new Error("El monto debe ser positivo.");
  if (!datosDeuda.cliente.dni) throw new Error("Debe seleccionar un cliente.");

  const deudasSheet = SPREADSHEET.getSheetByName(SHEETS.DEUDAS_CLIENTES);
  const ahora = new Date();
  const deudaID = `DEU-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}-${Utilities.getUuid().substring(0,5)}`;

  deudasSheet.appendRow([
    deudaID, datosDeuda.cliente.dni, datosDeuda.cliente.nombre,
    '',
    ahora,
    datosDeuda.fechaVencimiento || '',
    datosDeuda.monto,
    0,
    datosDeuda.monto,
    'Pendiente',
    datosDeuda.notas || '',
    datosDeuda.sesionID
  ]);

  const movimientosSheet = SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_CAJA);
  movimientosSheet.appendRow([
    `MOV-${deudaID}`, datosDeuda.sesionID, Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
    datosDeuda.usuarioEmail, 'CREDITO_OTORGADO',
    `Crédito a ${datosDeuda.cliente.nombre}`, -Math.abs(datosDeuda.monto)
  ]);
  
  return { deudaID: deudaID, monto: datosDeuda.monto };
}

function registrarPagoDeDeuda(datosPago) {
  if (!datosPago.monto || datosPago.monto <= 0) throw new Error("El monto del pago debe ser positivo.");
  if (!datosPago.deudaID) throw new Error("No se especificó un ID de deuda.");

  const ahora = new Date();
  const fechaHora = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  
  const pagoDeudaID = `PGD-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}`;
  SPREADSHEET.getSheetByName(SHEETS.PAGO_DEUDAS).appendRow([
    pagoDeudaID, datosPago.deudaID, fechaHora, datosPago.sesionID,
    datosPago.usuarioEmail, datosPago.clienteID, datosPago.metodoPago,
    datosPago.monto, datosPago.notas
  ]);

  let tipoMovimiento = '';
  if (datosPago.metodoPago === 'Efectivo') tipoMovimiento = 'PAGO_DEUDA_EFECTIVO';
  else if (datosPago.metodoPago === 'Yape/Plin') tipoMovimiento = 'PAGO_DEUDA_YAPE_PLIN';
  
  if (tipoMovimiento) {
    SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_CAJA).appendRow([
      `MOV-${pagoDeudaID}`, datosPago.sesionID, fechaHora, datosPago.usuarioEmail,
      tipoMovimiento, `Abono a deuda ${datosPago.deudaID}`, datosPago.monto
    ]);
  }

  actualizarEstadoDeuda(datosPago.deudaID);
  
  return { message: "Pago de deuda registrado y saldo actualizado con éxito." };
}

function actualizarEstadoDeuda(deudaID) {
  const deudasSheet = SPREADSHEET.getSheetByName(SHEETS.DEUDAS_CLIENTES);
  const { headers: deudasHeaders, data: deudasData } = obtenerDatosHoja(SHEETS.DEUDAS_CLIENTES);
  const { headers: pagosHeaders, data: pagosData } = obtenerDatosHoja(SHEETS.PAGO_DEUDAS);
  
  const idxDeuda = { id: deudasHeaders.indexOf('DeudaID'), original: deudasHeaders.indexOf('MontoOriginal'), pagado: deudasHeaders.indexOf('MontoPagado'), saldo: deudasHeaders.indexOf('SaldoPendiente'), estado: deudasHeaders.indexOf('Estado') };
  const idxPago = { id: pagosHeaders.indexOf('DeudaID_Asociada'), monto: pagosHeaders.indexOf('Monto') };
  
  const filaIndex = deudasData.findIndex(row => row[idxDeuda.id] === deudaID);
  if (filaIndex === -1) return;

  const montoOriginal = Number(deudasData[filaIndex][idxDeuda.original]) || 0;
  
  const totalPagado = pagosData
    .filter(pago => pago[idxPago.id] === deudaID)
    .reduce((sum, pago) => sum + (Number(pago[idxPago.monto]) || 0), 0);
  
  const nuevoSaldo = montoOriginal - totalPagado;
  const nuevoEstado = (nuevoSaldo <= 0.01) ? 'Pagada' : 'Pendiente';

  const filaAActualizar = filaIndex + 2;
  deudasSheet.getRange(filaAActualizar, idxDeuda.pagado + 1).setValue(totalPagado);
  deudasSheet.getRange(filaAActualizar, idxDeuda.saldo + 1).setValue(nuevoSaldo);
  deudasSheet.getRange(filaAActualizar, idxDeuda.estado + 1).setValue(nuevoEstado);
}


/**
 * Módulo: Deudas de Clientes
 * Depende de: Constants.gs, Utils.gs
 * * Versión actualizada que incluye tanto la vista individual
 * como la vista consolidada de deudas pendientes.
 */

function obtenerDatosCompletosDeudas() {
  return {
    // AHORA DEVOLVEMOS AMBAS VISTAS
    pendientesIndividuales: obtenerDeudasPendientes_Individuales(),
    pendientesConsolidadas: obtenerDeudasPendientes_Consolidadas(),
    historialDeudas: obtenerHistorialCompletoDeudas(),
    historialPagos: obtenerHistorialPagosDeuda()
  };
}

// ----------------------------------------------------
// --- NUEVAS FUNCIONES DE LECTURA (LÓGICA ANTIGUA) ---
// ----------------------------------------------------
/**
 * USE ESTA FUNCIÓN PARA PROBAR DESDE EL EDITOR DE GAS
 * Seleccione "test_DeudasConsolidadas" y presione "Ejecutar".
 */
function test_DeudasConsolidadas() {
  Logger.log("=== INICIANDO PRUEBA MANUAL ===");
  const resultado = obtenerDeudasPendientes_Consolidadas();
  Logger.log("=== RESULTADO FINAL DE LA PRUEBA ===");
  Logger.log(JSON.stringify(resultado, null, 2));
}
/**
 * [AÑADIDA - LÓGICA ANTIGUA]
 * Obtiene las deudas pendientes consolidadas por CLIENTE.
 * Suma todas las deudas y todos los pagos de un cliente
 * para dar un saldo total.
 */
/**
 * [MODIFICADA CON LOGS]
 * Obtiene las deudas pendientes consolidadas por CLIENTE.
 */
function obtenerDeudasPendientes_Consolidadas() {
  Logger.log("--- 1. Iniciando obtenerDeudasPendientes_Consolidadas ---");
  
  const { headers: deudasHeaders, data: deudasCreadas } = obtenerDatosHoja(SHEETS.DEUDAS_CLIENTES);
  const { headers: pagosHeaders, data: pagosDeDeuda } = obtenerDatosHoja(SHEETS.PAGO_DEUDAS);

  Logger.log(`--- 2. Datos crudos: ${deudasCreadas.length} deudas creadas, ${pagosDeDeuda.length} pagos recibidos.`);

  const clientesConMovimientos = {};

  // --- PASO 1: Procesar todas las DEUDAS creadas ---
  const idxDeuda = {
      id: deudasHeaders.indexOf('DeudaID'),
      clienteId: deudasHeaders.indexOf('ClienteID'),
      clienteNombre: deudasHeaders.indexOf('ClienteNombre'),
      monto: deudasHeaders.indexOf('MontoOriginal'),
      fechaCreacion: deudasHeaders.indexOf('FechaCreacion'),
      fechaVenc: deudasHeaders.indexOf('FechaVencimiento'),
      notas: deudasHeaders.indexOf('Notas')
  };

  for (const row of deudasCreadas) {
      const clienteId = row[idxDeuda.clienteId];
      if (!clienteId) continue; 
      
      const key = String(clienteId).trim(); // Forzar a string

      if (!clientesConMovimientos[key]) {
          clientesConMovimientos[key] = {
              ClienteID: clienteId,
              ClienteNombre: row[idxDeuda.clienteNombre],
              TotalDeuda: 0,
              TotalPagado: 0,
              Deudas: []
          };
      }
      const montoOriginal = Number(row[idxDeuda.monto]) || 0;
      clientesConMovimientos[key].TotalDeuda += montoOriginal;
      
      clientesConMovimientos[key].Deudas.push({
          DeudaID: row[idxDeuda.id],
          MontoOriginal: montoOriginal,
          FechaCreacion: row[idxDeuda.fechaCreacion] instanceof Date ? Utilities.formatDate(row[idxDeuda.fechaCreacion], TIMEZONE, "yyyy-MM-dd") : row[idxDeuda.fechaCreacion],
          FechaVencimiento: row[idxDeuda.fechaVenc] instanceof Date ? Utilities.formatDate(row[idxDeuda.fechaVenc], TIMEZONE, "yyyy-MM-dd") : row[idxDeuda.fechaVenc],
          Notas: row[idxDeuda.notas]
      });
  }

  Logger.log("--- 3. Objeto 'clientesConMovimientos' (Después de sumar Deudas):");
  Logger.log(JSON.stringify(clientesConMovimientos, null, 2));


  // --- PASO 2: Procesar todos los PAGOS de deuda ---
  const idxPago = {
      clienteId: pagosHeaders.indexOf('ClienteID'),
      monto: pagosHeaders.indexOf('Monto')
  };

  for (const row of pagosDeDeuda) {
      const clienteId = row[idxPago.clienteId];
      if (!clienteId) continue;
      
      const key = String(clienteId).trim(); // Forzar a string

      if (clientesConMovimientos[key]) {
          clientesConMovimientos[key].TotalPagado += Number(row[idxPago.monto]) || 0;
      } else {
          // Log si un pago no encuentra un cliente (¡esto puede ser el error!)
          Logger.log(`ADVERTENCIA: Pago para ClienteID ${key} no encontró cliente en 'clientesConMovimientos'.`);
      }
  }

  Logger.log("--- 4. Objeto 'clientesConMovimientos' (Después de sumar Pagos):");
  Logger.log(JSON.stringify(clientesConMovimientos, null, 2));

  // --- PASO 3: Calcular saldos y construir el resultado final ---
  const deudasPendientes = [];
  for (const clienteIdKey in clientesConMovimientos) {
      const cliente = clientesConMovimientos[clienteIdKey];
      const saldoTotal = cliente.TotalDeuda - cliente.TotalPagado;

      if (saldoTotal > 0.01) { 
          const deudaRepresentativa = cliente.Deudas[0];
          deudasPendientes.push({
              DeudaID: deudaRepresentativa.DeudaID, 
              ClienteID: cliente.ClienteID, 
              ClienteNombre: cliente.ClienteNombre,
              MontoOriginal: cliente.TotalDeuda, 
              SaldoPendiente: saldoTotal, 
              FechaCreacion: deudaRepresentativa.FechaCreacion,
              FechaVencimiento: deudaRepresentativa.FechaVencimiento,
              Notas: 'Deuda consolidada'
          });
      }
  }
  
  Logger.log(`--- 5. Finalizado. ${deudasPendientes.length} deudas pendientes encontradas.`);
  return deudasPendientes;
}


// ----------------------------------------------------
// --- FUNCIONES ACTUALES (MODIFICADAS/MANTENIDAS) ---
// ----------------------------------------------------

/**
 * [RENOMBRADA - LÓGICA NUEVA]
 * Obtiene una lista de deudas INDIVIDUALES que
 * aún están marcadas como 'Pendiente'.
 */
function obtenerDeudasPendientes_Individuales() {
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

/** [MANTENIDA] */
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

/** [MANTENIDA] */
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

/** [MANTENIDA] */
/**
 * [REVERTIDA]
 * Crea una nueva deuda.
 * Devuelve un objeto simple (NO el dataset completo).
 */
function crearNuevaDeuda(datosDeuda) {
  const ss = SPREADSHEET; 
  const timezone = TIMEZONE; 

  if (!datosDeuda.monto || datosDeuda.monto <= 0) {
    throw new Error("El monto de la deuda debe ser un número positivo.");
  }
  if (!datosDeuda.cliente.dni) {
    throw new Error("Se debe seleccionar un cliente.");
  }

  // Buscamos el nombre del cliente
  const { headers, data } = obtenerDatosHoja(SHEETS.CLIENTES);
  const dniIndex = headers.indexOf('DNI');
  const nombreIndex = headers.indexOf('Nombres');
  const clienteRow = data.find(row => row[dniIndex] == datosDeuda.cliente.dni);
  
  if (!clienteRow) {
    throw new Error(`No se pudo encontrar el cliente con DNI: ${datosDeuda.cliente.dni}`);
  }
  const nombreCliente = clienteRow[nombreIndex];

  const deudasSheet = ss.getSheetByName(SHEETS.DEUDAS_CLIENTES);
  const ahora = new Date();
  const deudaID = `DEU-${Utilities.formatDate(ahora, timezone, "yyyyMMddHHmmss")}-${Utilities.getUuid().substring(0,5)}`;

  const nuevaDeuda = [
    deudaID,
    datosDeuda.cliente.dni,
    nombreCliente, 
    '', // VentaID_Origen
    ahora, // FechaCreacion
    datosDeuda.fechaVencimiento || '',
    datosDeuda.monto, // MontoOriginal
    0, // MontoPagado
    datosDeuda.monto, // SaldoPendiente
    'Pendiente', // Estado
    datosDeuda.notas || '',
    datosDeuda.sesionID
  ];

  deudasSheet.appendRow(nuevaDeuda);
  
  const movimientosSheet = ss.getSheetByName(SHEETS.MOVIMIENTOS_CAJA);
  const fechaHora = Utilities.formatDate(ahora, timezone, "yyyy-MM-dd HH:mm:ss");
  
  movimientosSheet.appendRow([
    `MOV-${deudaID}`, datosDeuda.sesionID, fechaHora, datosDeuda.usuarioEmail,
    'CREDITO_OTORGADO',
    `Crédito a ${nombreCliente}`, 
    -Math.abs(datosDeuda.monto)
  ]);

  // --- REVERSIÓN ---
  // Devolvemos el objeto simple, como en el proyecto antiguo
  return { deudaID: deudaID, monto: datosDeuda.monto };
  // --- FIN REVERSIÓN ---
}

/** [MANTENIDA - LÓGICA MEJORADA] */
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

  // ¡EXCELENTE! Esta llamada automática es la mejor práctica.
  actualizarEstadoDeuda(datosPago.deudaID); 
  return { message: "Pago de deuda registrado y saldo actualizado con éxito." };
}

/** [MANTENIDA] */
function actualizarEstadoDeuda(deudaID) {
  const deudasSheet = SPREADSHEET.getSheetByName(SHEETS.DEUDAS_CLIENTES);
  const { headers: deudasHeaders, data: deudasData } = obtenerDatosHoja(SHEETS.DEUDAS_CLIENTES);
  const { headers: pagosHeaders, data: pagosData } = obtenerDatosHoja(SHEETS.PAGO_DEUDAS);
  
  const idxDeuda = { id: deudasHeaders.indexOf('DeudaID'), original: deudasHeaders.indexOf('MontoOriginal'), pagado: deudasHeaders.indexOf('MontoPagado'), saldo: deudasHeaders.indexOf('SaldoPendiente'), estado: deudasHeaders.indexOf('Estado') };
  const idxPago = { id: pagosHeaders.indexOf('DeudaID_Asociada'), monto: pagosHeaders.indexOf('Monto') };
  
  const filaIndex = deudasData.findIndex(row => row[idxDeuda.id] === deudaID);
  if (filaIndex === -1) return; // La deuda no se encontró

  const montoOriginal = Number(deudasData[filaIndex][idxDeuda.original]) || 0;
  
  // Recalcula el total pagado desde CERO, leyendo todos los pagos
  const totalPagado = pagosData
    .filter(pago => pago[idxPago.id] === deudaID)
    .reduce((sum, pago) => sum + (Number(pago[idxPago.monto]) || 0), 0);
  
  const nuevoSaldo = montoOriginal - totalPagado;
  const nuevoEstado = (nuevoSaldo <= 0.01) ? 'Pagada' : 'Pendiente';

  const filaAActualizar = filaIndex + 2; // +1 por índice 0, +1 por cabecera
  
  // Actualización optimizada (un solo .setValues() para múltiples columnas)
  const rango = deudasSheet.getRange(filaAActualizar, idxDeuda.pagado + 1, 1, 3);
  rango.setValues([[totalPagado, nuevoSaldo, nuevoEstado]]);
}

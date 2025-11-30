/**
 * Módulo: Gestión de Egresos y Gastos
 * Depende de: Constants.gs, Utils.gs
 * Integrado con: Movimientos de Caja
 */

/**
 * Registra un nuevo egreso en la base de datos y en el flujo de caja.
 * @param {object} datosEgreso - { monto, tipo, descripcion, sesionID, usuarioEmail }
 * @returns {object} Resultado de la operación { success, message, egresoID }
 */
function registrarNuevoEgreso(datosEgreso) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timezone = ss.getSpreadsheetTimeZone();
  
  // 1. Validaciones de Negocio
  if (!datosEgreso.monto || datosEgreso.monto <= 0) {
    throw new Error("El monto del egreso debe ser positivo.");
  }
  if (!datosEgreso.sesionID) {
    throw new Error("No hay una sesión de caja activa para registrar este egreso.");
  }
  if (!datosEgreso.tipo) {
    throw new Error("Debe seleccionar un tipo de egreso válido.");
  }

  const ahora = new Date();
  const fechaHora = Utilities.formatDate(ahora, timezone, "yyyy-MM-dd HH:mm:ss");
  
  // Generar ID único: EGR-FECHA-UUID
  const egresoID = `EGR-${Utilities.formatDate(ahora, timezone, "yyyyMMddHHmmss")}-${Utilities.getUuid().substring(0,5)}`;

  // 2. Registrar en la hoja específica de EGRESOS (Detalle)
  // Estructura sugerida: [ID, Fecha, Sesion, Usuario, Tipo, Descripcion, Monto]
  const egresosSheet = ss.getSheetByName(SHEETS.EGRESOS);
  egresosSheet.appendRow([
    egresoID, 
    fechaHora, 
    datosEgreso.sesionID, 
    datosEgreso.usuarioEmail,
    datosEgreso.tipo, 
    datosEgreso.descripcion || 'Sin descripción', 
    Number(datosEgreso.monto)
  ]);

  // 3. Registrar en MOVIMIENTOS_CAJA (Contabilidad)
  // Esto alimenta el reporte de "Cierre de Caja" automáticamente.
  const movimientosSheet = ss.getSheetByName(SHEETS.MOVIMIENTOS_CAJA);
  
  // Mapeo de tipos para consistencia en reportes
  // Si es "RETIRO", lo etiquetamos claramente para diferenciarlo de "GASTO"
  let tipoMovimiento = 'GASTO_OPERATIVO'; 
  if (datosEgreso.tipo === 'RETIRO_EFECTIVO') tipoMovimiento = 'RETIRO_CAJA';
  if (datosEgreso.tipo === 'COMPRA_MERCADERIA') tipoMovimiento = 'COMPRA_INVENTARIO';
  
  movimientosSheet.appendRow([
    `MOV-${egresoID}`,         // ID Movimiento
    datosEgreso.sesionID,      // Sesión
    fechaHora,                 // Fecha
    datosEgreso.usuarioEmail,  // Usuario
    tipoMovimiento,            // Tipo estandarizado
    `${datosEgreso.tipo}: ${datosEgreso.descripcion || ''}`, // Descripción combinada
    -Math.abs(datosEgreso.monto) // SIEMPRE NEGATIVO para restar de la caja
  ]);
  
  // Forzar escritura para asegurar consistencia inmediata
  SpreadsheetApp.flush();

  return {
    success: true,
    message: `Egreso de S/ ${Number(datosEgreso.monto).toFixed(2)} registrado correctamente.`,
    egresoID: egresoID
  };
}

/**
 * Obtiene el historial reciente de egresos para la sesión actual.
 * Útil para mostrar una tabla de "Gastos del Turno" en el frontend.
 */
function obtenerEgresosSesionActual(sesionID) {
  if (!sesionID) return [];
  
  const { headers, data } = obtenerDatosHoja(SHEETS.EGRESOS);
  const sesionIndex = headers.indexOf('SesionID');
  
  // Filtrar por sesión y devolver objetos limpios
  return data
    .filter(row => row[sesionIndex] === sesionID)
    .map(row => ({
        id: row[0],
        fecha: row[1] instanceof Date ? Utilities.formatDate(row[1], TIMEZONE, "HH:mm") : row[1],
        tipo: row[4],
        descripcion: row[5],
        monto: row[6]
    }))
    .reverse(); // Mostrar más recientes primero
}

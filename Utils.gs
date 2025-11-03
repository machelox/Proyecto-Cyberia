/**
 * Módulo de utilidades compartidas.
 */

/**
 * Función auxiliar para obtener datos de una hoja de cálculo de forma eficiente.
 * @param {string} sheetName El nombre de la hoja de la que se obtendrán los datos.
 * @returns {{headers: string[], data: any[][]}} Un objeto con los encabezados y los datos.
 */
function obtenerDatosHoja(sheetName) {
  const sheet = SPREADSHEET.getSheetByName(sheetName);
  if (!sheet) return { headers: [], data: [] };
  const allData = sheet.getDataRange().getValues();
  const headers = allData.shift() || [];
  return { headers, data: allData };
}

/**
 * Registra una acción en la hoja de Logs para auditoría y trazabilidad.
 * Sistema centralizado de registro de logs para todas las operaciones relevantes.
 * @param {string} accion Tipo de acción realizada (ej. 'LOGIN_FALLIDO', 'EMPLEADO_CREADO', 'VENTA_REGISTRADA', 'DEVOLUCION_PROCESADA').
 * @param {string|Object} detalle Puede ser un string con detalles o un objeto con información estructurada.
 * @param {string} [usuarioEmail] Email del usuario que realiza la acción (opcional, por defecto 'SISTEMA').
 * @returns {boolean} true si el log se registró correctamente, false en caso de error.
 */
function registrarLog(accion, detalle, usuarioEmail = 'SISTEMA') {
  try {
    let sheet = SPREADSHEET.getSheetByName(SHEETS.LOGS);
    
    // Crear hoja de logs si no existe
    if (!sheet) {
      sheet = SPREADSHEET.insertSheet(SHEETS.LOGS);
      // Crear encabezados si la hoja está vacía
      const headers = ['FechaHora', 'Accion', 'UsuarioEmail', 'Detalle', 'Nivel'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    // Formatear detalles (soporta string u objeto)
    let detalleFormateado = '';
    if (typeof detalle === 'string') {
      detalleFormateado = detalle;
    } else if (typeof detalle === 'object' && detalle !== null) {
      detalleFormateado = JSON.stringify(detalle);
    } else {
      detalleFormateado = String(detalle);
    }
    
    // Determinar nivel de log basado en el tipo de acción
    let nivel = 'INFO';
    if (accion.includes('ERROR') || accion.includes('FALLIDO') || accion.includes('CRITICO')) {
      nivel = 'ERROR';
    } else if (accion.includes('WARNING') || accion.includes('ADVERTENCIA')) {
      nivel = 'WARNING';
    }
    
    const fechaHora = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    
    // Optimización: Usar setValues en lugar de appendRow
    const nuevoLog = [
      fechaHora,
      accion,
      usuarioEmail || 'SISTEMA',
      detalleFormateado,
      nivel
    ];
    
    const ultimaFila = sheet.getLastRow();
    sheet.getRange(ultimaFila + 1, 1, 1, nuevoLog.length).setValues([nuevoLog]);
    
    // Limitar tamaño de logs (mantener últimos 10,000 registros)
    const maxLogs = 10000;
    if (ultimaFila + 1 > maxLogs) {
      sheet.deleteRows(2, ultimaFila + 1 - maxLogs);
    }
    
    return true;
  } catch (error) {
    // Si falla el registro de log, intentar registrar en la consola
    Logger.log(`Error al registrar log: ${error.toString()}`);
    return false;
  }
}

/**
 * Genera un hash de contraseña seguro con salt único por usuario.
 * @param {string} password La contraseña en texto plano.
 * @param {string} [salt] Salt opcional; si no se proporciona, se genera uno nuevo.
 * @returns {{hash: string, salt: string}} Objeto con el hash y el salt.
 */
function hashPassword(password, salt = Utilities.getUuid().substring(0, 16)) {
  let hash = password + salt;
  // Iterar 1000 veces para simular un algoritmo lento (mejorar resistencia a fuerza bruta)
  for (let i = 0; i < 1000; i++) {
    hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, hash)
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
      .join('');
  }
  return { hash, salt };
}

/**
 * Obtiene una lista de todos los roles únicos de la hoja 'Permisos'.
 * @returns {Array<string>} Lista de roles.
 */
function obtenerRolesUnicos() {
  const { headers, data } = obtenerDatosHoja(SHEETS.PERMISOS);
  if (!headers.length) {
    registrarLog('ROLES_ERROR', 'Hoja de permisos vacía o no encontrada', 'N/A');
    return [];
  }

  const rolIndex = headers.indexOf('Rol');
  if (rolIndex === -1) {
    registrarLog('ROLES_ERROR', 'Columna Rol no encontrada', 'N/A');
    return [];
  }

  const roles = new Set(data.map(row => row[rolIndex]).filter(Boolean));
  return Array.from(roles).sort();
}


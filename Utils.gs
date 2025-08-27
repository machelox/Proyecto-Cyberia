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
 * Registra una acción en la hoja de Logs para auditoría.
 * @param {string} tipoAccion Ej. 'LOGIN_FALLIDO', 'EMPLEADO_CREADO'.
 * @param {string} usuarioEmail Email del usuario que realiza la acción.
 * @param {string} detalles Detalles adicionales de la acción.
 */
function registrarLog(tipoAccion, usuarioEmail, detalles) {
  const sheet = SPREADSHEET.getSheetByName(SHEETS.LOGS) || SPREADSHEET.insertSheet(SHEETS.LOGS);
  const fechaHora = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([fechaHora, tipoAccion, usuarioEmail || 'N/A', detalles]);
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
    registrarLog('ROLES_ERROR', 'N/A', 'Hoja de permisos vacía o no encontrada');
    return [];
  }

  const rolIndex = headers.indexOf('Rol');
  if (rolIndex === -1) {
    registrarLog('ROLES_ERROR', 'N/A', 'Columna Rol no encontrada');
    return [];
  }

  const roles = new Set(data.map(row => row[rolIndex]).filter(Boolean));
  return Array.from(roles).sort();
}


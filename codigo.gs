/**
 * @OnlyCurrentDoc
 */

/**
 * Función principal que sirve la aplicación web. (Sin cambios)
 */
function doGet(e) {
  const params = e.parameter;
  if (params.action === 'reset') {
    const template = HtmlService.createTemplateFromFile('reset');
    return template.evaluate()
      .setTitle('Restablecer Contraseña - Cyberia Admin')
      .setFaviconUrl('https://i.postimg.cc/7LRGw3XG/Dise-o-sin-t-tulo-4.png')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }
  const template = HtmlService.createTemplateFromFile('index.html');
  return template.evaluate()
    .setTitle('Cyberia Admin')
    .setFaviconUrl('https://i.postimg.cc/7LRGw3XG/Dise-o-sin-t-tulo-4.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Incluye contenido de otros archivos HTML (css, js) en la plantilla principal. (Sin cambios)
 * @param {string} filename El nombre del archivo a incluir.
 * @returns {string} El contenido del archivo.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==================================================================
// CONFIGURACIÓN GLOBAL Y FUNCIONES DE SERVICIO
// ==================================================================

/**
 * Constantes globales para los nombres de las hojas.
 */
const SHEETS = {
  EMPLEADOS: 'Empleados',
  PERMISOS: 'Permisos',
  LOGS: 'Logs', // Nueva hoja para auditoría
  PRODUCTOS: 'Productos',
  CLIENTES: 'Clientes',
  VENTAS: 'Ventas',
  SALES_DETAILS: 'DetalleVentas',
  MOVIMIENTOS_INVENTARIO: 'MovimientosInventario',
  SESIONES_CAJA: 'SesionesCaja',
  MOVIMIENTOS_CAJA: 'MovimientosCaja',
  DEUDAS_CLIENTES: 'DeudasClientes',
  PAGOS: 'Pagos',
  EGRESOS: 'Egresos',
  PAGO_DEUDAS: 'PagoDeudas',
  RESUMENES_CIERRE: 'ResumenesCierre'
};

const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();
const TIMEZONE = SPREADSHEET.getSpreadsheetTimeZone();
const LOGIN_ATTEMPTS_LIMIT = 3; // Máximo de intentos de login
const LOGIN_LOCKOUT_MINUTES = 15; // Bloqueo temporal en minutos

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

// ==================================================================
// MÓDULO: AUTENTICACIÓN Y GESTIÓN DE EMPLEADOS
// ==================================================================

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
 * Valida las credenciales del usuario y verifica límites de intentos.
 * @param {string} email El email del usuario.
 * @param {string} password La contraseña en texto plano.
 * @returns {object|null} Datos del usuario con permisos, o null si falla.
 */
function iniciarSesion(email, password) {
  // Verificar límites de intentos
  const props = PropertiesService.getUserProperties();
  const intentosKey = `login_attempts_${email}`;
  const lockoutKey = `lockout_until_${email}`;
  const intentos = parseInt(props.getProperty(intentosKey) || '0', 10);
  const lockoutUntil = parseInt(props.getProperty(lockoutKey) || '0', 10);
  const now = new Date().getTime();

  if (lockoutUntil > now) {
    const minutosRestantes = Math.ceil((lockoutUntil - now) / 60000);
    registrarLog('LOGIN_BLOQUEADO', email, `Cuenta bloqueada por ${minutosRestantes} minutos`);
    throw new Error(`Cuenta bloqueada. Intenta de nuevo en ${minutosRestantes} minutos.`);
  }

  const { headers, data: empleados } = obtenerDatosHoja(SHEETS.EMPLEADOS);
  if (!empleados.length) {
    registrarLog('LOGIN_FALLIDO', email, 'Hoja de empleados vacía');
    throw new Error('No hay empleados registrados.');
  }

  const idx = {
    email: headers.indexOf('Email'),
    password: headers.indexOf('PasswordHash'),
    salt: headers.indexOf('Salt'),
    estado: headers.indexOf('Estado'),
    rol: headers.indexOf('Rol'),
    nombre: headers.indexOf('Nombre'),
    id: headers.indexOf('EmpleadoID')
  };

  const usuarioEncontrado = empleados.find(empleado => 
    empleado[idx.email] === email && empleado[idx.estado] === 'Activo'
  );

  if (!usuarioEncontrado) {
    props.setProperty(intentosKey, (intentos + 1).toString());
    if (intentos + 1 >= LOGIN_ATTEMPTS_LIMIT) {
      props.setProperty(lockoutKey, (now + LOGIN_LOCKOUT_MINUTES * 60 * 1000).toString());
      registrarLog('LOGIN_BLOQUEADO', email, 'Excedió intentos de login');
      throw new Error(`Demasiados intentos fallidos. Cuenta bloqueada por ${LOGIN_LOCKOUT_MINUTES} minutos.`);
    }
    registrarLog('LOGIN_FALLIDO', email, 'Usuario no encontrado o inactivo');
    throw new Error('Credenciales inválidas.');
  }

  const { hash } = hashPassword(password, usuarioEncontrado[idx.salt]);
  if (usuarioEncontrado[idx.password] !== hash) {
    props.setProperty(intentosKey, (intentos + 1).toString());
    if (intentos + 1 >= LOGIN_ATTEMPTS_LIMIT) {
      props.setProperty(lockoutKey, (now + LOGIN_LOCKOUT_MINUTES * 60 * 1000).toString());
      registrarLog('LOGIN_BLOQUEADO', email, 'Excedió intentos de login');
      throw new Error(`Demasiados intentos fallidos. Cuenta bloqueada por ${LOGIN_LOCKOUT_MINUTES} minutos.`);
    }
    registrarLog('LOGIN_FALLIDO', email, 'Contraseña incorrecta');
    throw new Error('Credenciales inválidas.');
  }

  // Resetear intentos al iniciar sesión correctamente
  props.deleteProperty(intentosKey);
  props.deleteProperty(lockoutKey);

  const rolUsuario = usuarioEncontrado[idx.rol];
  const { headers: pHeaders, data: pData } = obtenerDatosHoja(SHEETS.PERMISOS);
  const pIdx = {
    rol: pHeaders.indexOf('Rol'),
    modulo: pHeaders.indexOf('Modulo'),
    accion: pHeaders.indexOf('Accion'),
    permitido: pHeaders.indexOf('Permitido')
  };

  const permisos = {};
  pData
    .filter(permiso => permiso[pIdx.rol] === rolUsuario)
    .forEach(permiso => {
      const modulo = permiso[pIdx.modulo];
      const accion = permiso[pIdx.accion];
      const permitido = permiso[pIdx.permitido].toString().toUpperCase() === 'TRUE';
      if (!permisos[modulo]) permisos[modulo] = {};
      permisos[modulo][accion] = permitido;
    });

  // Validar que el rol tenga al menos un permiso
  if (Object.keys(permisos).length === 0) {
    registrarLog('LOGIN_FALLIDO', email, `Rol ${rolUsuario} sin permisos definidos`);
    throw new Error('El rol asignado no tiene permisos definidos.');
  }

  registrarLog('LOGIN_EXITOSO', email, `Usuario inició sesión`);
  return {
    empleadoId: usuarioEncontrado[idx.id],
    nombre: usuarioEncontrado[idx.nombre],
    email: usuarioEncontrado[idx.email],
    rol: rolUsuario,
    permisos
  };
}

/**
 * Envía un correo de restablecimiento de contraseña con un enlace temporal.
 * @param {string} email El email del usuario.
 * @returns {object} Resultado de la operación.
 */
function enviarResetPassword(email) {
  const { headers, data } = obtenerDatosHoja(SHEETS.EMPLEADOS);
  const idx = { email: headers.indexOf('Email'), id: headers.indexOf('EmpleadoID') };
  const usuario = data.find(row => row[idx.email] === email);
  if (!usuario) {
    registrarLog('RESET_PASSWORD_FALLIDO', email, 'Usuario no encontrado');
    throw new Error('Email no registrado.');
  }

  const token = Utilities.getUuid();
  const expiration = new Date().getTime() + 24 * 60 * 60 * 1000; // 24 horas
  PropertiesService.getScriptProperties().setProperty(`reset_token_${token}`, JSON.stringify({
    email,
    empleadoId: usuario[idx.id],
    expires: expiration
  }));

  const resetUrl = `${ScriptApp.getService().getUrl()}?action=reset&token=${token}`;
  const subject = 'Restablecer Contraseña - Cyberia Admin';
  const body = `
    Hola,
    Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace:
    ${resetUrl}
    Este enlace expira en 24 horas. Si no solicitaste esto, ignora este correo.
    Equipo Cyberia
  `;

  GmailApp.sendEmail(email, subject, body);
  registrarLog('RESET_PASSWORD_ENVIADO', email, `Enlace enviado: ${resetUrl}`);
  return { message: 'Correo de restablecimiento enviado.' };
}

/**
 * Procesa el restablecimiento de contraseña con un token.
 * @param {string} token El token de restablecimiento.
 * @param {string} newPassword Nueva contraseña.
 * @returns {object} Resultado de la operación.
 */
function procesarResetPassword(token, newPassword) {
  const props = PropertiesService.getScriptProperties();
  const tokenDataStr = props.getProperty(`reset_token_${token}`);
  if (!tokenDataStr) {
    registrarLog('RESET_PASSWORD_FALLIDO', 'N/A', 'Token inválido');
    throw new Error('Token inválido o expirado.');
  }

  const tokenData = JSON.parse(tokenDataStr);
  if (new Date().getTime() > tokenData.expires) {
    props.deleteProperty(`reset_token_${token}`);
    registrarLog('RESET_PASSWORD_FALLIDO', tokenData.email, 'Token expirado');
    throw new Error('El enlace de restablecimiento ha expirado.');
  }

  const { headers, data } = obtenerDatosHoja(SHEETS.EMPLEADOS);
  const idx = { id: headers.indexOf('EmpleadoID'), password: headers.indexOf('PasswordHash'), salt: headers.indexOf('Salt') };
  const filaIndex = data.findIndex(row => row[idx.id] === tokenData.empleadoId);
  if (filaIndex === -1) {
    registrarLog('RESET_PASSWORD_FALLIDO', tokenData.email, 'Empleado no encontrado');
    throw new Error('Usuario no encontrado.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    registrarLog('RESET_PASSWORD_FALLIDO', tokenData.email, 'No se pudo adquirir el lock');
    throw new Error('El sistema está ocupado. Intenta de nuevo.');
  }

  try {
    const { hash, salt } = hashPassword(newPassword);
    const sheet = SPREADSHEET.getSheetByName(SHEETS.EMPLEADOS);
    const fila = filaIndex + 2;
    sheet.getRange(fila, idx.password + 1).setValue(hash);
    sheet.getRange(fila, idx.salt + 1).setValue(salt);
    props.deleteProperty(`reset_token_${token}`);
    registrarLog('RESET_PASSWORD_EXITOSO', tokenData.email, 'Contraseña restablecida');
    return { message: 'Contraseña restablecida con éxito.' };
  } finally {
    lock.releaseLock();
  }
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

/**
 * Obtiene la lista completa de empleados para el panel de administración.
 * @returns {object[]} Lista de empleados.
 */
function obtenerEmpleados() {
  const { headers, data } = obtenerDatosHoja(SHEETS.EMPLEADOS);
  if (!data.length) return [];

  const idx = {
    id: headers.indexOf('EmpleadoID'),
    nombre: headers.indexOf('Nombre'),
    email: headers.indexOf('Email'),
    rol: headers.indexOf('Rol'),
    estado: headers.indexOf('Estado')
  };

  return data.map(row => ({
    empleadoId: row[idx.id],
    nombre: row[idx.nombre],
    email: row[idx.email],
    rol: row[idx.rol],
    estado: row[idx.estado]
  }));
}

/**
 * Obtiene todos los permisos para un rol específico.
 * @param {string} rol El nombre del rol.
 * @returns {Array<object>} Lista de permisos.
 */
function obtenerPermisosPorRol(rol) {
  const { headers, data } = obtenerDatosHoja(SHEETS.PERMISOS);
  if (!headers.length) return [];

  const idx = {
    rol: headers.indexOf('Rol'),
    modulo: headers.indexOf('Modulo'),
    accion: headers.indexOf('Accion'),
    permitido: headers.indexOf('Permitido')
  };

  return data
    .filter(row => row[idx.rol] === rol)
    .map(row => ({
      modulo: row[idx.modulo],
      accion: row[idx.accion],
      permitido: row[idx.permitido].toString().toUpperCase() === 'TRUE'
    }));
}

/**
 * Actualiza los permisos para un rol específico usando batch update.
 * @param {string} rol El rol a actualizar.
 * @param {Array<object>} nuevosPermisos Lista de permisos { modulo, accion, permitido }.
 * @returns {object} Resultado de la operación.
 */
function guardarPermisos(rol, nuevosPermisos) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    registrarLog('GUARDAR_PERMISOS_FALLIDO', 'N/A', `No se pudo adquirir el lock para rol ${rol}`);
    throw new Error('El sistema está ocupado. Intenta de nuevo.');
  }

  try {
    const sheet = SPREADSHEET.getSheetByName(SHEETS.PERMISOS);
    const { headers, data } = obtenerDatosHoja(SHEETS.PERMISOS);
    const idx = {
      rol: headers.indexOf('Rol'),
      modulo: headers.indexOf('Modulo'),
      accion: headers.indexOf('Accion'),
      permitido: headers.indexOf('Permitido')
    };

    const nuevosPermisosMap = {};
    nuevosPermisos.forEach(p => {
      if (!nuevosPermisosMap[p.modulo]) nuevosPermisosMap[p.modulo] = {};
      nuevosPermisosMap[p.modulo][p.accion] = p.permitido;
    });

    // Preparar datos para batch update
    const filasActualizadas = data.map((row, index) => {
      if (row[idx.rol] !== rol) return row;
      const modulo = row[idx.modulo];
      const accion = row[idx.accion];
      if (nuevosPermisosMap[modulo] && nuevosPermisosMap[modulo][accion] !== undefined) {
        row[idx.permitido] = nuevosPermisosMap[modulo][accion];
      }
      return row;
    });

    // Escribir todas las filas de una vez
    sheet.getRange(2, 1, filasActualizadas.length, headers.length).setValues(filasActualizadas);
    registrarLog('GUARDAR_PERMISOS_EXITOSO', 'N/A', `Permisos actualizados para rol ${rol}`);
    return { message: `Permisos del rol '${rol}' guardados correctamente.` };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Gestiona las operaciones CRUD para empleados.
 * @param {object} empleadoData Datos del empleado.
 * @param {string} accion Operación ('CREAR', 'EDITAR', 'DESACTIVAR').
 * @returns {object} Resultado de la operación.
 */
function gestionarEmpleado(empleadoData, accion) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    registrarLog('GESTIONAR_EMPLEADO_FALLIDO', empleadoData.email, `No se pudo adquirir el lock para acción ${accion}`);
    throw new Error('El sistema está ocupado. Intenta de nuevo.');
  }

  try {
    const sheet = SPREADSHEET.getSheetByName(SHEETS.EMPLEADOS);
    const { headers, data } = obtenerDatosHoja(SHEETS.EMPLEADOS);
    const roles = obtenerRolesUnicos();

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(empleadoData.email)) {
      registrarLog('GESTIONAR_EMPLEADO_FALLIDO', empleadoData.email, 'Email inválido');
      throw new Error('Email inválido.');
    }

    // Validar rol
    if (accion !== 'DESACTIVAR' && !roles.includes(empleadoData.rol)) {
      registrarLog('GESTIONAR_EMPLEADO_FALLIDO', empleadoData.email, `Rol ${empleadoData.rol} no existe`);
      throw new Error(`El rol '${empleadoData.rol}' no existe.`);
    }

    switch (accion.toUpperCase()) {
      case 'CREAR': {
        const emailIndex = headers.indexOf('Email');
        const emailExistente = data.some(row => row[emailIndex] === empleadoData.email);
        if (emailExistente) {
          registrarLog('CREAR_EMPLEADO_FALLIDO', empleadoData.email, 'Email ya registrado');
          throw new Error(`El email '${empleadoData.email}' ya está registrado.`);
        }

        const { hash, salt } = hashPassword(empleadoData.password);
        const nuevoId = `EMP-${String(sheet.getLastRow()).padStart(3, '0')}`;
        sheet.appendRow([
          nuevoId,
          empleadoData.nombre,
          empleadoData.email,
          empleadoData.rol,
          hash,
          salt,
          'Activo'
        ]);
        registrarLog('CREAR_EMPLEADO_EXITOSO', empleadoData.email, `Empleado creado: ${nuevoId}`);
        return { status: 'ok', message: `Empleado '${empleadoData.nombre}' creado con éxito.` };
      }

      case 'EDITAR': {
        const idIndex = headers.indexOf('EmpleadoID');
        const filaIndex = data.findIndex(row => row[idIndex] === empleadoData.empleadoId);
        if (filaIndex === -1) {
          registrarLog('EDITAR_EMPLEADO_FALLIDO', empleadoData.email, 'Empleado no encontrado');
          throw new Error('No se encontró el empleado para editar.');
        }

        const fila = filaIndex + 2;
        sheet.getRange(fila, headers.indexOf('Nombre') + 1).setValue(empleadoData.nombre);
        sheet.getRange(fila, headers.indexOf('Rol') + 1).setValue(empleadoData.rol);
        if (empleadoData.password) {
          const { hash, salt } = hashPassword(empleadoData.password);
          sheet.getRange(fila, headers.indexOf('PasswordHash') + 1).setValue(hash);
          sheet.getRange(fila, headers.indexOf('Salt') + 1).setValue(salt);
        }
        registrarLog('EDITAR_EMPLEADO_EXITOSO', empleadoData.email, `Empleado editado: ${empleadoData.empleadoId}`);
        return { status: 'ok', message: 'Empleado actualizado correctamente.' };
      }

      case 'DESACTIVAR': {
        const idIndex = headers.indexOf('EmpleadoID');
        const filaIndex = data.findIndex(row => row[idIndex] === empleadoData.empleadoId);
        if (filaIndex === -1) {
          registrarLog('DESACTIVAR_EMPLEADO_FALLIDO', empleadoData.email, 'Empleado no encontrado');
          throw new Error('No se encontró el empleado para desactivar.');
        }

        const fila = filaIndex + 2;
        sheet.getRange(fila, headers.indexOf('Estado') + 1).setValue('Inactivo');
        registrarLog('DESACTIVAR_EMPLEADO_EXITOSO', empleadoData.email, `Empleado desactivado: ${empleadoData.empleadoId}`);
        return { status: 'ok', message: 'Empleado desactivado correctamente.' };
      }

      default:
        registrarLog('GESTIONAR_EMPLEADO_FALLIDO', empleadoData.email, `Acción desconocida: ${accion}`);
        throw new Error('Acción no válida.');
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * FUNCIÓN TEMPORAL PARA GENERAR UN HASH DE CONTRASEÑA (para pruebas).
 */
function generarHashParaTest(password) {
  const { hash, salt } = hashPassword(password);
  Logger.log(`Hash: ${hash}\nSalt: ${salt}`);
}

function generarNuevaClave() {
  generarHashParaTest("1234"); // <- Aquí pones tu nueva clave
}

// ==================================================================
// FIN DEL MÓDULO
// ==================================================================

// ==================================================================
// INICIO DEL MÓDULO: FLUJO DE CAJA (SESIONES Y CIERRE)
// ==================================================================

/**
 * Revisa la hoja 'SesionesCaja' y devuelve la sesión que esté en estado "Abierta".
 * Sanitiza las fechas antes de devolver el objeto para evitar errores de comunicación.
 * @returns {object|null} El objeto de la sesión abierta o null.
 */
function obtenerEstadoCajaActual() {
  const { headers, data } = obtenerDatosHoja(SHEETS.SESIONES_CAJA);
  if (!headers.length || data.length === 0) return null;

  const estadoIndex = headers.indexOf('Estado');
  const sesionAbiertaRow = data.find(row => row[estadoIndex] === 'Abierta');

  if (sesionAbiertaRow) {
    const sesionAbiertaObj = {};
    headers.forEach((header, i) => {
      const value = sesionAbiertaRow[i];
      // Si es una fecha, la convertimos a texto seguro para el frontend.
      if (value instanceof Date) {
        sesionAbiertaObj[header] = Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd");
      } else {
        sesionAbiertaObj[header] = value;
      }
    });
    return sesionAbiertaObj;
  }

  return null;
}

/**
 * Inicia una nueva sesión de caja con un monto de apertura.
 * @param {number} montoApertura - El monto en efectivo con el que se inicia la caja.
 * @param {string} emailUsuario - El email del usuario que está abriendo la caja.
 * @returns {object} El objeto de la nueva sesión creada.
 */
function iniciarNuevaSesion(montoApertura, emailUsuario) {
  const sesionActual = obtenerEstadoCajaActual();
  if (sesionActual) {
    throw new Error("Ya existe una sesión de caja abierta. Ciérrala antes de iniciar una nueva.");
  }

  const sesionesSheet = SPREADSHEET.getSheetByName(SHEETS.SESIONES_CAJA);
  const ahora = new Date();
  
  const sesionID = `CAJA-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMdd")}-${sesionesSheet.getLastRow() + 1}`;
  const fecha = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd");
  const hora = Utilities.formatDate(ahora, TIMEZONE, "HH:mm:ss");

  const nuevaSesion = {
    SesionID: sesionID,
    Estado: "Abierta",
    FechaApertura: fecha,
    HoraApertura: hora,
    UsuarioAperturaEmail: emailUsuario,
    MontoApertura: montoApertura,
    FechaCierre: '',
    HoraCierre: '',
    UsuarioCierreEmail: '',
    TotalVentas: '',
    TotalEfectivoCalculado: '',
    MontoCierreReal: '',
    Diferencia: '',
    Notas: ''
  };

  const headers = sesionesSheet.getRange(1, 1, 1, sesionesSheet.getLastColumn()).getValues()[0];
  const nuevaFila = headers.map(header => nuevaSesion[header] !== undefined ? nuevaSesion[header] : '');
  
  sesionesSheet.appendRow(nuevaFila);

  return nuevaSesion;
}


/**
 * Obtiene un resumen detallado para el cierre de caja, usando la hoja MovimientosCaja.
 * @param {string} sesionID - El ID de la sesión que se está cerrando.
 * @returns {object} Un objeto con todos los totales calculados para el cierre.
 */
function obtenerResumenParaCierre(sesionID) {
  const { data: movData, headers: movHeaders } = obtenerDatosHoja(SHEETS.MOVIMIENTOS_CAJA);
  const { data: ventasData, headers: ventasHeaders } = obtenerDatosHoja(SHEETS.VENTAS);
  const { data: deudasData, headers: deudasHeaders } = obtenerDatosHoja(SHEETS.DEUDAS_CLIENTES);
  const { data: detalleVentasData, headers: detalleVentasHeaders } = obtenerDatosHoja(SHEETS.SALES_DETAILS);

  // Filtrar movimientos y ventas por la sesión actual
  const movSesion = movData.filter(row => row[movHeaders.indexOf('SesionID')] === sesionID);
  const ventasSesion = ventasData.filter(row => row[ventasHeaders.indexOf('SesionID')] === sesionID);
  
  // Inicializar totales
  let totalPagosDeudaEfectivo = 0, totalVentasYapePlin = 0, totalGastos = 0;

  movSesion.forEach(mov => {
    const tipo = mov[movHeaders.indexOf('TipoMovimiento')];
    const monto = Number(mov[movHeaders.indexOf('Monto')]) || 0;
    
    // Sumar ingresos
    if (tipo === 'PAGO_DEUDA_EFECTIVO') totalPagosDeudaEfectivo += monto;
    if (tipo === 'PAGO_DEUDA_YAPE_PLIN' || tipo === 'VENTA_YAPE_PLIN' || tipo === 'PAGO_CLIENTE_YAPE_PLIN') totalVentasYapePlin += monto;
    
    // Sumar egresos (los montos ya son negativos en MovimientosCaja)
    if (monto < 0 && tipo !== 'CREDITO_OTORGADO') { // Excluimos los créditos otorgados de los gastos
        totalGastos += monto;
    }
  });

  // Calcular deudas nuevas creadas en esta sesión
  const totalDeudasNuevas = deudasData
    .filter(row => row[deudasHeaders.indexOf('SesionID_Origen')] === sesionID)
    .reduce((sum, row) => sum + (Number(row[deudasHeaders.indexOf('MontoOriginal')]) || 0), 0);
  
  // Calcular la cantidad total de productos vendidos en la app
  const ventaIDsDeSesion = new Set(ventasSesion.map(v => v[ventasHeaders.indexOf('VentaID')]));
  const qProductosVendidos = detalleVentasData
    .filter(detalle => ventaIDsDeSesion.has(detalle[detalleVentasHeaders.indexOf('VentaID')]))
    .reduce((sum, detalle) => sum + (Number(detalle[detalleVentasHeaders.indexOf('Cantidad')]) || 0), 0);

  const totalVentasApp = ventasSesion.reduce((sum, row) => sum + (Number(row[ventasHeaders.indexOf('TotalVenta')]) || 0), 0);

  return {
    totalVentasApp,
    qVentas: qProductosVendidos,
    totalPagosDeudaEfectivo,
    totalVentasYapePlin,
    totalDeudasNuevas,
    totalGastos: Math.abs(totalGastos) // Devolvemos como valor positivo
  };
}


/**
 * Guarda los datos finales del cierre, aplica la fórmula de Efectivo Esperado,
 * y actualiza la sesión a 'Cerrada'.
 * @param {object} datosCierre - Objeto con { sesionID, montoCyberplanet, montoReal, emailUsuario, notas }.
 * @returns {object} Un objeto con el resumen final del cierre.
 */
function finalizarCierreCaja(datosCierre) {
  const { sesionID, montoCyberplanet, montoReal, emailUsuario, notas } = datosCierre;

  // 1. Para máxima seguridad, recalculamos el resumen en el servidor
  const resumen = obtenerResumenParaCierre(sesionID);
  const { totalPagosDeudaEfectivo, totalYapePlin, totalDeudasNuevas, totalGastos, totalVentasApp, qVentas } = resumen;

  // 2. Aplicamos la fórmula crítica de negocio
  const efectivoEsperado = Number(montoCyberplanet) + totalPagosDeudaEfectivo - totalYapePlin - totalDeudasNuevas - totalGastos;
  const diferencia = Number(montoReal) - efectivoEsperado;

  const ss = SPREADSHEET;
  const ahora = new Date();
  
  // 3. Obtener el monto de apertura de la sesión original
  const { data: sesionData, headers: sesionHeaders } = obtenerDatosHoja(SHEETS.SESIONES_CAJA);
  const sesionActualRow = sesionData.find(row => row[sesionHeaders.indexOf('SesionID')] === sesionID);
  const montoApertura = Number(sesionActualRow[sesionHeaders.indexOf('MontoApertura')]) || 0;

  // 4. Guardar el registro en la hoja 'ResumenesCierre'
  const resumenesSheet = ss.getSheetByName(SHEETS.RESUMENES_CIERRE);
  const fechaCierre = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd");
  
  resumenesSheet.appendRow([
    sesionID, fechaCierre, emailUsuario, montoApertura, montoCyberplanet, totalVentasApp,
    totalPagosDeudaEfectivo, totalYapePlin, totalDeudasNuevas, totalGastos,
    efectivoEsperado, montoReal, diferencia, qVentas
  ]);

  // 5. --- INICIO DE LA LÓGICA AÑADIDA ---
  // Actualizar el estado de la sesión en la hoja 'SesionesCaja'
  const sesionesSheet = ss.getSheetByName(SHEETS.SESIONES_CAJA);
  const sesionIdIndex = sesionHeaders.indexOf('SesionID');
  const filaIndex = sesionData.findIndex(row => row[sesionIdIndex] === sesionID);
  
  if (filaIndex !== -1) {
      const filaAActualizar = filaIndex + 2; // +1 por el header, +1 por base 1
      const horaCierre = Utilities.formatDate(ahora, TIMEZONE, "HH:mm:ss");

      // Actualizamos los campos correspondientes a la fila de la sesión
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('Estado') + 1).setValue('Cerrada');
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('FechaCierre') + 1).setValue(fechaCierre);
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('HoraCierre') + 1).setValue(horaCierre);
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('UsuarioCierreEmail') + 1).setValue(emailUsuario);
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('TotalVentas') + 1).setValue(totalVentasApp);
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('TotalEfectivoCalculado') + 1).setValue(efectivoEsperado);
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('MontoCierreReal') + 1).setValue(montoReal);
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('Diferencia') + 1).setValue(diferencia);
      sesionesSheet.getRange(filaAActualizar, sesionHeaders.indexOf('Notas') + 1).setValue(notas || '');
  }
  // --- FIN DE LA LÓGICA AÑADIDA ---

  // Devolvemos el resultado completo para mostrarlo en el frontend
  return { ...resumen, montoCyberplanet, efectivoEsperado, montoReal, diferencia };
}
// ==================================================================
// FIN DEL MÓDULO
// ==================================================================

// ==================================================================
// INICIO DEL MÓDULO: VENTAS Y PAGOS
// ==================================================================

/**
 * Registra una orden de venta de productos, descuenta stock y la deja en estado 'Pendiente'.
 * @param {object} ordenData - Objeto con { carrito, cliente, sesionID, usuarioEmail, pc }.
 * @returns {object} Un objeto confirmando el ID y total de la venta registrada.
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

  // procesarVenta(carritoValidado.map(item => ({ sku: item.sku, cantidad: item.cantidad })), ordenData.usuarioEmail);
  
  // --- LÍNEA AÑADIDA ---
  // Fuerza a la hoja de cálculo a aplicar todos los cambios pendientes inmediatamente.
  SpreadsheetApp.flush();

  return { ventaID: ventaID, total: totalVentaCalculado };
}



/**
 * Procesa un pago consolidado (PC + Productos), registra el movimiento de caja y
 * genera una deuda si el pago es parcial.
 * @param {object} pagoData - Objeto con los detalles del pago.
 * { cliente, totalACobrar, montoPagado, metodoPago, descripcion, sesionID, usuarioEmail }
 * @returns {object} Un mensaje de confirmación del resultado.
 */
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
    
    // Reutilizamos la función del módulo de deudas para crear el crédito
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

/**
 * Función auxiliar que busca todas las ventas en estado 'Pendiente' de una sesión y actualiza su estado.
 * @param {string} sesionID El ID de la sesión a procesar.
 * @param {string} nuevoEstado El nuevo estado, ej. 'Pagada' o 'Cancelada'.
 */
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

/**
 * Gestiona las acciones de una orden de venta, como confirmar o cancelar.
 * Esta función centraliza la lógica de cambio de estado y devolución de stock.
 * @param {string} ventaID - El ID de la venta a gestionar.
 * @param {string} accion - La acción a realizar ('CONFIRMAR' o 'CANCELAR').
 * @returns {string} Un mensaje de confirmación del resultado.
 */
function gestionarOrdenVenta(ventaID, accion) {
  Logger.log(`Recibida solicitud para ${accion} la VentaID: ${ventaID}`);
  const ss = SPREADSHEET;
  const ventasSheet = ss.getSheetByName(SHEETS.VENTAS);
  const { headers: ventasHeaders, data: ventasData } = obtenerDatosHoja(SHEETS.VENTAS);
  
  const idxVenta = {
    ventaId: ventasHeaders.indexOf('VentaID'),
    estado: ventasHeaders.indexOf('EstadoPago')
  };
  // **Corrección:** Recortar espacios del ventaID antes de buscar.
  const idVentaRecortado = String(ventaID).trim(); 
  // **Corrección:** Recortar espacios en la comparación.
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

      // 1. Obtener los detalles de la venta antes de procesar
      const detalles = obtenerDetallesDeVenta(ventaID);
      const itemsVenta = detalles.map(item => ({
          sku: item.SKU,
          cantidad: item.Cantidad,
          nombre: item.ProductoNombre
      }));

      // 2. Descontar el stock del inventario
      procesarVenta(itemsVenta, ventasData[filaVentaIndex][ventasHeaders.indexOf('UsuarioEmail')]);

      // 3. Cambiar el estado de la venta
      ventasSheet.getRange(filaAActualizar, idxVenta.estado + 1).setValue('Confirmado');
      SpreadsheetApp.flush();
      return `Venta ${ventaID} confirmada y stock descontado con éxito.`;

    case 'CANCELAR':
      if (estadoActual === 'Cancelada') {
        throw new Error("Error: Esta venta ya ha sido cancelada.");
      }
      
      // Cambiar estado a 'Cancelada'
      ventasSheet.getRange(filaAActualizar, idxVenta.estado + 1).setValue('Cancelada');
      SpreadsheetApp.flush();
      // Devolver el stock al inventario solo si la venta estaba 'Pendiente'
      if (estadoActual === 'Pendiente') {
          const detalles = obtenerDatosHoja(SHEETS.SALES_DETAILS).data;
          const idxDetalle = { 
              ventaId: obtenerDatosHoja(SHEETS.SALES_DETAILS).headers.indexOf('VentaID'), 
              sku: obtenerDatosHoja(SHEETS.SALES_DETAILS).headers.indexOf('SKU'), 
              cantidad: obtenerDatosHoja(SHEETS.SALES_DETAILS).headers.indexOf('Cantidad') 
          };
          
          const itemsDevueltos = detalles
            .filter(row => row[idxDetalle.ventaId] === ventaID)
            .map(row => ({ sku: row[idxDetalle.sku], cantidad: row[idxDetalle.cantidad] }));

          for (const item of itemsDevueltos) {
              registrarMovimientoInventario({
                  sku: item.sku,
                  tipo: 'DEVOLUCION_CANCELACION',
                  cantidad: Math.abs(item.cantidad), // La cantidad es positiva para devolver al stock
                  notas: `Devolución por cancelación de Venta ${ventaID}`,
                  emailUsuario: 'SISTEMA' // O podrías pasar el email del usuario actual
              });
          }
          return `Venta ${ventaID} cancelada y stock devuelto.`;
      }
      return `Venta ${ventaID} marcada como cancelada. El stock no se modificó porque la venta no estaba 'Pendiente'.`;
    
    default:
      throw new Error("Acción no reconocida.");
  }
}

/**
 * Obtiene todas las ventas y sus detalles.
 * @returns {Array} Un array de objetos de venta, cada uno con sus detalles.
 */
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

/**
 * Obtiene los productos detallados de una única venta.
 * @param {string} ventaID - El ID de la venta a buscar.
 * @returns {Array<object>} Un array con los productos de esa venta.
 */
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

// ==================================================================
// FIN DEL MÓDULO
// ==================================================================

// ==================================================================
// MÓDULO DE GESTIÓN DE CLIENTES
// ==================================================================

/**
 * Obtiene la lista de clientes para usar en los menús desplegables.
 * @returns {object[]} Un array de objetos de clientes.
 */
function obtenerClientes() {
  const { headers, data } = obtenerDatosHoja(SHEETS.CLIENTES);
  if (!headers.length) return [];

  // Corregido para coincidir con los nombres de columna de tu hoja
  const idx = {
    dni: headers.indexOf('DNI'),
    nombres: headers.indexOf('Nombres'),
    alias: headers.indexOf('Alias')
  };

  return data
    .filter(row => row[idx.dni] && row[idx.nombres]) // Filtrar filas sin datos básicos
    .map(row => {
      const alias = row[idx.alias] || '';
      const nombre = row[idx.nombres];
      const dni = row[idx.dni];
      
      // Formatear el texto como solicitaste: "Alias - Nombres (DNI)"
      const texto = alias ? `${alias} - ${nombre} (${dni})` : `${nombre} (${dni})`;

      return {
        dni: dni,
        texto: texto // Devolvemos el texto ya formateado para el frontend
      };
    });
}

/**
 * Registra un nuevo cliente en la hoja de cálculo en el orden correcto.
 * @param {object} cliente - El objeto del cliente con sus datos.
 * @returns {object} El objeto del cliente registrado para confirmación.
 */
function registrarNuevoCliente(cliente) {
  const hoja = SPREADSHEET.getSheetByName(SHEETS.CLIENTES);
  
  // Generamos un ID simple basado en el número de filas.
  const nuevoId = hoja.getLastRow();

  // La fila AHORA coincide con el orden exacto de tus columnas:
  // A: ID, B: DNI, C: Nombres, D: Email, E: Alias, F: Celular
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


// ==================================================================
// FIN DEL MÓDULO
// ==================================================================

// ==================================================================
// INICIO DEL MÓDULO: GESTIÓN DE INVENTARIO
// ==================================================================
/**
 * Obtiene la lista completa de productos del inventario para la gestión.
 * @returns {Array} Un array de objetos, donde cada objeto es un producto.
 */
function obtenerInventarioCompleto() {
  const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  if (!headers.length) return [];

  return data.map(row => {
    const producto = {};
    headers.forEach((header, i) => {
      let value = row[i];
      if (header === 'FechaIngreso' && value instanceof Date) {
        producto[header] = Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
      } else {
        producto[header] = value;
      }
    });
    return producto;
  });
}


/**
 * Obtiene todos los productos activos para mostrarlos en la galería de ventas.
 * @returns {object[]} Un array de objetos de productos.
 */
function obtenerProductosActivos() {
  const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  if (!headers.length) return [];

  const idx = {
    estado: headers.indexOf('Estado'),
    sku: headers.indexOf('SKU'),
    codigoBarras: headers.indexOf('CodigoBarras'),
    nombre: headers.indexOf('Nombre'),
    categoria: headers.indexOf('Categoria'),
    precioVenta: headers.indexOf('PrecioVenta'),
    imagenURL: headers.indexOf('ImagenURL'),
    stock: headers.indexOf('Stock')
  };

  return data
    .filter(row => row[idx.estado] === 'Activo' && Number(row[idx.stock]) > 0)
    .map(row => ({
      sku: row[idx.sku],
      codigo: row[idx.codigoBarras],
      nombre: row[idx.nombre],
      categoria: row[idx.categoria],
      precioVenta: parseFloat(row[idx.precioVenta]) || 0,
      imagen: row[idx.imagenURL]
    }));
}


/**
 * Agrega un nuevo producto a la hoja de Productos.
 * @param {object} producto - El objeto del producto a añadir.
 * @returns {object} El producto añadido para confirmación.
 */
function agregarProductoNuevo(producto) {
  const productosSheet = SPREADSHEET.getSheetByName(SHEETS.PRODUCTOS);
  
  const { data, headers } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  const skuIndex = headers.indexOf('SKU');
  if (data.some(row => row[skuIndex] === producto.SKU)) {
    throw new Error(`El SKU '${producto.SKU}' ya existe. Por favor, use uno diferente.`);
  }

  const nuevaFila = [
    producto.SKU, producto.Nombre, producto.CodigoBarras || '', producto.Categoria,
    producto.Stock || 0, producto.StockMinimo || 5, producto.PrecioCosto || 0,
    producto.PrecioVenta, 'Activo', Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
    producto.ImagenURL || ''
  ];
  productosSheet.appendRow(nuevaFila);
  return producto;
}

/**
 * Gestiona la edición y desactivación de un producto existente.
 * @param {object} productoData - Los datos del producto a modificar.
 * @param {string} accion - La operación: 'EDITAR' o 'DESACTIVAR'.
 * @returns {object} Un mensaje de confirmación.
 */
function gestionarProducto(productoData, accion) {
    const productosSheet = SPREADSHEET.getSheetByName(SHEETS.PRODUCTOS);
    const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);
    const skuIndex = headers.indexOf('SKU');
    const filaIndex = data.findIndex(row => row[skuIndex] === productoData.SKU);

    if (filaIndex === -1) {
        throw new Error(`Producto con SKU ${productoData.SKU} no encontrado.`);
    }

    const filaAActualizar = filaIndex + 2;

    if (accion.toUpperCase() === 'EDITAR') {
        productosSheet.getRange(filaAActualizar, headers.indexOf('Nombre') + 1).setValue(productoData.Nombre);
        productosSheet.getRange(filaAActualizar, headers.indexOf('CodigoBarras') + 1).setValue(productoData.CodigoBarras);
        productosSheet.getRange(filaAActualizar, headers.indexOf('Categoria') + 1).setValue(productoData.Categoria);
        productosSheet.getRange(filaAActualizar, headers.indexOf('StockMinimo') + 1).setValue(productoData.StockMinimo);
        productosSheet.getRange(filaAActualizar, headers.indexOf('PrecioCosto') + 1).setValue(productoData.PrecioCosto);
        productosSheet.getRange(filaAActualizar, headers.indexOf('PrecioVenta') + 1).setValue(productoData.PrecioVenta);
        productosSheet.getRange(filaAActualizar, headers.indexOf('ImagenURL') + 1).setValue(productoData.ImagenURL);
        return { status: 'ok', message: 'Producto actualizado correctamente.' };
    } else if (accion.toUpperCase() === 'DESACTIVAR') {
        productosSheet.getRange(filaAActualizar, headers.indexOf('Estado') + 1).setValue('Inactivo');
        return { status: 'ok', message: 'Producto desactivado.' };
    } else {
        throw new Error('Acción no reconocida para gestionar producto.');
    }
}

/**
 * Procesa una venta, llamando a registrarMovimientoInventario para cada producto.
 * @param {Array<object>} itemsVenta - Un array de productos con {sku, cantidad, nombre}.
 * @param {string} emailUsuario - El email del usuario que realiza la venta.
 * @returns {string} Un mensaje de éxito.
 */
function procesarVenta(itemsVenta, emailUsuario = 'SISTEMA') {
  for (const item of itemsVenta) {
    const movimiento = {
      sku: item.sku, tipo: 'VENTA',
      cantidad: -Math.abs(item.cantidad),
      notas: `Venta automática del producto ${item.nombre}`,
      emailUsuario: emailUsuario
    };
    registrarMovimientoInventario(movimiento);
  }
  return 'Stock actualizado y movimientos registrados correctamente.';
}


/**
 * Función central para añadir o quitar stock.
 * @param {object} movimiento - Un objeto con { sku, tipo, cantidad, notas, emailUsuario }.
 * @returns {string} Un mensaje de confirmación.
 */
function registrarMovimientoInventario(movimiento) {
  const productosSheet = SPREADSHEET.getSheetByName(SHEETS.PRODUCTOS);
  const movimientosSheet = SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_INVENTARIO);
  const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);

  const idx = { sku: headers.indexOf('SKU'), stock: headers.indexOf('Stock'), nombre: headers.indexOf('Nombre') };
  const productoIndex = data.findIndex(row => row[idx.sku] === movimiento.sku);

  if (productoIndex === -1) throw new Error(`El producto con SKU ${movimiento.sku} no fue encontrado.`);
  
  const stockActual = Number(data[productoIndex][idx.stock]);
  const nuevoStock = stockActual + movimiento.cantidad;
  productosSheet.getRange(productoIndex + 2, idx.stock + 1).setValue(nuevoStock);

  const ahora = new Date();
  const productoNombre = data[productoIndex][idx.nombre];
  const movimientoID = `MOV-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}-${Utilities.getUuid().substring(0, 5)}`;
  
  movimientosSheet.appendRow([
    movimientoID, Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
    movimiento.sku, productoNombre, movimiento.tipo, movimiento.cantidad,
    movimiento.emailUsuario, movimiento.notas || ''
  ]);
  
  return "Movimiento registrado y stock actualizado.";
}


/**
 * Obtiene el historial de movimientos de un producto específico.
 * @param {string} sku - El SKU del producto a buscar.
 * @returns {Array} Un array con todos los movimientos del producto.
 */
function obtenerHistorialProducto(sku) {
  const { headers, data } = obtenerDatosHoja(SHEETS.MOVIMIENTOS_INVENTARIO);
  const skuIndex = headers.indexOf('SKU');
  
  const historial = data
    .filter(row => String(row[skuIndex]).trim() === sku)
    .map(row => {
      const movimiento = {};
      headers.forEach((h, i) => {
        movimiento[h] = row[i] instanceof Date ? Utilities.formatDate(row[i], TIMEZONE, "yyyy-MM-dd HH:mm:ss") : row[i];
      });
      return movimiento;
    });
    
  historial.sort((a,b) => new Date(b.FechaHora) - new Date(a.FechaHora));
  return historial;
}


/**
 * Busca un producto por su código de barras.
 * @param {string} codigo El código de barras a buscar.
 * @returns {object|null} El objeto del producto o null si no se encuentra.
 */
function buscarProductoPorCodigoBarras(codigo) {
  const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  if (!headers.length) return null;

  const idx = {
    codigoBarras: headers.indexOf('CodigoBarras'), estado: headers.indexOf('Estado'),
    sku: headers.indexOf('SKU'), nombre: headers.indexOf('Nombre'),
    precioVenta: headers.indexOf('PrecioVenta'), stock: headers.indexOf('Stock')
  };

  const p = data.find(row => String(row[idx.codigoBarras]) === String(codigo) && row[idx.estado] === 'Activo');

  return p ? {
    SKU: p[idx.sku], Nombre: p[idx.nombre],
    PrecioVenta: parseFloat(p[idx.precioVenta]) || 0,
    Stock: parseInt(p[idx.stock]) || 0,
  } : null;
}

/**
 * Devuelve una lista de todas las categorías de productos únicas y ordenadas.
 * @returns {Array<string>} Un array de strings con los nombres de las categorías.
 */
function obtenerCategoriasUnicas() {
  const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  const categoriaIndex = headers.indexOf('Categoria');
  if (categoriaIndex === -1) return [];
  const categorias = new Set(data.map(row => row[categoriaIndex]).filter(Boolean));
  return Array.from(categorias).sort();
}

/**
 * Lee la hoja 'Importar', la valida y devuelve una previsualización.
 * @returns {object} Un objeto con { productosValidos: [], errores: [] }.
 */
function previsualizarImportacion() {
  const importSheet = SPREADSHEET.getSheetByName('Importar');
  if (!importSheet) throw new Error("No se encontró la hoja 'Importar'.");
  
  const datos = importSheet.getDataRange().getValues();
  const encabezados = datos.shift();
  const idx = {
    sku: encabezados.indexOf('SKU'),
    nombre: encabezados.indexOf('Nombre'),
    precioVenta: encabezados.indexOf('PrecioVenta')
  };

  if (idx.sku === -1 || idx.nombre === -1 || idx.precioVenta === -1) {
    throw new Error("La hoja 'Importar' debe tener al menos las columnas 'SKU', 'Nombre' y 'PrecioVenta'.");
  }

  const productosValidos = [];
  const errores = [];
  datos.forEach((row, index) => {
    if (row[idx.sku] && row[idx.nombre]) {
      let productoCompleto = {};
      encabezados.forEach((h, i) => productoCompleto[h] = row[i] || '');
      productosValidos.push(productoCompleto);
    } else {
      errores.push(`Fila ${index + 2}: Omitida por no tener SKU o Nombre.`);
    }
  });
  return { productosValidos, errores };
}

/**
 * Recibe una lista de productos ya validados y los guarda en la hoja de Productos.
 * @param {Array<object>} productosAImportar - La lista de productos a guardar.
 * @returns {string} Un mensaje de confirmación del resultado.
 */
function ejecutarImportacion(productosAImportar) {
  if (!productosAImportar || productosAImportar.length === 0) {
    return "No se proporcionaron productos válidos para importar.";
  }
  
  const productosSheet = SPREADSHEET.getSheetByName(SHEETS.PRODUCTOS);
  const headers = productosSheet.getRange(1, 1, 1, productosSheet.getLastColumn()).getValues()[0];
  
  const nuevasFilas = productosAImportar.map(producto => {
    return headers.map(header => {
      if (header === 'Estado' && !producto[header]) return 'Activo';
      if (header === 'FechaIngreso') return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
      return producto[header] || '';
    });
  });

  productosSheet.getRange(productosSheet.getLastRow() + 1, 1, nuevasFilas.length, nuevasFilas[0].length).setValues(nuevasFilas);
  return `¡Éxito! Se importaron ${nuevasFilas.length} productos nuevos.`;
}

// ==================================================================
// FIN DEL MÓDULO
// ==================================================================

// ==================================================================
// INICIO DEL MÓDULO: DASHBOARD Y REPORTES
// ==================================================================

/**
 * Obtiene los datos necesarios para el dashboard principal, incluyendo el historial
 * de cierres y un resumen para el gráfico de rendimiento.
 * @param {object} filtros Un objeto con { fechaInicio, fechaFin }.
 * @returns {object} Un objeto con { historial, resumenGrafico }.
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

  const resumenGrafico = {
    labels: [],
    ventas: [],
    egresos: []
  };

  // Agrupar datos por día para el gráfico
  const datosAgrupados = {};
  historialFiltrado.forEach(row => {
    const fecha = Utilities.formatDate(new Date(row[headers.indexOf('FechaCierre')]), TIMEZONE, 'yyyy-MM-dd');
    if (!datosAgrupados[fecha]) {
      datosAgrupados[fecha] = { ventas: 0, egresos: 0 };
    }
    datosAgrupados[fecha].ventas += Number(row[headers.indexOf('TotalVentasApp')]) || 0;
    datosAgrupados[fecha].egresos += Number(row[headers.indexOf('TotalEgresos')]) || 0;
  });

  // Ordenar fechas y preparar para Chart.js
  const fechasOrdenadas = Object.keys(datosAgrupados).sort();
  fechasOrdenadas.forEach(fecha => {
    resumenGrafico.labels.push(fecha);
    resumenGrafico.ventas.push(datosAgrupados[fecha].ventas);
    resumenGrafico.egresos.push(datosAgrupados[fecha].egresos);
  });
  
  return { historial: historialFiltrado, resumenGrafico };
}


/**
 * Calcula un reporte de flujo de dinero (Estado de Cuenta) para un período determinado.
 * @param {object} filtros Un objeto con { fechaInicio, fechaFin }.
 * @returns {object} Un objeto con los totales de ingresos, egresos y créditos.
 */
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
    } else if (monto < 0) { // Cualquier otro movimiento negativo es un egreso
      totales.totalEgresos += Math.abs(monto);
    }
  });

  return totales;
}


/**
 * Calcula la rentabilidad (Utilidad Bruta y Neta) para un período.
 * @param {object} filtros Un objeto con { fechaInicio, fechaFin }.
 * @returns {object} Un objeto con los resultados del análisis de rentabilidad.
 */
function obtenerReporteRentabilidad(filtros) {
  // 1. Obtener ventas del período
  const { data: ventasData, headers: ventasHeaders } = obtenerDatosHoja(SHEETS.VENTAS);
  const inicio = new Date(filtros.fechaInicio + 'T00:00:00');
  const fin = new Date(filtros.fechaFin + 'T23:59:59');

  const ventasDelPeriodo = ventasData.filter(row => {
    const fechaVenta = new Date(row[ventasHeaders.indexOf('FechaHora')]);
    return fechaVenta >= inicio && fechaVenta <= fin;
  });
  const ventaIDs = new Set(ventasDelPeriodo.map(v => v[ventasHeaders.indexOf('VentaID')]));

  // 2. Obtener detalles de esas ventas
  const { data: detallesData, headers: detallesHeaders } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
  const detallesDelPeriodo = detallesData.filter(d => ventaIDs.has(d[detallesHeaders.indexOf('VentaID')]));

  // 3. Crear mapa de costos de productos para eficiencia
  const { data: prodsData, headers: prodsHeaders } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  const mapaCostos = prodsData.reduce((map, p) => {
    map[p[prodsHeaders.indexOf('SKU')]] = Number(p[prodsHeaders.indexOf('PrecioCosto')]) || 0;
    return map;
  }, {});

  // 4. Calcular ventas brutas y costo total
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

  // 5. Calcular egresos del período
  const { data: egresosData, headers: egresosHeaders } = obtenerDatosHoja(SHEETS.EGRESOS);
  const totalEgresos = egresosData
    .filter(row => {
      const fechaEgreso = new Date(row[egresosHeaders.indexOf('FechaHora')]);
      return fechaEgreso >= inicio && fechaEgreso <= fin;
    })
    .reduce((sum, row) => sum + (Number(row[egresosHeaders.indexOf('Monto')]) || 0), 0);
  
  // 6. Calcular utilidad neta estimada
  const utilidadNeta = utilidadBruta - totalEgresos;

  return { totalVentasBrutas, totalCostoMercaderia, utilidadBruta, totalEgresos, utilidadNeta };
}


/**
 * Obtiene un conjunto de métricas para los gráficos de Business Intelligence.
 * @param {object} filtros Un objeto con { fechaInicio, fechaFin }.
 * @returns {object} Un objeto con datos para los gráficos.
 */
function obtenerMetricasBI(filtros) {
  // 1. Obtener ventas y detalles del período
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
  
  // 2. Procesar métricas
  const productosResumen = {};
  const categoriaResumen = {};
  const horasResumen = Array(24).fill(0);

  detallesDelPeriodo.forEach(d => {
    const nombre = d[detallesHeaders.indexOf('ProductoNombre')];
    const categoria = d[detallesHeaders.indexOf('Categoria')] || 'Sin Categoría';
    const cantidad = Number(d[detallesHeaders.indexOf('Cantidad')]);
    const subtotal = Number(d[detallesHeaders.indexOf('Subtotal')]);

    // Para Top Productos
    if (!productosResumen[nombre]) productosResumen[nombre] = { cantidad: 0, monto: 0 };
    productosResumen[nombre].cantidad += cantidad;
    productosResumen[nombre].monto += subtotal;
    
    // Para Ventas por Categoría
    if (!categoriaResumen[categoria]) categoriaResumen[categoria] = 0;
    categoriaResumen[categoria] += subtotal;
  });

  ventasDelPeriodo.forEach(v => {
    const hora = new Date(v[ventasHeaders.indexOf('FechaHora')]).getHours();
    horasResumen[hora]++;
  });

  // 3. Formatear para la salida
  const topProductos = Object.entries(productosResumen).map(([nombre, data]) => ({ nombre, ...data }));

  return {
    topProductosCantidad: [...topProductos].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5),
    topProductosMonto: [...topProductos].sort((a, b) => b.monto - a.monto).slice(0, 5),
    ventasPorCategoria: categoriaResumen,
    actividadPorHora: horasResumen
  };
}

// ==================================================================
// FIN DEL MÓDULO
// ==================================================================

// ==================================================================
// INICIO DEL MÓDULO: DEUDAS Y EGRESOS (VERSIÓN FINAL)
// ==================================================================

/**
 * Obtiene todos los datos necesarios para el módulo de deudas en una sola llamada.
 * @returns {object} Un objeto con las deudas pendientes, historial de deudas y pagos.
 */
function obtenerDatosCompletosDeudas() {
  return {
    pendientes: obtenerDeudasPendientes(),
    historialDeudas: obtenerHistorialCompletoDeudas(),
    historialPagos: obtenerHistorialPagosDeuda()
  };
}

/**
 * ★★★ FUNCIÓN REFACTORIZADA ★★★
 * Obtiene una lista de todas las deudas individuales con estado 'Pendiente'.
 * @returns {Array<object>} Un array de objetos, donde cada objeto es una deuda pendiente.
 */
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

/**
 * Obtiene el historial completo de todas las deudas creadas, sin importar su estado.
 * @returns {Array<object>} Un array de objetos de deuda, ordenados por fecha.
 */
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

/**
 * Obtiene el historial de todos los pagos que han sido aplicados a deudas.
 * @returns {Array<object>} Un array de objetos de pago, ordenados por fecha.
 */
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


/**
 * Crea un nuevo registro de deuda de forma independiente.
 * @param {object} datosDeuda - { cliente, monto, fechaVencimiento, notas, sesionID, usuarioEmail }.
 * @returns {object} El objeto de la deuda creada.
 */
function crearNuevaDeuda(datosDeuda) {
  if (!datosDeuda.monto || datosDeuda.monto <= 0) throw new Error("El monto debe ser positivo.");
  if (!datosDeuda.cliente.dni) throw new Error("Debe seleccionar un cliente.");

  const deudasSheet = SPREADSHEET.getSheetByName(SHEETS.DEUDAS_CLIENTES);
  const ahora = new Date();
  const deudaID = `DEU-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}-${Utilities.getUuid().substring(0,5)}`;

  deudasSheet.appendRow([
    deudaID, datosDeuda.cliente.dni, datosDeuda.cliente.nombre,
    '', // VentaID_Origen
    ahora, // FechaCreacion
    datosDeuda.fechaVencimiento || '',
    datosDeuda.monto, // MontoOriginal
    0, // MontoPagado
    datosDeuda.monto, // SaldoPendiente
    'Pendiente', // Estado
    datosDeuda.notas || '',
    datosDeuda.sesionID
  ]);

  // Registrar el crédito otorgado como un movimiento de caja negativo
  const movimientosSheet = SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_CAJA);
  movimientosSheet.appendRow([
    `MOV-${deudaID}`, datosDeuda.sesionID, Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
    datosDeuda.usuarioEmail, 'CREDITO_OTORGADO',
    `Crédito a ${datosDeuda.cliente.nombre}`, -Math.abs(datosDeuda.monto)
  ]);
  
  return { deudaID: deudaID, monto: datosDeuda.monto };
}


/**
 * ★★★ FUNCIÓN REFACTORIZADA ★★★
 * Registra un pago a una deuda y actualiza inmediatamente el estado de la misma.
 * @param {object} datosPago - { deudaID, monto, metodoPago, notas, sesionID, usuarioEmail, clienteID }.
 * @returns {object} Un mensaje de confirmación.
 */
function registrarPagoDeDeuda(datosPago) {
  if (!datosPago.monto || datosPago.monto <= 0) throw new Error("El monto del pago debe ser positivo.");
  if (!datosPago.deudaID) throw new Error("No se especificó un ID de deuda.");

  const ahora = new Date();
  const fechaHora = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  
  // 1. Registrar en la hoja 'PagoDeudas'
  const pagoDeudaID = `PGD-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}`;
  SPREADSHEET.getSheetByName(SHEETS.PAGO_DEUDAS).appendRow([
    pagoDeudaID, datosPago.deudaID, fechaHora, datosPago.sesionID,
    datosPago.usuarioEmail, datosPago.clienteID, datosPago.metodoPago,
    datosPago.monto, datosPago.notas
  ]);

  // 2. Registrar el movimiento de caja (ingreso)
  let tipoMovimiento = '';
  if (datosPago.metodoPago === 'Efectivo') tipoMovimiento = 'PAGO_DEUDA_EFECTIVO';
  else if (datosPago.metodoPago === 'Yape/Plin') tipoMovimiento = 'PAGO_DEUDA_YAPE_PLIN';
  
  if (tipoMovimiento) {
    SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_CAJA).appendRow([
      `MOV-${pagoDeudaID}`, datosPago.sesionID, fechaHora, datosPago.usuarioEmail,
      tipoMovimiento, `Abono a deuda ${datosPago.deudaID}`, datosPago.monto
    ]);
  }

  // 3. Actualizar el saldo y estado de la deuda específica
  actualizarEstadoDeuda(datosPago.deudaID);
  
  return { message: "Pago de deuda registrado y saldo actualizado con éxito." };
}

/**
 * Función auxiliar que recalcula los totales de una deuda específica y actualiza su estado.
 * @param {string} deudaID El ID de la deuda a recalcular.
 */
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

/**
 * Registra un egreso (gasto, descuento, etc.) y crea el movimiento de caja correspondiente.
 * @param {object} datosEgreso - { tipo, monto, descripcion, sesionID, usuarioEmail }.
 * @returns {string} Mensaje de éxito.
 */
function registrarNuevoEgreso(datosEgreso) {
  if (!datosEgreso.monto || datosEgreso.monto <= 0) throw new Error("El monto del egreso debe ser positivo.");

  const ahora = new Date();
  const fechaHora = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  const egresoID = `EGR-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}-${Utilities.getUuid().substring(0,5)}`;

  // 1. Registrar en la hoja 'Egresos'
  SPREADSHEET.getSheetByName(SHEETS.EGRESOS).appendRow([
    egresoID, fechaHora, datosEgreso.sesionID, datosEgreso.usuarioEmail,
    datosEgreso.tipo, datosEgreso.descripcion, datosEgreso.monto
  ]);

  // 2. Registrar el movimiento de caja negativo
  SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_CAJA).appendRow([
    `MOV-${egresoID}`, datosEgreso.sesionID, fechaHora, datosEgreso.usuarioEmail,
    datosEgreso.tipo, datosEgreso.descripcion, -Math.abs(datosEgreso.monto)
  ]);
  
  return `Egreso de S/ ${datosEgreso.monto.toFixed(2)} registrado con éxito.`;
}

/**
 * Lee la hoja de Productos y genera un contenido en formato CSV para ser exportado.
 * @returns {string} El contenido completo del archivo CSV como un string.
 */
function exportarInventarioCSV() {
  const inventario = obtenerInventarioCompleto(); // ya lo tienes implementado
  if (!inventario || inventario.length === 0) return '';

  // Ordena las cabeceras de forma explícita
  const headers = [
    'SKU','Nombre','CodigoBarras','Categoria',
    'Stock','StockMinimo','PrecioCosto','PrecioVenta','ImagenURL','Estado'
  ];

  const rows = inventario.map(p => headers.map(h => {
    const v = p[h] == null ? '' : String(p[h]);
    // Escapa comillas y separadores; usa ; si tu configuración regional lo requiere
    return `"${v.replace(/"/g, '""')}"`;
  }).join(';')); // España suele usar ; como separador en CSV

  return [headers.join(';'), ...rows].join('\r\n');
}


// /**
//  * FUNCIÓN TEMPORAL PARA GENERAR UN HASH DE CONTRASEÑA
//  * Úsala para obtener el valor correcto para tu base de datos.
//  */
// function generarHashParaTest() {
//   const passwordEnTextoPlano = '123'; // La contraseña que quieres usar

//   const salt = "CyberiaSecretSalt-2025";
//   const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, passwordEnTextoPlano + salt);
//   const passwordHasheada = hashBytes.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');

//   Logger.log("Copia y pega este hash en tu columna 'PasswordHash':");
//   Logger.log(passwordHasheada);
// }

// ==================================================================
// INICIO DEL MÓDULO: REPORTES
// ==================================================================

/**
 * Procesa la hoja DetalleVentas para crear un resumen de productos vendidos,
 * agrupados por categoría.
 * @returns {object} Un objeto estructurado con los datos para el reporte.
 */

function obtenerResumenProductosVendidos(filtros) {
  const { headers: ventasHeaders, data: ventasData } = obtenerDatosHoja(SHEETS.VENTAS);
  let ventasFiltradas = [];

  // --- LÓGICA DE FILTRADO MEJORADA ---
  if (filtros && filtros.sesionID) {
    // Escenario 1: Filtrar por Sesión de Caja
    const sesionIdIndex = ventasHeaders.indexOf('SesionID');
    ventasFiltradas = ventasData.filter(row => row[sesionIdIndex] === filtros.sesionID);

  } else if (filtros && filtros.fechaInicio && filtros.fechaFin) {
    // Escenario 2: Filtrar por Rango de Fechas
    const inicio = new Date(filtros.fechaInicio + 'T00:00:00');
    const fin = new Date(filtros.fechaFin + 'T23:59:59');
    const fechaIndex = ventasHeaders.indexOf('FechaHora');
    
    ventasFiltradas = ventasData.filter(row => {
      const fechaVenta = new Date(row[fechaIndex]);
      return fechaVenta >= inicio && fechaVenta <= fin;
    });
  } else {
    // Si no hay filtros, no devolvemos nada para evitar reportes muy pesados.
    return {};
  }
  
  // Si después de filtrar no hay ventas, terminamos.
  if (ventasFiltradas.length === 0) return {};

  // El resto de la función (agrupar por categoría, etc.) se mantiene igual
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


// ==================================================================
// FIN DEL MÓDULO
// ==================================================================

// ==================================================================
// MÓDULO extra
// ==================================================================
/**
 * Obtiene una lista de todas las sesiones de caja (abiertas y cerradas)
 * para ser usadas en selectores/dropdowns.
 * @returns {Array<object>} Un array de objetos, cada uno con SesionID y una descripción.
 */
function obtenerHistorialSesiones() {
  const { headers, data } = obtenerDatosHoja(SHEETS.SESIONES_CAJA);
  if (!data.length) return [];

  const idx = {
    id: headers.indexOf('SesionID'),
    fecha: headers.indexOf('FechaApertura'),
    usuario: headers.indexOf('UsuarioAperturaEmail'),
    estado: headers.indexOf('Estado')
  };

  // Ordenar para mostrar las más recientes primero
  data.sort((a, b) => new Date(b[idx.fecha]) - new Date(a[idx.fecha]));

  return data.map(row => {
    const fechaFmt = Utilities.formatDate(new Date(row[idx.fecha]), TIMEZONE, 'dd/MM/yyyy');
    return {
      sesionID: row[idx.id],
      texto: `${row[idx.id]} (${fechaFmt} - ${row[idx.usuario]}) - ${row[idx.estado]}`
    };
  });
}

/**
 * Obtiene un resumen de todos los productos vendidos (agrupados por SKU)
 * durante una sesión de caja específica.
 * @param {string} sesionID - El ID de la sesión de caja a analizar.
 * @returns {Array<object>} Un array de objetos, cada uno representando un producto y su cantidad total vendida.
 */
function obtenerResumenProductosVendidosPorSesion(sesionID) {
  // 1. Obtener las ventas de la sesión
  const { data: ventasData, headers: ventasHeaders } = obtenerDatosHoja(SHEETS.VENTAS);
  const ventaIDsDeSesion = new Set(
    ventasData
      .filter(row => row[ventasHeaders.indexOf('SesionID')] === sesionID)
      .map(row => row[ventasHeaders.indexOf('VentaID')])
  );

  if (ventaIDsDeSesion.size === 0) {
    return []; // No hay ventas en esta sesión
  }

  // 2. Obtener los detalles de esas ventas
  const { data: detallesData, headers: detallesHeaders } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
  const detallesDeSesion = detallesData.filter(row => ventaIDsDeSesion.has(row[detallesHeaders.indexOf('VentaID')]));

  // 3. Agrupar por producto y sumar cantidades
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

  // 4. Convertir el objeto a un array y ordenar
  return Object.values(resumen).sort((a, b) => a.ProductoNombre.localeCompare(b.ProductoNombre));
}

// ==================================================================
// FIN DEL MÓDULO
// ==================================================================

function resetLoginAttempts(email) {
  PropertiesService.getUserProperties().deleteProperty(`login_attempts_${email}`);
  PropertiesService.getUserProperties().deleteProperty(`lockout_until_${email}`);
}
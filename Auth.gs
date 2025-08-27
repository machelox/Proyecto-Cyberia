/**
 * Módulo: Autenticación y Gestión de Empleados
 * Depende de: Constants.gs, Utils.gs
 */

function iniciarSesion(email, password) {
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

function enviarResetPassword(email) {
  const { headers, data } = obtenerDatosHoja(SHEETS.EMPLEADOS);
  const idx = { email: headers.indexOf('Email'), id: headers.indexOf('EmpleadoID') };
  const usuario = data.find(row => row[idx.email] === email);
  if (!usuario) {
    registrarLog('RESET_PASSWORD_FALLIDO', email, 'Usuario no encontrado');
    throw new Error('Email no registrado.');
  }

  const token = Utilities.getUuid();
  const expiration = new Date().getTime() + 24 * 60 * 60 * 1000;
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

    const filasActualizadas = data.map((row) => {
      if (row[idx.rol] !== rol) return row;
      const modulo = row[idx.modulo];
      const accion = row[idx.accion];
      if (nuevosPermisosMap[modulo] && nuevosPermisosMap[modulo][accion] !== undefined) {
        row[idx.permitido] = nuevosPermisosMap[modulo][accion];
      }
      return row;
    });

    sheet.getRange(2, 1, filasActualizadas.length, headers.length).setValues(filasActualizadas);
    registrarLog('GUARDAR_PERMISOS_EXITOSO', 'N/A', `Permisos actualizados para rol ${rol}`);
    return { message: `Permisos del rol '${rol}' guardados correctamente.` };
  } finally {
    lock.releaseLock();
  }
}

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(empleadoData.email)) {
      registrarLog('GESTIONAR_EMPLEADO_FALLIDO', empleadoData.email, 'Email inválido');
      throw new Error('Email inválido.');
    }

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

function generarHashParaTest(password) {
  const { hash, salt } = hashPassword(password);
  Logger.log(`Hash: ${hash}\nSalt: ${salt}`);
}

function generarNuevaClave() {
  generarHashParaTest("1234");
}

function resetLoginAttempts(email) {
  PropertiesService.getUserProperties().deleteProperty(`login_attempts_${email}`);
  PropertiesService.getUserProperties().deleteProperty(`lockout_until_${email}`);
}


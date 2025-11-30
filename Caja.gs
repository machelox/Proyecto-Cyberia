/**
 * Módulo: Flujo de Caja (CEREBRO CONTABLE MEJORADO)
 * Depende de: Constants.gs, Utils.gs
 */

function obtenerEstadoCajaActual() {
  const { headers, data } = obtenerDatosHoja(SHEETS.SESIONES_CAJA);
  if (!headers.length || data.length === 0) return null;
  const estadoIndex = headers.indexOf('Estado');
  const sesionAbiertaRow = data.reverse().find(row => row[estadoIndex] === 'Abierta');
  if (sesionAbiertaRow) {
    const sesionAbiertaObj = {};
    headers.forEach((header, i) => {
      const value = sesionAbiertaRow[i];
      sesionAbiertaObj[header] = value instanceof Date ? Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd") : value;
    });
    return sesionAbiertaObj;
  }
  return null;
}

function iniciarNuevaSesion(montoApertura, emailUsuario) {
  const sesionActual = obtenerEstadoCajaActual();
  if (sesionActual) throw new Error("Ya existe una sesión abierta.");

  const sesionesSheet = SPREADSHEET.getSheetByName(SHEETS.SESIONES_CAJA);
  const ahora = new Date();
  const sesionID = `CAJA-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMdd-HHmm")}`;
  
  const nuevaSesion = {
    SesionID: sesionID, Estado: "Abierta", FechaApertura: Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd"),
    HoraApertura: Utilities.formatDate(ahora, TIMEZONE, "HH:mm:ss"), UsuarioAperturaEmail: emailUsuario,
    MontoApertura: Number(montoApertura), FechaCierre: '', HoraCierre: '', UsuarioCierreEmail: '',
    TotalVentas: 0, TotalEfectivoCalculado: 0, MontoCierreReal: 0, Diferencia: 0, Notas: ''
  };

  const headers = sesionesSheet.getRange(1, 1, 1, sesionesSheet.getLastColumn()).getValues()[0];
  sesionesSheet.appendRow(headers.map(h => nuevaSesion[h] !== undefined ? nuevaSesion[h] : ''));
  return nuevaSesion;
}

/**
 * LÓGICA DE CIERRE (CORREGIDA v4)
 * 1. Soluciona el error de nombres (totalVentasYapePlin -> ventasDigitales)
 * 2. Soluciona la suma de ventas buscando variantes de nombre de columna.
 */
function obtenerResumenParaCierre(sesionID) {
  const { data: movData, headers: movHeaders } = obtenerDatosHoja(SHEETS.MOVIMIENTOS_CAJA);
  const movSesion = movData.filter(row => row[movHeaders.indexOf('SesionID')] === sesionID);
  
  let cobrosDeudaEfectivo = 0;
  let ventasDigitales = 0; 
  let pagosDeudaDigitales = 0;
  let totalGastos = 0;

  movSesion.forEach(mov => {
    const tipo = mov[movHeaders.indexOf('TipoMovimiento')];
    const monto = Number(mov[movHeaders.indexOf('Monto')]) || 0;
    
    if (tipo === 'PAGO_DEUDA_EFECTIVO') cobrosDeudaEfectivo += monto;
    if (tipo === 'VENTA_YAPE_PLIN' || tipo === 'PAGO_CLIENTE_YAPE_PLIN') ventasDigitales += monto;
    if (tipo === 'PAGO_DEUDA_YAPE_PLIN') pagosDeudaDigitales += monto;
    
    // Sumamos gastos (valores negativos)
    if (monto < 0 && tipo !== 'CREDITO_OTORGADO') totalGastos += Math.abs(monto);
  });

  // --- DEUDAS NUEVAS ---
  const { data: deudasData, headers: deudasHeaders } = obtenerDatosHoja(SHEETS.DEUDAS_CLIENTES);
  const totalDeudasNuevas = deudasData
    .filter(row => row[deudasHeaders.indexOf('SesionID_Origen')] === sesionID)
    .reduce((sum, row) => sum + (Number(row[deudasHeaders.indexOf('MontoOriginal')]) || 0), 0);
  
  // --- VENTAS APP (CORRECCIÓN: BUSCAR COLUMNA 'Total') ---
  const { data: ventasData, headers: ventasHeaders } = obtenerDatosHoja(SHEETS.VENTAS);
  const ventasSesion = ventasData.filter(row => row[ventasHeaders.indexOf('SesionID')] === sesionID);
  
  // Buscamos explícitamente 'Total' (o variantes comunes por seguridad)
  let colIndex = ventasHeaders.indexOf('Total'); 
  if (colIndex === -1) colIndex = ventasHeaders.indexOf('TotalVenta');
  
  let totalVentasApp = 0;
  if (colIndex !== -1) {
      // Sumamos solo ventas confirmadas (opcional, según tu lógica de negocio)
      // Si quieres sumar todas, quita el filtro de estado.
      totalVentasApp = ventasSesion.reduce((sum, row) => sum + (Number(row[colIndex]) || 0), 0);
  }

  // --- CANTIDAD PRODUCTOS ---
  const { data: detalleData, headers: detalleHeaders } = obtenerDatosHoja(SHEETS.SALES_DETAILS);
  const ventaIDs = new Set(ventasSesion.map(v => v[ventasHeaders.indexOf('VentaID')]));
  let colCant = detalleHeaders.indexOf('Cantidad');
  let qVentas = 0;
  if (colCant !== -1) {
      qVentas = detalleData
        .filter(d => ventaIDs.has(d[detalleHeaders.indexOf('VentaID')]))
        .reduce((sum, d) => sum + (Number(d[colCant]) || 0), 0);
  }

  return {
    totalVentasApp,
    qVentas,
    cobrosDeudaEfectivo, // Nombre clave
    ventasDigitales,     // Nombre clave
    pagosDeudaDigitales,  
    totalDeudasNuevas,
    totalGastos
  };
}

function finalizarCierreCaja(datosCierre) {
  const { sesionID, montoCyberplanet, montoReal, emailUsuario, notas } = datosCierre;

  // Obtenemos los datos calculados
  const resumen = obtenerResumenParaCierre(sesionID);
  const { cobrosDeudaEfectivo, ventasDigitales, totalDeudasNuevas, totalGastos, totalVentasApp, qVentas, pagosDeudaDigitales } = resumen;

  // --- FÓRMULA CORREGIDA ---
  // 1. Obtenemos apertura
  const { data: sesionData, headers: sesionHeaders } = obtenerDatosHoja(SHEETS.SESIONES_CAJA);
  const sesionRow = sesionData.find(r => r[sesionHeaders.indexOf('SesionID')] === sesionID);
  const montoApertura = sesionRow ? Number(sesionRow[sesionHeaders.indexOf('MontoApertura')]) : 0;

  // 2. Calculamos lo que debería haber en el cajón
  const efectivoEsperado = 
      montoApertura + 
      Number(montoCyberplanet) +     // Venta total reportada por sistema PC
      cobrosDeudaEfectivo -          // (+) Dinero de deudas antiguas
      ventasDigitales -              // (-) Ventas que no fueron efectivo (Yape)
      totalDeudasNuevas -            // (-) Ventas que fueron fiadas
      totalGastos;                   // (-) Salidas de dinero

  const diferencia = Number(montoReal) - efectivoEsperado;
  const totalYapePlinGeneral = ventasDigitales + pagosDeudaDigitales; // Para registro histórico

  const ss = SPREADSHEET;
  const ahora = new Date();
  const fechaCierre = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd");

  // Guardar Resumen Histórico
  ss.getSheetByName(SHEETS.RESUMENES_CIERRE).appendRow([
    sesionID, fechaCierre, emailUsuario, montoApertura, montoCyberplanet, totalVentasApp,
    cobrosDeudaEfectivo, totalYapePlinGeneral, totalDeudasNuevas, totalGastos,
    efectivoEsperado, montoReal, diferencia, qVentas
  ]);

  // Cerrar Sesión
  const filaIndex = sesionData.findIndex(row => row[sesionHeaders.indexOf('SesionID')] === sesionID);
  if (filaIndex !== -1) {
      const filaReal = filaIndex + 2;
      const updates = {
          'Estado': 'Cerrada',
          'FechaCierre': fechaCierre,
          'HoraCierre': Utilities.formatDate(ahora, TIMEZONE, "HH:mm:ss"),
          'UsuarioCierreEmail': emailUsuario,
          'TotalVentas': totalVentasApp,
          'TotalEfectivoCalculado': efectivoEsperado,
          'MontoCierreReal': montoReal,
          'Diferencia': diferencia,
          'Notas': notas || ''
      };
      const sheet = ss.getSheetByName(SHEETS.SESIONES_CAJA);
      Object.keys(updates).forEach(col => {
          const idx = sesionHeaders.indexOf(col);
          if (idx > -1) sheet.getRange(filaReal, idx + 1).setValue(updates[col]);
      });
  }

  return { ...resumen, montoApertura, efectivoEsperado, montoReal, diferencia };
}

function obtenerHistorialSesiones() {
  const { headers, data } = obtenerDatosHoja(SHEETS.SESIONES_CAJA);
  if (!data.length) return [];

  const idx = {
    id: headers.indexOf('SesionID'),
    fecha: headers.indexOf('FechaApertura'),
    usuario: headers.indexOf('UsuarioAperturaEmail'),
    estado: headers.indexOf('Estado')
  };

  data.sort((a, b) => new Date(b[idx.fecha]) - new Date(a[idx.fecha]));

  return data.map(row => {
    const fechaFmt = Utilities.formatDate(new Date(row[idx.fecha]), TIMEZONE, 'dd/MM/yyyy');
    return {
      sesionID: row[idx.id],
      texto: `${row[idx.id]} (${fechaFmt} - ${row[idx.usuario]}) - ${row[idx.estado]}`
    };
  });
}

/**
 * Módulo: Flujo de Caja (Sesiones y Cierre)
 * Depende de: Constants.gs, Utils.gs
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

function obtenerResumenParaCierre(sesionID) {
  const { data: movData, headers: movHeaders } = obtenerDatosHoja(SHEETS.MOVIMIENTOS_CAJA);
  const { data: ventasData, headers: ventasHeaders } = obtenerDatosHoja(SHEETS.VENTAS);
  const { data: deudasData, headers: deudasHeaders } = obtenerDatosHoja(SHEETS.DEUDAS_CLIENTES);
  const { data: detalleVentasData, headers: detalleVentasHeaders } = obtenerDatosHoja(SHEETS.SALES_DETAILS);

  const movSesion = movData.filter(row => row[movHeaders.indexOf('SesionID')] === sesionID);
  const ventasSesion = ventasData.filter(row => row[ventasHeaders.indexOf('SesionID')] === sesionID);
  
  let totalPagosDeudaEfectivo = 0, totalVentasYapePlin = 0, totalGastos = 0;

  movSesion.forEach(mov => {
    const tipo = mov[movHeaders.indexOf('TipoMovimiento')];
    const monto = Number(mov[movHeaders.indexOf('Monto')]) || 0;
    
    if (tipo === 'PAGO_DEUDA_EFECTIVO') totalPagosDeudaEfectivo += monto;
    if (tipo === 'PAGO_DEUDA_YAPE_PLIN' || tipo === 'VENTA_YAPE_PLIN' || tipo === 'PAGO_CLIENTE_YAPE_PLIN') totalVentasYapePlin += monto;
    
    if (monto < 0 && tipo !== 'CREDITO_OTORGADO') {
        totalGastos += monto;
    }
  });

  const totalDeudasNuevas = deudasData
    .filter(row => row[deudasHeaders.indexOf('SesionID_Origen')] === sesionID)
    .reduce((sum, row) => sum + (Number(row[deudasHeaders.indexOf('MontoOriginal')]) || 0), 0);
  
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
    totalGastos: Math.abs(totalGastos)
  };
}

function finalizarCierreCaja(datosCierre) {
  const { sesionID, montoCyberplanet, montoReal, emailUsuario, notas } = datosCierre;

  const resumen = obtenerResumenParaCierre(sesionID);
  const { totalPagosDeudaEfectivo, totalYapePlin, totalDeudasNuevas, totalGastos, totalVentasApp, qVentas } = resumen;

  const efectivoEsperado = Number(montoCyberplanet) + totalPagosDeudaEfectivo - totalYapePlin - totalDeudasNuevas - totalGastos;
  const diferencia = Number(montoReal) - efectivoEsperado;

  const ss = SPREADSHEET;
  const ahora = new Date();
  
  const { data: sesionData, headers: sesionHeaders } = obtenerDatosHoja(SHEETS.SESIONES_CAJA);
  const sesionActualRow = sesionData.find(row => row[sesionHeaders.indexOf('SesionID')] === sesionID);
  const montoApertura = Number(sesionActualRow[sesionHeaders.indexOf('MontoApertura')]) || 0;

  const resumenesSheet = ss.getSheetByName(SHEETS.RESUMENES_CIERRE);
  const fechaCierre = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd");
  
  resumenesSheet.appendRow([
    sesionID, fechaCierre, emailUsuario, montoApertura, montoCyberplanet, totalVentasApp,
    totalPagosDeudaEfectivo, totalYapePlin, totalDeudasNuevas, totalGastos,
    efectivoEsperado, montoReal, diferencia, qVentas
  ]);

  const sesionesSheet = ss.getSheetByName(SHEETS.SESIONES_CAJA);
  const sesionIdIndex = sesionHeaders.indexOf('SesionID');
  const filaIndex = sesionData.findIndex(row => row[sesionIdIndex] === sesionID);
  
  if (filaIndex !== -1) {
      const filaAActualizar = filaIndex + 2;
      const horaCierre = Utilities.formatDate(ahora, TIMEZONE, "HH:mm:ss");

      // Optimización: actualizar la fila completa en un solo setValues
      const row = sesionData[filaIndex].slice();
      row[sesionHeaders.indexOf('Estado')] = 'Cerrada';
      row[sesionHeaders.indexOf('FechaCierre')] = fechaCierre;
      row[sesionHeaders.indexOf('HoraCierre')] = horaCierre;
      row[sesionHeaders.indexOf('UsuarioCierreEmail')] = emailUsuario;
      row[sesionHeaders.indexOf('TotalVentas')] = totalVentasApp;
      row[sesionHeaders.indexOf('TotalEfectivoCalculado')] = efectivoEsperado;
      row[sesionHeaders.indexOf('MontoCierreReal')] = montoReal;
      row[sesionHeaders.indexOf('Diferencia')] = diferencia;
      row[sesionHeaders.indexOf('Notas')] = notas || '';
      sesionesSheet.getRange(filaAActualizar, 1, 1, sesionHeaders.length).setValues([row]);
  }

  return { ...resumen, montoCyberplanet, efectivoEsperado, montoReal, diferencia };
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


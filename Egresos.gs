/**
 * Módulo: Egresos
 * Depende de: Constants.gs, Utils.gs
 */

function registrarNuevoEgreso(datosEgreso) {
  if (!datosEgreso.monto || datosEgreso.monto <= 0) throw new Error("El monto del egreso debe ser positivo.");

  const ahora = new Date();
  const fechaHora = Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  const egresoID = `EGR-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}-${Utilities.getUuid().substring(0,5)}`;

  SPREADSHEET.getSheetByName(SHEETS.EGRESOS).appendRow([
    egresoID, fechaHora, datosEgreso.sesionID, datosEgreso.usuarioEmail,
    datosEgreso.tipo, datosEgreso.descripcion, datosEgreso.monto
  ]);

  SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_CAJA).appendRow([
    `MOV-${egresoID}`, datosEgreso.sesionID, fechaHora, datosEgreso.usuarioEmail,
    datosEgreso.tipo, datosEgreso.descripcion, -Math.abs(datosEgreso.monto)
  ]);
  
  return `Egreso de S/ ${datosEgreso.monto.toFixed(2)} registrado con éxito.`;
}


/**
 * Módulo: Gestión de Pagos Yape/Plin
 * Depende de: Constants.gs
 */

// =========================
//  Obtener hoja principal
// =========================
function _getPagosYapeSheet() {
  const ss = SPREADSHEET;
  let sheet = ss.getSheetByName(SHEETS.PAGOS_YAPE);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PAGOS_YAPE);
    // Encabezados solicitados + Usuario (para "Registrado por")
    sheet.appendRow([
      "Fecha", "Cliente", "Monto", "Código", "Referencia", "Método", "Tipo", "Nota", "Usuario"
    ]);
  }
  return sheet;
}

// ============================================
//  1) Registrar pago AUTOMÁTICO (>= S/ 10)
// ============================================
// function registrarPagoAutomatico(fecha, monto, codigo) {
//   const sheet = _getPagosYapeSheet();

//   sheet.appendRow([
//     fecha,
//     monto,
//     "YAPE",
//     codigo,
//     "AUTOMATICO",
//     "" // acciones vacías, porque NO se puede editar ni borrar
//   ]);

//   return true;
// }

// =========================================================
//  Registrar pago MANUAL (Con validación de duplicados)
// =========================================================
function registrarPagoManual(data) {
  const sheet = _getPagosYapeSheet();
  const ss = SPREADSHEET;

  // 1. VALIDACIÓN DE DUPLICADOS (Por Código de Operación)
  if (data.codigo && data.codigo !== "-" && data.codigo !== "") {
    const codigos = sheet.getRange(2, 4, sheet.getLastRow(), 1).getValues().flat(); // Columna 4 es Código
    // Convertimos a string para comparar seguro
    if (codigos.map(String).includes(String(data.codigo))) {
       throw new Error(`El código de operación "${data.codigo}" ya existe en el registro.`);
    }
  }

  // 2. Guardar en la hoja PAGOS_YAPE
  sheet.appendRow([
    data.fecha,
    data.cliente,    // Nombre del cliente
    data.monto,
    data.codigo,
    data.referencia,
    data.metodo,
    "MANUAL",        // Tipo
    data.nota,
    data.usuarioEmail // Registrado por
  ]);

  // 3. INTEGRACIÓN: Registrar en MOVIMIENTOS_CAJA (Libro Mayor)
  if (data.sesionID) {
      const movimientosSheet = ss.getSheetByName(SHEETS.MOVIMIENTOS_CAJA);
      const timezone = TIMEZONE; 
      const ahora = new Date();
      const fechaHora = Utilities.formatDate(ahora, timezone, "yyyy-MM-dd HH:mm:ss");
      const refID = `PAY-${Utilities.formatDate(ahora, timezone, "yyyyMMddHHmmss")}`;

      movimientosSheet.appendRow([
        `MOV-${refID}`,
        data.sesionID,
        fechaHora,
        data.usuarioEmail,
        'PAGO_CLIENTE_YAPE_PLIN', 
        `Ingreso ${data.metodo} (${data.codigo}): ${data.referencia}`,
        Math.abs(data.monto) // Ingreso positivo
      ]);
  }
  
  SpreadsheetApp.flush();
  return true;
}
// ==========================
//  Obtener todos los pagos
// ==========================
function obtenerPagosYape() {
  const sheet = _getPagosYapeSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  // Leemos 9 columnas: Fecha, Cliente, Monto, Código, Ref, Método, Tipo, Nota, Usuario
  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

  // Invertimos el array (.reverse()) para mostrar los más recientes primero
  return data.reverse().map((row, index) => ({
    // Calculamos el ID real basado en la fila original (para editar/borrar)
    id: (lastRow - index), 
    fecha: row[0] instanceof Date ? Utilities.formatDate(row[0], TIMEZONE, "yyyy-MM-dd") : row[0],
    cliente: row[1],
    monto: row[2],
    codigo: row[3],
    referencia: row[4],
    metodo: row[5],
    tipo: row[6],
    nota: row[7],
    usuario: row[8] // Registrado por
  }));
}

// ========================================
//  Eliminar pago manual
// ========================================
function eliminarPagoManual(id) {
  const sheet = _getPagosYapeSheet();
  // Verificamos tipo en la columna 7 (G) -> "Tipo"
  const tipo = sheet.getRange(id, 7).getValue(); 

  if (tipo !== "MANUAL") {
    throw new Error("No se permite eliminar pagos automáticos.");
  }
  sheet.deleteRow(id);
  return true;
}

// ========================================
//  5) Editar solo pagos manuales
// ========================================
// function editarPagoManual(id, data) {
//   const sheet = _getPagosYapeSheet();
//   const origen = sheet.getRange(id, 5).getValue();

//   if (origen !== "MANUAL") {
//     throw new Error("No se permite editar pagos automáticos.");
//   }

//   sheet.getRange(id, 1, 1, 6).setValues([[
//     data.fecha,
//     data.monto,
//     data.metodo,
//     data.codigo,
//     "MANUAL",
//     "editable"
//   ]]);

//   return true;
// }
/**
 * Módulo: Triggers Automáticos
 * Depende de: Constants.gs, Utils.gs, Inventario.gs, Ventas.gs
 */

/**
 * Trigger onEdit: Valida y procesa automáticamente cambios en hojas de cálculo
 * @param {Event} e Evento de edición de Google Sheets
 */
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    const sheetName = sheet.getName();
    const range = e.range;
    const fila = range.getRow();
    const columna = range.getColumn();
    
    // Evitar procesamiento en filas de encabezado
    if (fila === 1) return;
    
    // Procesar según la hoja editada
    if (sheetName === SHEETS.PRODUCTOS) {
      validarEdicionProducto(sheet, fila, columna);
    } else if (sheetName === SHEETS.VENTAS) {
      validarEdicionVenta(sheet, fila, columna);
    }
    
  } catch (error) {
    registrarLog('TRIGGER_ONEDIT_ERROR', `Error en onEdit: ${error.message}`, 'SISTEMA');
  }
}

/**
 * Valida y actualiza stock cuando se registra una venta
 * @param {Sheet} sheet Hoja de ventas
 * @param {number} fila Fila editada
 * @param {number} columna Columna editada
 */
function validarEdicionVenta(sheet, fila, columna) {
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const estadoIndex = headers.indexOf('EstadoPago');
    
    // Si se cambió el estado a 'Confirmado', actualizar stock automáticamente
    if (estadoIndex !== -1 && columna === estadoIndex + 1) {
      const valoresFila = sheet.getRange(fila, 1, 1, headers.length).getValues()[0];
      const estado = valoresFila[estadoIndex];
      const ventaIDIndex = headers.indexOf('VentaID');
      const usuarioEmailIndex = headers.indexOf('UsuarioEmail');
      
      if (estado === 'Confirmado' && ventaIDIndex !== -1) {
        const ventaID = valoresFila[ventaIDIndex];
        const usuarioEmail = valoresFila[usuarioEmailIndex] || 'SISTEMA';
        
        // Obtener detalles de la venta
        const detalles = obtenerDetallesDeVenta(ventaID);
        if (detalles && detalles.length > 0) {
          const itemsVenta = detalles.map(item => ({
            sku: item.SKU,
            cantidad: item.Cantidad,
            nombre: item.ProductoNombre
          }));
          
          // Procesar venta y actualizar stock
          procesarVenta(itemsVenta, usuarioEmail);
          registrarLog('STOCK_ACTUALIZADO_AUTO', `Stock actualizado automáticamente por venta ${ventaID}`, usuarioEmail);
        }
      }
    }
  } catch (error) {
    registrarLog('VALIDAR_EDICION_VENTA_ERROR', `Error al validar edición de venta: ${error.message}`, 'SISTEMA');
  }
}

/**
 * Valida ediciones en la hoja de productos
 * @param {Sheet} sheet Hoja de productos
 * @param {number} fila Fila editada
 * @param {number} columna Columna editada
 */
function validarEdicionProducto(sheet, fila, columna) {
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const stockIndex = headers.indexOf('Stock');
    
    // Si se editó el stock manualmente, registrar el movimiento
    if (stockIndex !== -1 && columna === stockIndex + 1) {
      const valoresFila = sheet.getRange(fila, 1, 1, headers.length).getValues()[0];
      const skuIndex = headers.indexOf('SKU');
      
      if (skuIndex !== -1) {
        const sku = valoresFila[skuIndex];
        const nuevoStock = valoresFila[stockIndex];
        
        registrarLog('STOCK_EDITADO_MANUAL', `Stock editado manualmente para SKU: ${sku}, nuevo stock: ${nuevoStock}`, 'SISTEMA');
      }
    }
  } catch (error) {
    registrarLog('VALIDAR_EDICION_PRODUCTO_ERROR', `Error al validar edición de producto: ${error.message}`, 'SISTEMA');
  }
}

/**
 * Configura los triggers automáticos del sistema
 * Esta función debe ejecutarse manualmente una vez para configurar los triggers
 */
function configurarTriggersAutomaticos() {
  // Eliminar triggers existentes para evitar duplicados
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'generarReporteDiario' || 
        trigger.getHandlerFunction() === 'generarReporteSemanal') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Crear trigger diario para reportes (ejecuta a las 23:00)
  ScriptApp.newTrigger('generarReporteDiario')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .create();
  
  // Crear trigger semanal para reportes (ejecuta los domingos a las 23:00)
  ScriptApp.newTrigger('generarReporteSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(23)
    .create();
  
  registrarLog('TRIGGERS_CONFIGURADOS', 'Triggers automáticos configurados exitosamente', 'SISTEMA');
  return { status: 'ok', message: 'Triggers automáticos configurados correctamente.' };
}

/**
 * Genera reporte diario automáticamente
 * Ejecutado por trigger time-driven diario
 */
function generarReporteDiario() {
  try {
    const hoy = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
    const ayer = Utilities.formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000), TIMEZONE, "yyyy-MM-dd");
    
    registrarLog('REPORTE_DIARIO_INICIADO', `Generando reporte diario para ${ayer}`, 'SISTEMA');
    
    // Obtener email del administrador desde propiedades del script
    const emailAdmin = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    
    generarReporteVentas(ayer, ayer, 'csv', emailAdmin);
    
    registrarLog('REPORTE_DIARIO_COMPLETADO', `Reporte diario generado para ${ayer}`, 'SISTEMA');
  } catch (error) {
    registrarLog('REPORTE_DIARIO_ERROR', `Error al generar reporte diario: ${error.message}`, 'SISTEMA');
    // Enviar notificación de error si está configurado
    const emailAdmin = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (emailAdmin) {
      enviarNotificacionError(emailAdmin, 'Error en reporte diario automático', error.message);
    }
  }
}

/**
 * Genera reporte semanal automáticamente
 * Ejecutado por trigger time-driven semanal (domingos)
 */
function generarReporteSemanal() {
  try {
    const hoy = new Date();
    const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const fechaFin = Utilities.formatDate(hoy, TIMEZONE, "yyyy-MM-dd");
    const fechaInicio = Utilities.formatDate(hace7Dias, TIMEZONE, "yyyy-MM-dd");
    
    registrarLog('REPORTE_SEMANAL_INICIADO', `Generando reporte semanal desde ${fechaInicio} hasta ${fechaFin}`, 'SISTEMA');
    
    // Obtener email del administrador desde propiedades del script
    const emailAdmin = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    
    generarReporteVentas(fechaInicio, fechaFin, 'pdf', emailAdmin);
    
    registrarLog('REPORTE_SEMANAL_COMPLETADO', `Reporte semanal generado desde ${fechaInicio} hasta ${fechaFin}`, 'SISTEMA');
  } catch (error) {
    registrarLog('REPORTE_SEMANAL_ERROR', `Error al generar reporte semanal: ${error.message}`, 'SISTEMA');
    // Enviar notificación de error si está configurado
    const emailAdmin = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (emailAdmin) {
      enviarNotificacionError(emailAdmin, 'Error en reporte semanal automático', error.message);
    }
  }
}

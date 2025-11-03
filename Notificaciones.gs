/**
 * Módulo: Sistema de Notificaciones por Correo
 * Depende de: Constants.gs, Utils.gs
 */

/**
 * Envía notificación al administrador sobre la generación de un reporte
 * @param {string} emailAdmin Email del administrador
 * @param {Object} resultado Resultado de la generación del reporte
 * @param {string} fechaInicio Fecha de inicio del reporte
 * @param {string} fechaFin Fecha de fin del reporte
 */
function enviarNotificacionReporte(emailAdmin, resultado, fechaInicio, fechaFin) {
  try {
    const subject = `✅ Reporte de Ventas Generado - ${fechaInicio} al ${fechaFin}`;
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2c3e50;">Reporte de Ventas Generado</h2>
          <p>Se ha generado exitosamente el reporte de ventas para el período solicitado.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #27ae60;">Resumen del Período</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;"><strong>Período:</strong> ${fechaInicio} al ${fechaFin}</li>
              <li style="margin: 10px 0;"><strong>Total de ventas:</strong> ${resultado.resumen.totalVentas}</li>
              <li style="margin: 10px 0;"><strong>Total de items:</strong> ${resultado.resumen.totalItems}</li>
              <li style="margin: 10px 0;"><strong>Total de ingresos:</strong> S/ ${resultado.resumen.totalIngresos.toFixed(2)}</li>
            </ul>
          </div>
          
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2e7d32;">Archivo Generado</h3>
            <p><strong>Nombre:</strong> ${resultado.archivo.nombre}</p>
            <p><strong>Tamaño:</strong> ${(resultado.archivo.tamaño / 1024).toFixed(2)} KB</p>
            <p><a href="${resultado.archivo.url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Descargar Reporte</a></p>
          </div>
          
          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
            Este es un correo automático del sistema Cyberia. Por favor, no responda a este mensaje.
          </p>
        </body>
      </html>
    `;
    
    const textoPlano = `
      Reporte de Ventas Generado
      
      Período: ${fechaInicio} al ${fechaFin}
      Total de ventas: ${resultado.resumen.totalVentas}
      Total de items: ${resultado.resumen.totalItems}
      Total de ingresos: S/ ${resultado.resumen.totalIngresos.toFixed(2)}
      
      Archivo: ${resultado.archivo.nombre}
      Tamaño: ${(resultado.archivo.tamaño / 1024).toFixed(2)} KB
      URL: ${resultado.archivo.url}
    `;
    
    GmailApp.sendEmail(emailAdmin, subject, textoPlano, { htmlBody: htmlBody });
    registrarLog('NOTIFICACION_REPORTE_ENVIADA', `Notificación de reporte enviada a ${emailAdmin}`, 'SISTEMA');
    
  } catch (error) {
    registrarLog('NOTIFICACION_REPORTE_ERROR', `Error al enviar notificación de reporte: ${error.message}`, 'SISTEMA');
  }
}

/**
 * Envía notificación de error crítico al administrador
 * @param {string} emailAdmin Email del administrador
 * @param {string} titulo Título del error
 * @param {string} mensaje Mensaje de error
 */
function enviarNotificacionError(emailAdmin, titulo, mensaje) {
  try {
    const subject = `⚠️ ${titulo} - Cyberia Sistema`;
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #e74c3c;">⚠️ Error en el Sistema</h2>
          <div style="background-color: #ffebee; padding: 15px; border-left: 4px solid #e74c3c; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #c62828;">${titulo}</h3>
            <p><strong>Detalles del error:</strong></p>
            <p style="background-color: white; padding: 10px; border-radius: 3px; font-family: monospace;">${mensaje}</p>
          </div>
          
          <p><strong>Fecha y hora:</strong> ${Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")}</p>
          
          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
            Por favor, revise el sistema y los logs para más información.
          </p>
        </body>
      </html>
    `;
    
    const textoPlano = `
      Error en el Sistema
      
      ${titulo}
      
      Detalles: ${mensaje}
      Fecha: ${Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")}
    `;
    
    GmailApp.sendEmail(emailAdmin, subject, textoPlano, { htmlBody: htmlBody });
    registrarLog('NOTIFICACION_ERROR_ENVIADA', `Notificación de error enviada a ${emailAdmin}`, 'SISTEMA');
    
  } catch (error) {
    registrarLog('NOTIFICACION_ERROR_FALLO', `Error al enviar notificación de error: ${error.message}`, 'SISTEMA');
  }
}

/**
 * Envía notificación sobre devoluciones procesadas
 * @param {string} emailAdmin Email del administrador
 * @param {Object} datosDevolucion Datos de la devolución procesada
 */
function enviarNotificacionDevolucion(emailAdmin, datosDevolucion) {
  try {
    const subject = `🔄 Devolución Procesada - Venta ${datosDevolucion.ventaID}`;
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #f39c12;">Devolución Procesada</h2>
          <p>Se ha procesado una devolución en el sistema.</p>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #856404;">Detalles de la Devolución</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;"><strong>Venta ID:</strong> ${datosDevolucion.ventaID}</li>
              <li style="margin: 10px 0;"><strong>Producto:</strong> ${datosDevolucion.producto} (SKU: ${datosDevolucion.sku})</li>
              <li style="margin: 10px 0;"><strong>Cantidad devuelta:</strong> ${datosDevolucion.cantidadDevuelta}</li>
              ${datosDevolucion.montoDevuelto > 0 ? `<li style="margin: 10px 0;"><strong>Monto devuelto:</strong> S/ ${datosDevolucion.montoDevuelto.toFixed(2)}</li>` : ''}
            </ul>
          </div>
          
          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
            Fecha: ${Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")}
          </p>
        </body>
      </html>
    `;
    
    const textoPlano = `
      Devolución Procesada
      
      Venta ID: ${datosDevolucion.ventaID}
      Producto: ${datosDevolucion.producto} (SKU: ${datosDevolucion.sku})
      Cantidad devuelta: ${datosDevolucion.cantidadDevuelta}
      ${datosDevolucion.montoDevuelto > 0 ? `Monto devuelto: S/ ${datosDevolucion.montoDevuelto.toFixed(2)}` : ''}
    `;
    
    GmailApp.sendEmail(emailAdmin, subject, textoPlano, { htmlBody: htmlBody });
    registrarLog('NOTIFICACION_DEVOLUCION_ENVIADA', `Notificación de devolución enviada a ${emailAdmin}`, 'SISTEMA');
    
  } catch (error) {
    registrarLog('NOTIFICACION_DEVOLUCION_ERROR', `Error al enviar notificación de devolución: ${error.message}`, 'SISTEMA');
  }
}

/**
 * Configura el email del administrador para notificaciones
 * @param {string} email Email del administrador
 */
function configurarEmailAdministrador(email) {
  try {
    PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', email);
    registrarLog('EMAIL_ADMIN_CONFIGURADO', `Email de administrador configurado: ${email}`, 'SISTEMA');
    return { status: 'ok', message: `Email de administrador configurado: ${email}` };
  } catch (error) {
    registrarLog('EMAIL_ADMIN_ERROR', `Error al configurar email de administrador: ${error.message}`, 'SISTEMA');
    throw error;
  }
}

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

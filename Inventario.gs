/**
 * Módulo: Gestión de Inventario
 * Depende de: Constants.gs, Utils.gs
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

function agregarProductoNuevo(producto) {
  const productosSheet = SPREADSHEET.getSheetByName(SHEETS.PRODUCTOS);
  
  const { data, headers } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  const skuIndex = headers.indexOf('SKU');
  if (data.some(row => row[skuIndex] === producto.SKU)) {
    throw new Error(`El SKU '${producto.SKU}' ya existe. Por favor, use uno diferente.`);
  }

  // Asegurar el orden correcto de las columnas según la hoja
  const nuevaFila = [
    producto.SKU, 
    producto.Nombre, 
    producto.CodigoBarras || '', 
    producto.Categoria,
    producto.Stock || 0, 
    producto.StockMinimo || 5, 
    producto.PrecioCosto || 0,
    producto.PrecioVenta, 
    'Activo', // Estado por defecto
    Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss"), // FechaIngreso
    producto.ImagenURL || ''
  ];
  productosSheet.appendRow(nuevaFila);
  return producto;
}

function gestionarProducto(productoData, accion) {
  const productosSheet = SPREADSHEET.getSheetByName(SHEETS.PRODUCTOS);
  const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  const skuIndex = headers.indexOf('SKU');
  const filaIndex = data.findIndex(row => row[skuIndex] === productoData.SKU);

  if (filaIndex === -1) {
    throw new Error(`Producto con SKU ${productoData.SKU} no encontrado.`);
  }

  const filaAActualizar = filaIndex + 2; // +1 por header, +1 por index a 0

  if (accion.toUpperCase() === 'EDITAR') {
    
    // --- [CORRECCIÓN DE BUG] ---
    // La optimización anterior era incorrecta porque las columnas no son contiguas.
    // Actualizamos cada celda individualmente para garantizar la integridad de los datos.
    
    productosSheet.getRange(filaAActualizar, headers.indexOf('Nombre') + 1).setValue(productoData.Nombre);
    productosSheet.getRange(filaAActualizar, headers.indexOf('CodigoBarras') + 1).setValue(productoData.CodigoBarras);
    productosSheet.getRange(filaAActualizar, headers.indexOf('Categoria') + 1).setValue(productoData.Categoria);
    productosSheet.getRange(filaAActualizar, headers.indexOf('StockMinimo') + 1).setValue(productoData.StockMinimo);
    productosSheet.getRange(filaAActualizar, headers.indexOf('PrecioCosto') + 1).setValue(productoData.PrecioCosto);
    productosSheet.getRange(filaAActualizar, headers.indexOf('PrecioVenta') + 1).setValue(productoData.PrecioVenta);
    productosSheet.getRange(filaAActualizar, headers.indexOf('ImagenURL') + 1).setValue(productoData.ImagenURL);
    // --- [FIN DE CORRECCIÓN] ---

    return { status: 'ok', message: 'Producto actualizado correctamente.' };
    
  } else if (accion.toUpperCase() === 'DESACTIVAR') {
    productosSheet.getRange(filaAActualizar, headers.indexOf('Estado') + 1).setValue('Inactivo');
    return { status: 'ok', message: 'Producto desactivado.' };
  } else {
    throw new Error('Acción no reconocida para gestionar producto.');
  }
}

function procesarVenta(itemsVenta, emailUsuario = 'SISTEMA') {
  // Esta función debe ejecutarse como una transacción si es posible
  // Por ahora, procesamos uno por uno.
  for (const item of itemsVenta) {
    const movimiento = {
      sku: item.sku, 
      tipo: 'VENTA',
      cantidad: -Math.abs(item.cantidad), // Venta siempre resta
      notas: `Venta ID: ${item.ventaId || 'N/A'}`, // Asumimos que podemos recibir un ventaId
      emailUsuario: emailUsuario
    };
    // Llamada interna, no desde la UI
    _registrarMovimientoInventario(movimiento);
  }
  return 'Stock actualizado y movimientos registrados correctamente.';
}

/**
 * Función interna para registrar movimientos.
 * Re-utiliza la lógica de 'registrarMovimientoInventario' pero se ajusta
 * para ser llamada desde otras funciones de servidor.
 */
function _registrarMovimientoInventario(movimiento) {
  const productosSheet = SPREADSHEET.getSheetByName(SHEETS.PRODUCTOS);
  const movimientosSheet = SPREADSHEET.getSheetByName(SHEETS.MOVIMIENTOS_INVENTARIO);
  const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);

  const idx = { sku: headers.indexOf('SKU'), stock: headers.indexOf('Stock'), nombre: headers.indexOf('Nombre') };
  const productoIndex = data.findIndex(row => row[idx.sku] === movimiento.sku);

  if (productoIndex === -1) throw new Error(`El producto con SKU ${movimiento.sku} no fue encontrado.`);
  
  const stockActual = Number(data[productoIndex][idx.stock]);
  const nuevoStock = stockActual + movimiento.cantidad; // movimiento.cantidad ya debe ser negativo si es salida
  
  if (nuevoStock < 0 && movimiento.tipo !== 'INGRESO') {
     // Opcional: Lanzar error si se intenta vender sin stock
     // throw new Error(`Stock insuficiente para ${movimiento.sku}. Stock actual: ${stockActual}`);
  }

  // Actualizar stock
  productosSheet.getRange(productoIndex + 2, idx.stock + 1).setValue(nuevoStock);

  const ahora = new Date();
  const productoNombre = data[productoIndex][idx.nombre];
  const movimientoID = `MOV-${Utilities.formatDate(ahora, TIMEZONE, "yyyyMMddHHmmss")}-${Utilities.getUuid().substring(0, 5)}`;
  
  const nuevoMovimiento = [
    movimientoID, 
    Utilities.formatDate(ahora, TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
    movimiento.sku, 
    productoNombre, 
    movimiento.tipo, 
    movimiento.cantidad,
    movimiento.emailUsuario, 
    movimiento.notas || ''
  ];
  
  // Usar appendRow es más simple y directo
  movimientosSheet.appendRow(nuevoMovimiento);
  
  return "Movimiento registrado y stock actualizado.";
}

/**
 * Función expuesta a la UI para registrar movimientos manuales.
 */
function registrarMovimientoInventario(movimiento) {
  // Aseguramos que la cantidad sea correcta según el tipo
  if (movimiento.tipo !== 'INGRESO') {
    movimiento.cantidad = -Math.abs(movimiento.cantidad);
  } else {
    movimiento.cantidad = Math.abs(movimiento.cantidad);
  }
  
  if (movimiento.cantidad === 0) {
    throw new Error('La cantidad no puede ser cero.');
  }

  return _registrarMovimientoInventario(movimiento);
}


function obtenerHistorialProducto(sku) {
  const { headers, data } = obtenerDatosHoja(SHEETS.MOVIMIENTOS_INVENTARIO);
  const skuIndex = headers.indexOf('SKU');
  
  const historial = data
    .filter(row => String(row[skuIndex]).trim() === sku)
    .map(row => {
      const movimiento = {};
      headers.forEach((h, i) => {
        // Formatear fechas correctamente
        if ((h === 'FechaHora' || h.includes('Fecha')) && row[i] instanceof Date) {
           movimiento[h] = Utilities.formatDate(row[i], TIMEZONE, "yyyy-MM-dd HH:mm:ss");
        } else {
           movimiento[h] = row[i];
        }
      });
      return movimiento;
    });
    
  historial.sort((a,b) => new Date(b.FechaHora) - new Date(a.FechaHora));
  return historial;
}

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

function obtenerCategoriasUnicas() {
  const { headers, data } = obtenerDatosHoja(SHEETS.PRODUCTOS);
  const categoriaIndex = headers.indexOf('Categoria');
  if (categoriaIndex === -1) return [];
  const categorias = new Set(data.map(row => row[categoriaIndex]).filter(Boolean));
  return Array.from(categorias).sort();
}

function previsualizarImportacion() {
  const importSheet = SPREADSHEET.getSheetByName('Importar');
  if (!importSheet) throw new Error("No se encontró la hoja 'Importar'.");
  
  const datos = importSheet.getDataRange().getValues();
  if (datos.length <= 1) throw new Error("La hoja 'Importar' está vacía.");

  const encabezados = datos.shift();
  const idx = {
    sku: encabezados.indexOf('SKU'),
    nombre: encabezados.indexOf('Nombre'),
    precioVenta: encabezados.indexOf('PrecioVenta')
  };

  if (idx.sku === -1 || idx.nombre === -1 || idx.precioVenta === -1) {
    throw new Error("La hoja 'Importar' debe tener al menos las columnas 'SKU', 'Nombre' y 'PrecioVenta'.");
  }
  
  // Obtener SKUs existentes para validación
  const skusExistentes = new Set(obtenerDatosHoja(SHEETS.PRODUCTOS).data.map(row => row[headers.indexOf('SKU')]));

  const productosValidos = [];
  const errores = [];
  datos.forEach((row, index) => {
    const sku = row[idx.sku];
    if (sku && row[idx.nombre]) {
      if (skusExistentes.has(sku)) {
        errores.push(`Fila ${index + 2}: SKU '${sku}' ya existe y será omitido.`);
      } else {
        let productoCompleto = {};
        encabezados.forEach((h, i) => productoCompleto[h] = row[i] || '');
        productosValidos.push(productoCompleto);
        skusExistentes.add(sku); // Añadir al set para evitar duplicados en el mismo archivo
      }
    } else {
      errores.push(`Fila ${index + 2}: Omitida por no tener SKU o Nombre.`);
    }
  });
  return { productosValidos, errores };
}

function ejecutarImportacion(productosAImportar) {
  if (!productosAImportar || productosAImportar.length === 0) {
    return "No se proporcionaron productos válidos para importar.";
  }
  
  const productosSheet = SPREADSHEET.getSheetByName(SHEETS.PRODUCTOS);
  const headers = productosSheet.getRange(1, 1, 1, productosSheet.getLastColumn()).getValues()[0];
  
  const ahora = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  const nuevasFilas = productosAImportar.map(producto => {
    // Mapear el objeto 'producto' al orden de 'headers' de la hoja principal
    return headers.map(header => {
      if (header === 'Estado' && !producto[header]) return 'Activo';
      if (header === 'FechaIngreso') return ahora;
      // Valores por defecto para números si no vienen
      if (header === 'Stock' && !producto[header]) return 0;
      if (header === 'StockMinimo' && !producto[header]) return 5;
      if (header === 'PrecioCosto' && !producto[header]) return 0;
      return producto[header] || ''; // Usar el valor del producto o ''
    });
  });

  if (nuevasFilas.length > 0) {
    productosSheet.getRange(productosSheet.getLastRow() + 1, 1, nuevasFilas.length, nuevasFilas[0].length).setValues(nuevasFilas);
  }
  
  return `¡Éxito! Se importaron ${nuevasFilas.length} productos nuevos.`;
}

function exportarInventarioCSV() {
  const inventario = obtenerInventarioCompleto();
  if (!inventario || inventario.length === 0) return '';

  // Definimos las columnas que queremos en el CSV
  const headers = [
    'SKU','Nombre','CodigoBarras','Categoria',
    'Stock','StockMinimo','PrecioCosto','PrecioVenta','ImagenURL','Estado'
  ];
  
  // Crear el contenido CSV
  const csvRows = [];
  // Añadir cabecera
  csvRows.push(headers.join(';')); 

  // Añadir filas de datos
  inventario.forEach(p => {
    const row = headers.map(h => {
      const v = p[h] == null ? '' : String(p[h]);
      // Escapar comillas dobles duplicándolas y envolver todo en comillas
      return `"${v.replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(';'));
  });

  // Unir todas las filas con salto de línea
  return csvRows.join('\r\n');
}

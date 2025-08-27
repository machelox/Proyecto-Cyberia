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

  const nuevaFila = [
    producto.SKU, producto.Nombre, producto.CodigoBarras || '', producto.Categoria,
    producto.Stock || 0, producto.StockMinimo || 5, producto.PrecioCosto || 0,
    producto.PrecioVenta, 'Activo', Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
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

function exportarInventarioCSV() {
  const inventario = obtenerInventarioCompleto();
  if (!inventario || inventario.length === 0) return '';

  const headers = [
    'SKU','Nombre','CodigoBarras','Categoria',
    'Stock','StockMinimo','PrecioCosto','PrecioVenta','ImagenURL','Estado'
  ];

  const rows = inventario.map(p => headers.map(h => {
    const v = p[h] == null ? '' : String(p[h]);
    return `"${v.replace(/"/g, '""')}"`;
  }).join(';'));

  return [headers.join(';'), ...rows].join('\r\n');
}


/**
 * Módulo de constantes globales.
 */

/**
 * Constantes globales para los nombres de las hojas.
 */
const SHEETS = {
  EMPLEADOS: 'Empleados',
  PERMISOS: 'Permisos',
  LOGS: 'Logs', // Nueva hoja para auditoría
  PRODUCTOS: 'Productos',
  CLIENTES: 'Clientes',
  VENTAS: 'Ventas',
  SALES_DETAILS: 'DetalleVentas',
  MOVIMIENTOS_INVENTARIO: 'MovimientosInventario',
  SESIONES_CAJA: 'SesionesCaja',
  MOVIMIENTOS_CAJA: 'MovimientosCaja',
  DEUDAS_CLIENTES: 'DeudasClientes',
  PAGOS: 'Pagos',
  EGRESOS: 'Egresos',
  PAGO_DEUDAS: 'PagoDeudas',
  RESUMENES_CIERRE: 'ResumenesCierre'
};

const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();
const TIMEZONE = SPREADSHEET.getSpreadsheetTimeZone();
const LOGIN_ATTEMPTS_LIMIT = 3; // Máximo de intentos de login
const LOGIN_LOCKOUT_MINUTES = 15; // Bloqueo temporal en minutos


<script>
  /**
   * =================================================================
   * CYBERIA PWA - JAVASCRIPT DEL CLIENTE
   * =================================================================
   * Este script maneja toda la interactividad de la aplicación.
   * Versión refactorizada para conectar con el backend finalizado y
   * preparar la UI para una experiencia de usuario moderna.
   */

  $(document).ready(function () {
    // ===================================================
    // 1. ESTADO GLOBAL Y VARIABLES DE COMPONENTES
    // ===================================================
    const appState = {
      user: null,
      caja: null,
      carrito: [],
      productos: [],
      theme: localStorage.getItem('theme') || 'light',
    };

    // --- Inicialización de Modales de Bootstrap ---
    // --- Declaración de Modales (Importante: usar 'let') ---
    let modalAbrirCaja = null,
      modalCerrarCaja = null,
      modalProducto = null,
      modalMovimiento = null,
      modalPrevisualizacionImportar = null,
      modalDetalleVenta = null,
      modalNuevaDeuda = null,
      modalRegistrarPago = null,
      modalRegistrarEgreso = null;

    // --- Inicialización Segura de Modales ---
    try {
      // Verificamos que el elemento exista antes de crear el Modal

      const elModalAbrirCaja = document.getElementById('modalAbrirCaja');
      if (elModalAbrirCaja) {
        modalAbrirCaja = new bootstrap.Modal(elModalAbrirCaja, {
          backdrop: 'static',
          keyboard: false,
        });
      }

      const elModalCerrarCaja = document.getElementById('modalCerrarCaja');
      if (elModalCerrarCaja) {
        modalCerrarCaja = new bootstrap.Modal(elModalCerrarCaja);
      }

      const elModalProducto = document.getElementById('modalProducto');
      if (elModalProducto) {
        modalProducto = new bootstrap.Modal(elModalProducto);
      }

      const elModalMovimiento = document.getElementById('modalMovimiento');
      if (elModalMovimiento) {
        modalMovimiento = new bootstrap.Modal(elModalMovimiento);
      }

      const elModalPrevImportar = document.getElementById(
        'modalPrevisualizacionImportar'
      );
      if (elModalPrevImportar) {
        modalPrevisualizacionImportar = new bootstrap.Modal(
          elModalPrevImportar
        );
      }

      const elModalDetalleVenta = document.getElementById('modalDetalleVenta');
      if (elModalDetalleVenta) {
        modalDetalleVenta = new bootstrap.Modal(elModalDetalleVenta);
      }

      const elModalNuevaDeuda = document.getElementById('modalNuevaDeuda');
      if (elModalNuevaDeuda) {
        modalNuevaDeuda = new bootstrap.Modal(elModalNuevaDeuda);
      }

      const elModalRegistrarPago =
        document.getElementById('modalRegistrarPago');
      if (elModalRegistrarPago) {
        modalRegistrarPago = new bootstrap.Modal(elModalRegistrarPago);
      }

      const elModalRegistrarEgreso = document.getElementById(
        'modalRegistrarEgreso'
      );
      if (elModalRegistrarEgreso) {
        modalRegistrarEgreso = new bootstrap.Modal(elModalRegistrarEgreso);
      }
    } catch (e) {
      console.error('Error inicializando modales de Bootstrap:', e);
      // Asumiendo que tiene una función showError
      // showError('Error de Interfaz', 'No se pudieron cargar componentes (modales).');
    }
    //----------------------------------------------------
    // FUNCIONES AUXILIARES (UI y HELPERS)
    //----------------------------------------------------
    /**
     * Activa el botón para mostrar/ocultar el menú lateral en vistas móviles.
     */
    function setupSidebarToggle() {
      $('#sidebarCollapse').on('click', function () {
        $('#sidebar').toggleClass('active');
      });
    }

    /**
     * Muestra u oculta el estado de carga del botón de login.
     * @param {boolean} isLoading - True para mostrar carga, false para estado normal.
     */
    function setLoginButtonState(isLoading) {
      const button = $('#loginForm button[type="submit"]');
      if (isLoading) {
        button
          .prop('disabled', true)
          .html(
            '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Verificando...'
          );
      } else {
        button.prop('disabled', false).html('Ingresar');
      }
    }

    /**
     * Muestra una alerta de error estandarizada.
     * @param {string} title - El título de la alerta.
     * @param {string} text - El texto del cuerpo de la alerta.
     */
    function showError(title, text) {
      Swal.fire({ icon: 'error', title, text });
    }

    /**
     * Muestra una notificación toast de corta duración.
     * @param {string} icon - 'success', 'error', 'warning', 'info'.
     * @param {string} title - El texto de la notificación.
     */
    function showToast(icon, title) {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({ icon, title });
    }

    /**
     * Escapa caracteres HTML para prevenir XSS al inyectar texto en el DOM.
     * @param {any} str - Valor a escapar.
     * @returns {string} Texto seguro para HTML.
     */
    function escapeHTML(str) {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /**
     * Función auxiliar para aplicar DataTables, asegurando la destrucción previa.
     * @param {string} tableId - El ID de la tabla (ej. '#tablaInventario').
     */
    function activarDataTables(tableId) {
      const table = $(tableId);
      if ($.fn.DataTable.isDataTable(table)) {
        table.DataTable().destroy();
      }
      table.DataTable({
        language: {
          url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json',
        },
        responsive: true,
        pageLength: 10,
      });
    }

    /**
     * Formatea un string de fecha-hora a un formato legible YYYY-MM-DD HH:MM:SS.
     * @param {string} fechaHoraString - El string de fecha del servidor.
     * @returns {string} La fecha formateada.
     */
    function formatearFechaHora(fechaHoraString) {
      if (!fechaHoraString) return 'Fecha inválida';
      let dateObj = fechaHoraString;
      if (!(fechaHoraString instanceof Date)) {
        dateObj = new Date(fechaHoraString);
        if (isNaN(dateObj.getTime())) return 'Fecha inválida';
      }
      const anio = dateObj.getFullYear();
      const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dia = String(dateObj.getDate()).padStart(2, '0');
      const hora = String(dateObj.getHours()).padStart(2, '0');
      const minutos = String(dateObj.getMinutes()).padStart(2, '0');
      const segundos = String(dateObj.getSeconds()).padStart(2, '0');
      return `${anio}-${mes}-${dia} ${hora}:${minutos}:${segundos}`;
    }

    /**
     * Carga la lista de clientes en cualquier <select> que se le pase.
     * @param {string} selectId - El ID del select (ej. '#selectCliente').
     */
    function cargarClientesEnSelects(selectId = '.cliente-select') {
      google.script.run
        .withSuccessHandler((clientes) => {
          const select = $(selectId)
            .empty()
            .append('<option value="varios">Cliente Varios</option>');
          clientes.forEach((cliente) => {
            select.append($('<option>').val(cliente.dni).text(cliente.texto));
          });
        })
        .obtenerClientes();
    }

    /**
     * Restringe la UI según los permisos del usuario.
     * Oculta botones, links y paneles no permitidos.
     */
    function restrictUIByPermissions() {
      if (!appState.user || !appState.user.permisos) return;

      const permisos = appState.user.permisos;

      // Mapa de módulos y acciones a elementos del DOM
      const permisosDOM = {
        Dashboard: {
          Ver: '#panelDashboard',
        },
        Ventas: {
          Ver: '#panelVentas',
          Registrar: '#btnFinalizarVenta',
          VerHistorial: '#btnHistorialVentas',
        },
        Inventario: {
          Ver: '#panelInventario',
          Registrar: '#btnAgregarProducto, #btnImportarProductos',
        },
        Pagos: {
          Ver: '#panelPagos',
          Registrar: '#btnRegistrarPago',
        },
        Deudas: {
          Ver: '#panelDeudas',
          Registrar: '#btnNuevaDeuda',
        },
        Gastos: {
          Ver: '#panelGastos',
          Registrar: '#btnRegistrarEgreso',
        },
        Reportes: {
          Ver: '#panelReportes',
        },
        Administracion: {
          Ver: '#adminSubmenu',
          GestionarEmpleados: '#panelAdminEmpleados',
          GestionarPermisos: '#panelAdminPermisos',
        },
        Caja: {
          Cerrar: '#btnCerrarCaja',
        },
      };

      // Ocultar elementos no permitidos
      Object.keys(permisosDOM).forEach((modulo) => {
        Object.keys(permisosDOM[modulo]).forEach((accion) => {
          const selector = permisosDOM[modulo][accion];
          if (permisos[modulo] && permisos[modulo][accion] === false) {
            $(selector).hide();
          } else {
            $(selector).show();
          }
        });
      });

      // Ocultar links del sidebar si el módulo no está permitido
      $('#sidebar a.nav-link').each(function () {
        const targetPanelId = $(this).data('target-panel');
        if (targetPanelId && targetPanelId.startsWith('panel')) {
          const modulo = targetPanelId.replace('panel', '');
          if (!permisos[modulo] || permisos[modulo].Ver === false) {
            $(this).hide();
          } else {
            $(this).show();
          }
        }
      });
    }

    //----------------------------------------------------
    // 2. MÓDULO DE AUTENTICACIÓN Y UI PRINCIPAL
    //----------------------------------------------------

    /**
     * Maneja el clic en el link de "Olvidé mi contraseña".
     */
    $(document).on('click', '#forgotPasswordLink', function () {
      Swal.fire({
        title: 'Restablecer Contraseña',
        html: '<input id="swal-email" class="swal2-input" placeholder="Ingresa tu email" type="email" required>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Enviar enlace',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const email = $('#swal-email').val().trim();
          if (!email) {
            Swal.showValidationMessage('El email es obligatorio');
            return false;
          }
          return email;
        },
      }).then((result) => {
        if (result.isConfirmed) {
          showToast('info', 'Enviando correo de restablecimiento...');
          google.script.run
            .withSuccessHandler((response) => {
              showToast('success', response.message);
            })
            .withFailureHandler((err) => {
              showError('Error', err.message);
            })
            .enviarResetPassword(result.value);
        }
      });
    });

    /**
     * Maneja el clic en el botón de guardar cambios de permisos.
     */
    $(document).on('click', '#btnGuardarPermisos', function () {
      const btn = $(this);
      const rol = btn.data('rol');
      const permisosCambiados = [];

      $('#tablaPermisos tbody input[type="checkbox"]').each(function () {
        const checkbox = $(this);
        permisosCambiados.push({
          modulo: checkbox.data('modulo'),
          accion: checkbox.data('accion'),
          permitido: checkbox.is(':checked'),
        });
      });

      btn
        .prop('disabled', true)
        .html(
          '<span class="spinner-border spinner-border-sm"></span> Guardando...'
        );

      google.script.run
        .withSuccessHandler((res) => {
          showToast('success', res.message);
          cargarRolesParaPermisos();
          btn.prop('disabled', false).html('Guardar Cambios');
        })
        .withFailureHandler((err) => {
          showError('Error al guardar permisos', err.message);
          btn.prop('disabled', false).html('Guardar Cambios');
        })
        .guardarPermisos(rol, permisosCambiados);
    });

    /**
     * Maneja el clic en el botón para registrar un nuevo cliente.
     */
    $(document).on('click', '#btnNuevoCliente', function () {
      Swal.fire({
        title: 'Registrar Nuevo Cliente',
        html: `
          <input id="swal-dni" class="swal2-input" placeholder="DNI" required>
          <input id="swal-nombres" class="swal2-input" placeholder="Nombres y Apellidos" required>
          <input id="swal-alias" class="swal2-input" placeholder="Alias (opcional)">
          <input id="swal-email" class="swal2-input" type="email" placeholder="Email (opcional)">
          <input id="swal-celular" class="swal2-input" type="tel" placeholder="Celular (opcional)">`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cliente',
        preConfirm: () => {
          const dni = $('#swal-dni').val().trim();
          const nombres = $('#swal-nombres').val().trim();
          if (!dni || !nombres) {
            Swal.showValidationMessage('DNI y Nombres son obligatorios');
            return false;
          }
          return {
            dni,
            nombres,
            alias: $('#swal-alias').val().trim(),
            email: $('#swal-email').val().trim(),
            celular: $('#swal-celular').val().trim(),
          };
        },
      }).then((result) => {
        if (result.isConfirmed) {
          google.script.run
            .withSuccessHandler((clienteRegistrado) => {
              showToast('success', '¡Cliente registrado!');
              cargarClientesEnSelects();
              setTimeout(
                () => $('#selectCliente').val(clienteRegistrado.dni),
                500
              );
            })
            .withFailureHandler((err) =>
              showError('Error al registrar', err.message)
            )
            .registrarNuevoCliente(result.value);
        }
      });
    });

    /**
     * Maneja el clic en el botón para ver el historial de ventas.
     */
    $(document).on('click', '#btnHistorialVentas', function () {
      const panelVenta = $('#panelVentas');
      const panelHistorial = $('#panelHistorial');

      panelVenta.hide();
      panelHistorial.fadeIn();

      $('#tabHistorialOrdenes').click();
      cargarHistorialVentas();
      panelHistorial.addClass('loaded');
    });

    //----------------------------------------------------
    // NAVEGACIÓN PRINCIPAL Y CARGA DE PANELES
    //----------------------------------------------------

    /**
     * Gestiona los clics en el menú lateral para cambiar entre paneles.
     */
    $('#sidebar').on('click', 'a.nav-link', function (e) {
      e.preventDefault();

      const targetPanelId = $(this).data('target-panel');
      if (!targetPanelId) return;

      $('#sidebar a.nav-link').removeClass('active');
      $(this).addClass('active');

      $('.content-panel').hide();
      const panel = $('#' + targetPanelId);
      panel.fadeIn(400);

      if (!panel.hasClass('loaded')) {
        switch (targetPanelId) {
          case 'panelInventario':
            cargarModuloInventario();
            break;
          case 'panelVentas':
            if (appState.productos.length === 0) {
              cargarProductosParaVenta();
              cargarClientesEnSelects();
            }
            break;
          case 'panelPagos':
              initPagosYape();
              break;
          case 'panelGastos':
            cargarHistorialEgresos();
            break;
          case 'panelDeudas':
            $('#tabDeudasPendientes').click();
            break;
          case 'panelAdminEmpleados':
            cargarPanelGestionEmpleados();
            break;
          case 'panelAdminPermisos':
            cargarRolesParaPermisos();
            break;
        }
        panel.addClass('loaded');
      }
    });

    //----------------------------------------------------
    // 2. MÓDULO DE AUTENTICACIÓN Y UI PRINCIPAL
    //----------------------------------------------------

    /**
     * Maneja el envío del formulario de login.
     */
    $('#loginForm').on('submit', function (event) {
      event.preventDefault();
      const email = $('#username').val().trim();
      const password = $('#password').val().trim();

      if (!email || !password) {
        showError('Campos vacíos', 'Por favor, ingresa tu email y contraseña.');
        return;
      }

      setLoginButtonState(true);

      google.script.run
        .withSuccessHandler(onLoginSuccess)
        .withFailureHandler(onLoginFailure)
        .iniciarSesion(email, password); // Llama a la nueva función del backend
    });

    /**
     * Se ejecuta cuando el login es exitoso.
     * @param {object} userData - El objeto completo del usuario devuelto por el backend.
     */
    function onLoginSuccess(userData) {
      setLoginButtonState(false);

      if (userData && userData.permisos) {
        appState.user = userData;
        Swal.fire({
          icon: 'success',
          title: '¡Bienvenido/a, ' + userData.nombre + '!',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2500,
          timerProgressBar: true,
        }).then(() => {
          $('#loginPage').fadeOut(() => {
            setupMainApp(); // Configura la app con los nuevos datos y permisos
            $('#mainApp').fadeIn();
            verificarEstadoDeCajaAlCargar();
          });
        });
      } else {
        showError(
          'Acceso Denegado',
          'Email o contraseña incorrectos, o usuario inactivo.'
        );
      }
    }

    /**
     * Se ejecuta cuando el login falla en el servidor.
     */
    function onLoginFailure(error) {
      setLoginButtonState(false);
      showError(
        'Error del Servidor',
        'Ocurrió un error al iniciar sesión: ' + error.message
      );
    }

    /**
     * Maneja el evento de logout.
     */
    $('#logoutLink').on('click', function (e) {
      e.preventDefault();
      Swal.fire({
        title: '¿Cerrar sesión?',
        text: '¿Estás seguro de que deseas salir?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          // location.reload() es la forma más limpia y segura de resetear todo.
          location.reload();
        }
      });
    });

    /**
     * Configura la aplicación principal después de un login exitoso.
     */
    function setupMainApp() {
      // Llenar datos del usuario en la UI
      $('#user-name').text(appState.user.nombre);
      $('#user-email').text(appState.user.email);
      // $('#user-img').attr('src', appState.user.imagen || 'URL_IMAGEN_POR_DEFECTO');

      // Aplicar el tema (oscuro/claro) guardado
      applyTheme(appState.theme);

      // Activa la funcionalidad del menú lateral
      setupSidebarToggle();

      // Configurar la visibilidad de CADA elemento según los permisos granulares
      setupPermissions();
    }

    /**
     * ★★★ LÓGICA DE PERMISOS REFACTORIZADA (Y CORREGIDA) ★★★
     * Recorre los permisos del usuario y muestra u oculta elementos de la UI.
     * Combina la lógica de [data-perm] (para botones) y [data-target-panel] (para sidebar).
     */
    function setupPermissions() {
      const permisos = appState.user.permisos;
      if (!permisos) {
        console.error('setupPermissions: No hay permisos en appState.user');
        return;
      } // 1. Ocultar TODO lo que tenga [data-perm] (botones, etc.)

      $('[data-perm]').hide(); // --- [INICIO DE CORRECCIÓN - PROBLEMA 2] ---
      // 2. Ocultar TODOS los links del sidebar que dependen de permisos
      // (Usamos 'default-deny': ocultar primero, mostrar después)

      $('#sidebar a.nav-link[data-target-panel]').hide(); // Ocultar el 'padre' del submenú
      $('#sidebar a.nav-link[href="#adminSubmenu"]').hide(); // --- [FIN DE CORRECCIÓN] ---
      // 3. Recorrer los permisos del usuario y mostrar los elementos [data-perm] permitidos
      for (const modulo in permisos) {
        // Asegurarse de que 'permisos[modulo]' sea un objeto
        if (typeof permisos[modulo] !== 'object' || permisos[modulo] === null)
          continue;

        for (const accion in permisos[modulo]) {
          if (permisos[modulo][accion] === true) {
            // Muestra el elemento que coincide exactamente con "Modulo.Accion"
            $(`[data-perm="${modulo}.${accion}"]`).show();
          }
        }
      } // --- [INICIO DE CORRECCIÓN - PROBLEMA 2] ---
      // 4. Recorrer los links del SIDEBAR y mostrar solo los permitidos

      $('#sidebar a.nav-link[data-target-panel]').each(function () {
        const $link = $(this);
        const targetPanelId = $link.data('target-panel'); // ej: "panelInventario"
        let modulo, accion; // Lógica especial para los paneles de administración
        // (Sus IDs de panel no coinciden con el nombre del Módulo)

        if (targetPanelId === 'panelAdminEmpleados') {
          modulo = 'Administracion';
          accion = 'GestionarEmpleados';
        } else if (targetPanelId === 'panelAdminPermisos') {
          modulo = 'Administracion';
          accion = 'GestionarPermisos';
        } else {
          // Lógica estándar (ej: 'panelInventario' -> 'Inventario')
          modulo = targetPanelId.replace('panel', ''); // Asumimos que el link del menú principal requiere el permiso 'Ver'
          // (Usamos 'Ver' con mayúscula, como arreglamos en el bug anterior)
          accion = 'Ver';
        } // Comprobamos el permiso

        if (permisos[modulo] && permisos[modulo][accion] === true) {
          $link.show(); // Si es un link de admin, también mostramos el 'padre' del submenú

          if (modulo === 'Administracion') {
            $('#sidebar a.nav-link[href="#adminSubmenu"]').show();
          }
        }
      }); // --- [FIN DE CORRECCIÓN] ---
    }

    //----------------------------------------------------
    // 3. MÓDULO DE GESTIÓN DE APARIENCIA (TEMA)
    //----------------------------------------------------

    /**
     * Aplica el tema (claro u oscuro) a la aplicación.
     * @param {string} theme - El nombre del tema ('light' o 'dark').
     */
    function applyTheme(theme) {
      $('body')
        .removeClass('light-theme dark-theme')
        .addClass(theme + '-theme');
      appState.theme = theme;
      localStorage.setItem('theme', theme);

      // Actualizar el ícono del botón (ejemplo)
      if (theme === 'dark') {
        $('#btnToggleTheme i')
          .removeClass('bi-moon-stars-fill')
          .addClass('bi-sun-fill');
      } else {
        $('#btnToggleTheme i')
          .removeClass('bi-sun-fill')
          .addClass('bi-moon-stars-fill');
      }
    }

    /**
     * Evento para el botón que cambia entre modo oscuro y claro.
     */
    $('#btnToggleTheme').on('click', function () {
      const newTheme = appState.theme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
    });

    //----------------------------------------------------
    // 4. MÓDULO DE ADMINISTRACIÓN (CONTENEDOR)
    //----------------------------------------------------

    // Este es el nuevo enfoque. En lugar de un solo panel, tendremos
    // botones que abren paneles específicos para cada tarea de admin.

    $('#btnGestionarEmpleados').on('click', function () {
      // Aquí irá la lógica para abrir el panel de CRUD de empleados
      // Ejemplo: showPanel('panel-empleados');
      cargarPanelGestionEmpleados();
    });

    $('#btnGestionarPermisos').on('click', function () {
      // Aquí irá la lógica para abrir el panel de gestión de permisos por ROL
      // Ejemplo: showPanel('panel-permisos');
      // cargarPanelGestionPermisos();
    });

    // (Las funciones cargarPanelGestionEmpleados y cargarPanelGestionPermisos
    // serán entregadas en el siguiente módulo para mantener el orden).

    //----------------------------------------------------
    // 5. MÓDULO DE GESTIÓN DE EMPLEADOS (CRUD)
    //----------------------------------------------------

    /**
     * Carga el panel de gestión de empleados, obteniendo los datos
     * frescos desde el servidor y renderizándolos en una tabla.
     */
    function cargarPanelGestionEmpleados() {
      const panel = $('#panelGestionEmpleados'); // Asegúrate de tener este ID en tu HTML
      const contenido = $('#contenidoEmpleados'); // Y un div dentro del panel para la tabla

      // Muestra el panel y un estado de carga
      panel.slideDown();
      contenido.html(
        '<div class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div></div>'
      );

      google.script.run
        .withSuccessHandler(renderizarTablaEmpleados)
        .withFailureHandler((err) =>
          showError('Error al Cargar Empleados', err.message)
        )
        .obtenerEmpleados();
    }

    /**
     * Carga los roles únicos de la hoja 'Permisos' y llena el select.
     */
    function cargarRolesParaPermisos() {
      const selectRol = $('#selectRol');
      selectRol
        .empty()
        .append('<option value="">Selecciona un Rol...</option>');

      // Aquí llamaremos a la función del backend para obtener los roles.
      // Esta función no existe todavía, así que la crearemos después.
      google.script.run
        .withSuccessHandler((roles) => {
          roles.forEach((rol) => {
            selectRol.append($('<option>').val(rol).text(rol));
          });
          // Ocultar el spinner una vez que los roles estén cargados
          $('#contenidoPermisos').empty();
        })
        .withFailureHandler((err) => {
          showError('Error al cargar roles', err.message);
          selectRol.empty().append('<option value="">Error al cargar</option>');
        })
        .obtenerRolesUnicos(); // Llamada a la función que crearemos en codigo.gs
    }

    /**
     * Dibuja la tabla de empleados con los datos recibidos del servidor.
     * @param {Array<object>} empleados - El array de objetos de empleado.
     */
    function renderizarTablaEmpleados(empleados) {
      const contenido = $('#contenidoEmpleados').empty();
      const tablaHtml = `
      <div class="d-flex justify-content-end mb-3">
          <button id="btnCrearEmpleado" class="btn btn-primary" data-perm="Admin.crear_empleado"><i class="bi bi-person-plus-fill me-2"></i>Crear Nuevo Empleado</button>
      </div>
      <div class="table-responsive">
          <table id="tablaEmpleados" class="table table-striped table-hover w-100">
              <thead>
                  <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                  </tr>
              </thead>
              <tbody></tbody>
          </table>
      </div>
    `;
      contenido.html(tablaHtml);

      const tbody = $('#tablaEmpleados tbody');
      empleados.forEach((emp) => {
        const estadoBadge =
          emp.estado === 'Activo'
            ? `<span class="badge bg-success">${emp.estado}</span>`
            : `<span class="badge bg-secondary">${emp.estado}</span>`;

        const tr = $(`
        <tr>
          <td>${emp.nombre}</td>
          <td>${emp.email}</td>
          <td>${emp.rol}</td>
          <td>${estadoBadge}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary btn-editar-empleado" title="Editar Datos"><i class="bi bi-pencil-square"></i></button>
            <button class="btn btn-sm btn-outline-secondary btn-cambiar-pass" title="Cambiar Contraseña"><i class="bi bi-key-fill"></i></button>
            ${emp.estado === 'Activo' ? `<button class="btn btn-sm btn-outline-danger btn-desactivar-empleado" title="Desactivar Usuario"><i class="bi bi-person-x-fill"></i></button>` : ''}
          </td>
        </tr>
      `);

        // Guardamos el objeto completo del empleado en la fila para un acceso fácil
        tr.data('empleado', emp);
        tbody.append(tr);
      });

      // Re-aplicamos los permisos por si el botón de crear estaba oculto
      setupPermissions();
      activarDataTables('#tablaEmpleados');
    }

    /**
     * Abre un modal para crear o editar un empleado.
     * @param {object|null} empleado - El objeto del empleado para editar, o null para crear.
     */
    function abrirModalEmpleado(empleado = null) {
      const esEdicion = empleado !== null;
      const titulo = esEdicion ? 'Editar Empleado' : 'Crear Nuevo Empleado';

      Swal.fire({
        title: titulo,
        html: `
        <input type="hidden" id="swal-id" value="${esEdicion ? empleado.empleadoId : ''}">
        <input id="swal-nombre" class="swal2-input" placeholder="Nombre completo" value="${esEdicion ? empleado.nombre : ''}" required>
        <input id="swal-email" class="swal2-input" type="email" placeholder="Email (será su usuario)" value="${esEdicion ? empleado.email : ''}" ${esEdicion ? 'disabled' : 'required'}>
        <select id="swal-rol" class="swal2-select">
          <option value="Empleado" ${esEdicion && empleado.rol === 'Empleado' ? 'selected' : ''}>Empleado</option>
          <option value="Administrador" ${esEdicion && empleado.rol === 'Administrador' ? 'selected' : ''}>Administrador</option>
        </select>
        ${!esEdicion ? '<input id="swal-password" class="swal2-input" type="password" placeholder="Contraseña" required>' : ''}
      `,
        confirmButtonText: 'Guardar',
        showCancelButton: true,
        focusConfirm: false,
        preConfirm: () => {
          const data = {
            nombre: $('#swal-nombre').val().trim(),
            email: $('#swal-email').val().trim(),
            rol: $('#swal-rol').val(),
          };
          if (esEdicion) {
            data.empleadoId = $('#swal-id').val();
          } else {
            data.password = $('#swal-password').val();
            if (!data.password) {
              Swal.showValidationMessage(
                'La contraseña es obligatoria para nuevos empleados.'
              );
              return false;
            }
          }
          if (!data.nombre || !data.email) {
            Swal.showValidationMessage('Nombre y Email son obligatorios.');
            return false;
          }
          return data;
        },
      }).then((result) => {
        if (result.isConfirmed) {
          const accion = esEdicion ? 'EDITAR' : 'CREAR';
          google.script.run
            .withSuccessHandler((res) => {
              showToast('success', res.message);
              cargarPanelGestionEmpleados(); // Recargar la tabla
            })
            .withFailureHandler((err) =>
              showError('Error al guardar', err.message)
            )
            .gestionarEmpleado(result.value, accion);
        }
      });
    }

    // --- MANEJADORES DE EVENTOS PARA EL CRUD ---

    // Crear Empleado
    $(document).on('click', '#btnCrearEmpleado', function () {
      abrirModalEmpleado(null);
    });

    // Editar Empleado
    $(document).on('click', '.btn-editar-empleado', function () {
      const empleado = $(this).closest('tr').data('empleado');
      abrirModalEmpleado(empleado);
    });

    // Desactivar Empleado
    $(document).on('click', '.btn-desactivar-empleado', function () {
      const empleado = $(this).closest('tr').data('empleado');
      Swal.fire({
        title: '¿Desactivar Empleado?',
        text: `¿Estás seguro de que quieres desactivar a ${empleado.nombre}? Ya no podrá iniciar sesión.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, desactivar',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          google.script.run
            .withSuccessHandler((res) => {
              showToast('success', res.message);
              cargarPanelGestionEmpleados();
            })
            .withFailureHandler((err) => showError('Error', err.message))
            .gestionarEmpleado(
              { empleadoId: empleado.empleadoId },
              'DESACTIVAR'
            );
        }
      });
    });

    // Cambiar Contraseña
    $(document).on('click', '.btn-cambiar-pass', function () {
      const empleado = $(this).closest('tr').data('empleado');
      Swal.fire({
        title: `Cambiar Contraseña de ${empleado.nombre}`,
        input: 'password',
        inputPlaceholder: 'Ingresa la nueva contraseña',
        inputAttributes: {
          autocapitalize: 'off',
          autocorrect: 'off',
        },
        showCancelButton: true,
        confirmButtonText: 'Cambiar',
        inputValidator: (value) => {
          if (!value || value.length < 4) {
            return 'La contraseña debe tener al menos 4 caracteres.';
          }
        },
      }).then((result) => {
        if (result.isConfirmed) {
          google.script.run
            .withSuccessHandler((res) => showToast('success', res.message))
            .withFailureHandler((err) => showError('Error', err.message))
            .cambiarPassword(empleado.empleadoId, result.value);
        }
      });
    });

    /**
     * Maneja el cambio de selección en el dropdown de roles para cargar sus permisos.
     */
    $('#selectRol').on('change', function () {
      const rolSeleccionado = $(this).val();
      const contenedor = $('#contenidoPermisos');

      if (rolSeleccionado) {
        contenedor.html(
          '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p>Cargando permisos del rol...</p></div>'
        );
        google.script.run
          .withSuccessHandler((permisos) =>
            renderizarTablaPermisos(rolSeleccionado, permisos)
          )
          .withFailureHandler((err) =>
            showError('Error al cargar permisos', err.message)
          )
          .obtenerPermisosPorRol(rolSeleccionado);
      } else {
        contenedor.empty(); // Limpiar si no hay rol seleccionado
      }
    });

    /**
     * Dibuja la tabla de permisos para el rol seleccionado.
     * @param {string} rol El rol para el que se muestran los permisos.
     * @param {Array<object>} permisos El array de permisos del backend.
     */
    function renderizarTablaPermisos(rol, permisos) {
      const contenedor = $('#contenidoPermisos').empty();

      const tablaHtml = `
          <div class="table-responsive">
              <table id="tablaPermisos" class="table table-striped table-hover w-100">
                  <thead>
                      <tr>
                          <th>Módulo</th>
                          <th>Acción</th>
                          <th>Permitido</th>
                      </tr>
                  </thead>
                  <tbody></tbody>
              </table>
          </div>
          <div class="d-grid mt-3">
              <button id="btnGuardarPermisos" class="btn btn-primary" data-rol="${rol}">Guardar Cambios</button>
          </div>
      `;
      contenedor.html(tablaHtml);

      const tbody = $('#tablaPermisos tbody');
      permisos.forEach((permiso) => {
        const checked = permiso.permitido ? 'checked' : '';
        let disabled = ''; // Variable para controlar el estado 'disabled'

        // Lógica para proteger los permisos críticos del Administrador
        // Se aplicará solo si el rol es 'Administrador'
        if (rol === 'Administrador') {
          if (
            (permiso.modulo === 'Admin' &&
              permiso.accion === 'gestionar_permisos') ||
            (permiso.modulo === 'Dashboard' && permiso.accion === 'ver')
          ) {
            disabled = 'disabled';
          }
        }

        const tr = $(`
              <tr>
                  <td>${permiso.modulo}</td>
                  <td>${permiso.accion}</td>
                  <td>
                      <div class="form-check form-switch">
                          <input class="form-check-input" type="checkbox" role="switch"
                                data-modulo="${permiso.modulo}" data-accion="${permiso.accion}"
                                ${checked} ${disabled}>
                      </div>
                  </td>
              </tr>
          `);
        tbody.append(tr);
      });

      activarDataTables('#tablaPermisos');
    }

    //----------------------------------------------------
    // 9. MÓDULO DE INVENTARIO (CON CRUD COMPLETO)
    //----------------------------------------------------
    let inventarioCompleto = []; // Caché para la lista de productos

    // --- Utilidades de números/moneda (región es-PE + PEN) ---
    const toNumber = (v) =>
      Number(
        String(v ?? '')
          .toString()
          .replace(',', '.')
      ) || 0;
    const formatPEN = (n) =>
      new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
      }).format(n || 0);

    // Escapar valor para usar en regex de DataTables
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // --- Carga y Renderizado de la UI ---
    function cargarModuloInventario() {
      console.log('DEBUG: 1. Iniciando cargarModuloInventario()');
      if (
        appState.user &&
        appState.user.permisos?.Inventario &&
        appState.user.permisos.Inventario.Ver
      ) {
        console.log('DEBUG: 2. Permisos APROBADOS. Llamando a backend...');
        google.script.run
          .withSuccessHandler((inventario) => {
            console.log('DEBUG: 3. Backend SUCCESS. Datos recibidos:', inventario);
            inventarioCompleto = inventario || [];
            renderizarTablaInventario(inventarioCompleto);
            actualizarDashboardInventario(inventarioCompleto);
            cargarFiltrosInventario(inventarioCompleto);

            // Llenar datalist de SKUs si existe en el DOM
            const $listaSkus = $('#listaSkus');
            if ($listaSkus.length) {
              $listaSkus.empty();
              inventarioCompleto.forEach((p) =>
                $listaSkus.append(
                  `<option value="${p.SKU}">${p.Nombre}</option>`
                )
              );
            }
          })
          .withFailureHandler((err) =>{
            console.error('DEBUG: 3. Backend FAILURE.', err); // <-- AÑADIR
            showError('Error al cargar inventario', err?.message || String(err))
          })
          .obtenerInventarioCompleto();
      } else {
          // ESTA ES LA CAUSA MÁS PROBABLE DE LA FALLA SILENCIOSA
          console.warn('DEBUG: 2. Permisos DENEGADOS o appState no listo. Carga abortada.'); // <-- AÑADIR
          console.log('DEBUG: Estado de appState.user:', appState.user); // <-- AÑADIR
          console.log('DEBUG: appState.user.permisos (Objeto completo):', appState.user.permisos);
          console.log('DEBUG: Buscando appState.user.permisos.Inventario:', appState.user.permisos?.Inventario);
          console.log('DEBUG: Buscando appState.user.permisos.Inventario.Ver:', appState.user.permisos?.Inventario?.Ver);
        }
    }

    /**
     * Llena los selectores de filtro con las categorías y estados del inventario.
     * @param {Array<object>} inventario - El array completo de productos.
     */
    function cargarFiltrosInventario(inventario) {
      // Rellenar el filtro de categorías
      const categorias = new Set(
        inventario.map((p) => p.Categoria).filter(Boolean)
      );
      const $selectCategoria = $('#filtroCategoria')
        .empty()
        .append('<option value="Todos">Todas</option>');
      categorias.forEach((cat) =>
        $selectCategoria.append(`<option value="${cat}">${cat}</option>`)
      );
    }

    // Mantener una única instancia de DataTable
    let tablaDT = null;

    function renderizarTablaInventario(inventario) {
      // Usamos la tabla existente en el HTML (#tablaInventario)
      // y la llenamos con DataTables basados en data[]
      const dataTableData = (inventario || []).map((p) => {
        const stock = toNumber(p.Stock);
        const stockMin = toNumber(p.StockMinimo);
        const precioCosto = toNumber(p.PrecioCosto);
        const precioVenta = toNumber(p.PrecioVenta);
        const valorStock = stock * precioCosto;

        let claseFila = '';
        const estado = String(p.Estado || '').trim();
        if (estado === 'Activo') {
          if (stock <= 0) claseFila = 'table-danger';
          else if (stock <= stockMin) claseFila = 'table-warning';
        } else {
          claseFila = 'table-secondary';
        }

        // Array alineado a las columnas visibles + 2 auxiliares ocultas
        return [
          p.SKU,
          p.Nombre,
          p.CodigoBarras || 'N/A',
          p.Categoria || '',
          stock, // num para ordenar
          stockMin, // num para ordenar
          precioCosto, // num para ordenar
          precioVenta, // num para ordenar
          valorStock, // num para ordenar
          // Acciones (HTML)
          // Usamos una IIFE (función autoejecutable) para construir el HTML
          // basado en los permisos del usuario logueado (appState).
            (() => {
            // Obtenemos los permisos de inventario (o un objeto vacío si no existen)
            const permisos = appState.user.permisos?.Inventario || {};

            let botonesHtml = '<div class="btn-group" role="group">';
   
            // Botón Ver Historial (Requiere permiso 'Ver')
            // Nota: Usamos 'Ver' con mayúscula, como vimos en la consola
            if (permisos.Ver) {
               botonesHtml += `<button class="btn btn-sm btn-outline-info ver-historial-producto" title="Ver Historial (Kardex)"><i class="bi bi-list-ol"></i></button>`;
            }

             // Botón Editar (Requiere permiso 'Editar')
            if (permisos.Editar) {
              botonesHtml += `<button class="btn btn-sm btn-outline-primary btn-editar-producto" title="Editar Producto"><i class="bi bi-pencil-square"></i></button>`;
            }

            // Botón Desactivar (Requiere 'Eliminar' y que el producto esté Activo)
            if (permisos.Eliminar && estado === 'Activo') {
              botonesHtml += `<button class="btn btn-sm btn-outline-danger btn-desactivar-producto" title="Desactivar Producto"><i class="bi bi-slash-circle"></i></button>`;
            }

            botonesHtml += '</div>';
            return botonesHtml;
          })(),
          p, // 10: objeto producto (oculto)
          claseFila, // 11: clase fila (oculto)
        ];
      });

      if (tablaDT) {
        tablaDT.clear();
        tablaDT.rows.add(dataTableData).draw();
        return;
      }

      tablaDT = $('#tablaInventario').DataTable({
        data: dataTableData,
        language: {
          url: '//cdn.datatables.net/plug-ins/1.10.25/i18n/Spanish.json',
        },
        columns: [
          { title: 'SKU' },
          { title: 'Nombre' },
          { title: 'Código Barras' },
          { title: 'Categoría' },
          // Render numéricos con formato para display pero manteniendo sort por valor
          {
            title: 'Stock',
            render: (d, t) =>
              t === 'display'
                ? `<span class="fw-bold ${d <= 0 ? 'text-danger' : ''}">${d}</span>`
                : d,
          },
          {
            title: 'Stock Mínimo',
            render: (d, t) => (t === 'display' ? `${d}` : d),
          },
          {
            title: 'Precio Costo',
            render: (d, t) => (t === 'display' ? `${formatPEN(d)}` : d),
          },
          {
            title: 'Precio Venta',
            render: (d, t) => (t === 'display' ? `${formatPEN(d)}` : d),
          },
          {
            title: 'Valor Stock',
            render: (d, t) => (t === 'display' ? `${formatPEN(d)}` : d),
          },
          { title: 'Acciones', orderable: false, searchable: false },
          { visible: false, searchable: false }, // objeto producto
          { visible: false, searchable: false }, // clase fila
        ],
        createdRow: function (row, data) {
          $(row).addClass(data[11]);
          $(row).data('producto', data[10]);
        },
      });

      // Filtro por Categoría (col 3) con match exacto, escapando regex
      $('#filtroCategoria')
        .off('change')
        .on('change', function () {
          const v = this.value;
          if (!v || v === 'Todos') {
            // 'Todos' también debe limpiar el filtro
            tablaDT.column(3).search('').draw();
          } else {
            tablaDT
              .column(3)
              .search(`^${escapeRegex(v)}$`, true, false)
              .draw();
          }
        });

      // Filtro por Estado (custom) solo para esta tabla
      let estadoFiltro = '';
      let estadoFiltroRegistrado = false;
      const filtroEstadoFn = function (settings, data, dataIndex) {
        if (!estadoFiltro || estadoFiltro === 'Todos') return true; // 'Todos' también es sin filtro
        // limitar al id de nuestra tabla
        if (settings.nTable && settings.nTable.id !== 'tablaInventario')
          return true;
        const producto = tablaDT.row(dataIndex).data()?.[10] || {};
        const stock = toNumber(data[4]);
        const stockMin = toNumber(data[5]);
        const activo = String(producto.Estado || '').trim() === 'Activo';
        if (estadoFiltro === 'BajoStock') return activo && stock <= stockMin;
        if (estadoFiltro === 'Activo') return activo;
        if (estadoFiltro === 'Inactivo') return !activo;
        return true;
      };

      if (!estadoFiltroRegistrado) {
        $.fn.dataTable.ext.search.push(filtroEstadoFn);
        estadoFiltroRegistrado = true;
      }

      $('#filtroEstado')
        .off('change')
        .on('change', function () {
          estadoFiltro = this.value || '';
          tablaDT.draw();
        });
    }

    function actualizarDashboardInventario(inventario) {
      const inventarioActivo = inventario.filter((p) => p.Estado === 'Activo');

      const valorTotal = inventarioActivo.reduce(
        (sum, p) => sum + Number(p.Stock) * Number(p.PrecioCosto),
        0
      );

      const itemsBajoStock = inventarioActivo.filter(
        (p) => Number(p.Stock) <= Number(p.StockMinimo) && Number(p.Stock) > 0
      ).length;

      const skusUnicosActivos = inventarioActivo.length;

      $('#valorTotalInventario').text(formatPEN(valorTotal));
      $('#totalSkus').text(skusUnicosActivos);
      $('#itemsStockBajo').text(itemsBajoStock);
    }

    function abrirModalProducto(producto = null) {
      // --- [CORRECCIÓN] Verificación de Modal ---
      if (!modalProducto) {
        // Usamos la función 'showError' que definiste en otro módulo
        if (typeof showError === 'function') {
          showError('Error de UI', 'El modal de producto no está disponible.');
        } else {
          alert('Error: El modal de producto no está disponible.');
        }
        return;
      }
      // --- Fin Corrección ---

      const esEdicion = producto !== null;
      $('#formProducto')[0].reset();

      $('#modalProductoLabel').text(
        esEdicion ? 'Editar Producto' : 'Agregar Nuevo Producto'
      );
      $('#prodSku').prop('disabled', esEdicion);

      // Cargar categorías primero
      google.script.run
        .withSuccessHandler((categorias) => {
          const select = $('#prodCategoria')
            .empty()
            .append('<option value="">Seleccione o cree una...</option>');
          categorias.forEach((cat) =>
            select.append(`<option value="${cat}">${cat}</option>`)
          );

          // Si es edición, rellenar datos después de cargar categorías
          if (esEdicion) {
            $('#prodSku').val(producto.SKU);
            $('#prodNombre').val(producto.Nombre);
            $('#prodCodigoBarras').val(producto.CodigoBarras);
            $('#prodStock').val(producto.Stock).prop('disabled', true);
            $('#prodStockMin').val(producto.StockMinimo);
            $('#prodPrecioCosto').val(producto.PrecioCosto);
            $('#prodPrecioVenta').val(producto.PrecioVenta);
            $('#prodImagenUrl').val(producto.ImagenURL);
            $('#prodCategoria').val(producto.Categoria); // Seleccionar la categoría
          } else {
            $('#prodStock').prop('disabled', false);
          }
        })
        .obtenerCategoriasUnicas();

      modalProducto.show();
    }

    // --- Manejadores de Eventos ---

    $('#btnVerInventario').on('click', function () {
      const panel = $('#panelInventario');
      panel.slideToggle();
      if (panel.is(':visible') && inventarioCompleto.length === 0) {
        cargarModuloInventario();
      }
    });

    $('#btnAgregarProducto').on('click', function () {
      abrirModalProducto(null);
    });

    $(document).on('click', '.btn-editar-producto', function () {
      const producto = $(this).closest('tr').data('producto');
      abrirModalProducto(producto);
    });

    $(document).on('click', '.btn-desactivar-producto', function () {
      const producto = $(this).closest('tr').data('producto');
      Swal.fire({
        title: '¿Desactivar Producto?',
        text: `El producto "${producto.Nombre}" ya no aparecerá en ventas. ¿Continuar?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, desactivar',
      }).then((result) => {
        if (result.isConfirmed) {
          google.script.run
            .withSuccessHandler((res) => {
              showToast('success', res.message);
              cargarModuloInventario();
            })
            .withFailureHandler((err) => showError('Error', err.message))
            .gestionarProducto({ SKU: producto.SKU }, 'DESACTIVAR');
        }
      });
    });

    $('#formProducto').on('submit', function (e) {
      e.preventDefault();
      // --- [CORRECCIÓN] Verificación de Modal ---
      if (!modalProducto) {
        if (typeof showError === 'function') {
          showError('Error de UI', 'El modal de producto no está disponible.');
        } else {
          alert('Error: El modal de producto no está disponible.');
        }
        return;
      }
      // --- Fin Corrección ---

      const esEdicion = $('#prodSku').is(':disabled');

      const productoData = {
        SKU: $('#prodSku').val(),
        Nombre: $('#prodNombre').val(),
        CodigoBarras: $('#prodCodigoBarras').val(),
        Categoria: $('#prodCategoria').val(),
        StockMinimo: Number($('#prodStockMin').val()),
        PrecioCosto: Number($('#prodPrecioCosto').val()),
        PrecioVenta: Number($('#prodPrecioVenta').val()),
        ImagenURL: $('#prodImagenUrl').val(),
      };

      if (esEdicion) {
        google.script.run
          .withSuccessHandler((res) => {
            showToast('success', res.message);
            modalProducto.hide();
            cargarModuloInventario();
          })
          .withFailureHandler((err) =>
            showError('Error al actualizar', err.message)
          )
          .gestionarProducto(productoData, 'EDITAR');
      } else {
        productoData.Stock = Number($('#prodStock').val());
        google.script.run
          .withSuccessHandler((res) => {
            showToast('success', 'Producto guardado correctamente');
            modalProducto.hide();
            cargarModuloInventario();
          })
          .withFailureHandler((err) => showError('Error al crear', err.message))
          .agregarProductoNuevo(productoData);
      }
    });

    $('#btnRegistrarMovimiento').on('click', function () {
      // --- [CORRECCIÓN] Verificación de Modal ---
      if (!modalMovimiento) {
        if (typeof showError === 'function') {
          showError(
            'Error de UI',
            'El modal de movimiento no está disponible.'
          );
        } else {
          alert('Error: El modal de movimiento no está disponible.');
        }
        return;
      }
      // --- Fin Corrección ---
      $('#formMovimiento')[0].reset();
      modalMovimiento.show();
    });

    $('#formMovimiento').on('submit', function (e) {
      e.preventDefault();
      // --- [CORRECCIÓN] Verificación de Modal ---
      if (!modalMovimiento) {
        if (typeof showError === 'function') {
          showError(
            'Error de UI',
            'El modal de movimiento no está disponible.'
          );
        } else {
          alert('Error: El modal de movimiento no está disponible.');
        }
        return;
      }
      // --- Fin Corrección ---

      const movimiento = {
        sku: $('#movSku').val(),
        tipo: $('#movTipo').val(),
        cantidad: Number($('#movCantidad').val()),
        notas: $('#movNotas').val(),
        emailUsuario: appState.user.email,
      };

      if (movimiento.cantidad <= 0) {
        // Validar cantidad positiva
        showError(
          'Cantidad inválida',
          'La cantidad debe ser un número mayor a cero.'
        );
        return;
      }

      // La lógica de conversión a negativo se hará en el backend o aquí, pero basado en tipo
      if (movimiento.tipo !== 'INGRESO') {
        // movimiento.cantidad *= -1; // Dejaremos que el backend maneje la lógica
      }

      google.script.run
        .withSuccessHandler((res) => {
          showToast('success', res);
          modalMovimiento.hide();
          cargarModuloInventario();
        })
        .withFailureHandler((err) => showError('Error', err.message))
        .registrarMovimientoInventario(movimiento);
    });

    $('#btnImportarProductos').on('click', function () {
      // --- [CORRECCIÓN] Verificación de Modal ---
      if (!modalPrevisualizacionImportar) {
        if (typeof showError === 'function') {
          showError(
            'Error de UI',
            'El modal de importación no está disponible.'
          );
        } else {
          alert('Error: El modal de importación no está disponible.');
        }
        return;
      }
      // --- Fin Corrección ---

      Swal.fire({
        title: 'Iniciar Importación',
        text: "Se leerá la hoja 'Importar'. ¿Deseas continuar?",
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí, previsualizar',
      }).then((result) => {
        if (result.isConfirmed) {
          showToast('info', 'Cargando previsualización...');
          google.script.run
            .withSuccessHandler((preview) => {
              const { productosValidos, errores } = preview;
              if (errores.length > 0)
                $('#previewErrores')
                  .html(
                    '<strong>Advertencias:</strong><br>' + errores.join('<br>')
                  )
                  .show();
              else $('#previewErrores').hide();
              $('#previewValidos').text(productosValidos.length);
              if (productosValidos.length > 0) {
                const headers = Object.keys(productosValidos[0]);
                $('#previewThead').html(
                  `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`
                );
                const tbody = $('#previewTbody').empty();
                productosValidos.forEach((p) => {
                  tbody.append(
                    `<tr>${headers.map((h) => `<td>${p[h]}</td>`).join('')}</tr>`
                  );
                });
                $('#btnConfirmarImportacion')
                  .show()
                  .data('productos', productosValidos);
              } else {
                $('#previewThead, #previewTbody').empty();
                $('#btnConfirmarImportacion').hide();
              }
              modalPrevisualizacionImportar.show();
            })
            .withFailureHandler((err) => showError('Error', err.message))
            .previsualizarImportacion();
        }
      });
    });

    $(document).on('click', '#btnConfirmarImportacion', function () {
      // --- [CORRECCIÓN] Verificación de Modal ---
      if (!modalPrevisualizacionImportar) {
        if (typeof showError === 'function') {
          showError(
            'Error de UI',
            'El modal de importación no está disponible.'
          );
        } else {
          alert('Error: El modal de importación no está disponible.');
        }
        return;
      }
      // --- Fin Corrección ---

      const btn = $(this);
      const productosAImportar = btn.data('productos');
      btn
        .prop('disabled', true)
        .html(
          '<span class="spinner-border spinner-border-sm"></span> Importando...'
        );
      google.script.run
        .withSuccessHandler((res) => {
          modalPrevisualizacionImportar.hide();
          Swal.fire('¡Éxito!', res, 'success');
          cargarModuloInventario();
        })
        .withFailureHandler((err) => showError('Error', err.message))
        .always(() => btn.prop('disabled', false).text('Confirmar e Importar'))
        .ejecutarImportacion(productosAImportar);
    });

    $('#btnNuevaCategoria').on('click', function () {
      // --- [CORRECCIÓN] Verificación de Modal ---
      if (!modalProducto) {
        if (typeof showError === 'function') {
          showError('Error de UI', 'El modal de producto no está disponible.');
        } else {
          alert('Error: El modal de producto no está disponible.');
        }
        return;
      }
      // --- Fin Corrección ---
      modalProducto.hide();
      Swal.fire({
        title: 'Crear Nueva Categoría',
        input: 'text',
        inputPlaceholder: 'Nombre de la nueva categoría',
        showCancelButton: true,
        confirmButtonText: 'Crear',
        inputValidator: (value) => !value && '¡Necesitas escribir un nombre!',
      }).then((result) => {
        modalProducto.show();
        if (result.isConfirmed && result.value) {
          const nuevaCategoria = result.value.trim();
          $('#prodCategoria').append(
            new Option(nuevaCategoria, nuevaCategoria, true, true)
          );
          showToast(
            'success',
            `Categoría "${nuevaCategoria}" creada y seleccionada.`
          );
        }
      });
    });

    /**
     * Maneja el evento de click en el botón para exportar el inventario a CSV.
     * Llama al backend para generar el contenido y luego inicia la descarga.
     */
    $('#btnExportarInventario').on('click', function () {
      // Primero, verificamos que el caché de inventario tenga datos
      if (!inventarioCompleto || inventarioCompleto.length === 0) {
        showError(
          'Nada que exportar',
          'El inventario está vacío. Cárgalo primero.'
        );
        return;
      }

      showToast('info', 'Generando archivo CSV...');

      // No necesitamos enviar los datos, el backend ya los tiene.
      google.script.run
        .withSuccessHandler((csvContent) => {
          // Creamos un link temporal para descargar el archivo
          const encodedUri = encodeURI(
            'data:text/csv;charset=utf-8,' + csvContent
          );
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', 'reporte_inventario.csv');
          document.body.appendChild(link);
          link.click(); // Simular clic para iniciar la descarga
          document.body.removeChild(link); // Limpiar el link del DOM
        })
        .withFailureHandler((err) =>
          showError('Error al Exportar', err.message)
        )
        .exportarInventarioCSV(); // Necesitamos añadir esta función al backend
    });

    $(document).on('click', '.ver-historial-producto', function () {
      const sku = $(this).closest('tr').data('producto').SKU;
      const nombre = $(this).closest('tr').data('producto').Nombre;
      google.script.run
        .withSuccessHandler((historial) => {
          let tablaHtml =
            '<div class="table-responsive" style="max-height: 400px;"><table class="table table-sm table-bordered"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Usuario</th><th>Notas</th></tr></thead><tbody>';
          historial.forEach((mov) => {
            const cantClass = mov.Cantidad > 0 ? 'text-success' : 'text-danger';
            const cantSigno = mov.Cantidad > 0 ? '+' : '';
            tablaHtml += `<tr><td>${mov.FechaHora}</td><td>${mov.Tipo}</td><td class="${cantClass} fw-bold">${cantSigno}${mov.Cantidad}</td><td>${mov.emailusuario}</td><td>${mov.Notas}</td></tr>`;
          });
          tablaHtml += '</tbody></table></div>';
          Swal.fire({
            title: `Kardex de: ${nombre}`,
            html: tablaHtml,
            width: '800px',
          });
        })
        .withFailureHandler((err) => showError('Error', err.message))
        .obtenerHistorialProducto(sku);
    });
    //----------------------------------------------------
    // 6. MÓDULO DE VENTAS Y PAGOS
    //----------------------------------------------------

    // --- Variables y constantes del módulo ---
    // const modalDetalleVenta = new bootstrap.Modal(document.getElementById('modalDetalleVenta'));
    let historialVentasCache = []; // Caché para el historial de ventas

    // // --- Lógica de la Galería de Productos y Carrito ---
    // function cargarProductosParaVenta() {
    //   google.script.run
    //     .withSuccessHandler((productos) => {
    //       appState.productos = productos;
    //       const categorias = [
    //         'Todos',
    //         ...new Set(productos.map((p) => p.categoria || 'Varios')),
    //       ];
    //       const botonesCategorias = $('#botonesCategorias').empty();
    //       categorias.forEach((cat) => {
    //         const activeClass = cat === 'Todos' ? 'active' : '';
    //         botonesCategorias.append(
    //           `<button type="button" class="btn btn-outline-primary btn-sm m-1 ${activeClass} btnCategoria" data-categoria="${cat}">${cat}</button>`
    //         );
    //       });
    //       renderizarGaleriaProductos('Todos');
    //     })
    //     .obtenerProductosActivos();
    // }
    function cargarProductosParaVenta() {
      google.script.run
        .withSuccessHandler(function (productos) {
          appState.productos = productos;

          // Generar categorías sin usar sintaxis moderna
          var categorias = ['Todos'];
          productos.forEach(function (p) {
            var cat = p.categoria || 'Varios';
            if (categorias.indexOf(cat) === -1) {
              categorias.push(cat);
            }
          });

          var botonesCategorias = $('#botonesCategorias').empty();
          categorias.forEach(function (cat) {
            var activeClass = cat === 'Todos' ? 'active' : '';
            botonesCategorias.append(
              '<button type="button" class="btn btn-outline-primary btn-sm m-1 ' +
                activeClass +
                ' btnCategoria" data-categoria="' +
                cat +
                '">' +
                cat +
                '</button>'
            );
          });

          renderizarGaleriaProductos('Todos');
        })
        .obtenerProductosActivos();
    }


    function renderizarGaleriaProductos(categoria) {
      const contenedor = $('#contenedorProductos').empty();
      const productosFiltrados =
        categoria === 'Todos'
          ? appState.productos
          : appState.productos.filter((p) => p.categoria === categoria);

      if (productosFiltrados.length === 0) {
        contenedor.html(
          '<p class="text-center text-muted">No hay productos en esta categoría.</p>'
        );
        return;
      }

      productosFiltrados.forEach((prod) => {
        const nombre = escapeHTML(prod.nombre);
        const sku = escapeHTML(prod.sku);
        const imagen = escapeHTML(
          prod.imagen || 'https://via.placeholder.com/150'
        );
        const card = `
            <div class="col-6 col-md-3 col-lg-2 mb-3">
              <div class="card h-100 producto-item shadow-sm" style="cursor: pointer;" 
                  data-sku="${sku}" data-nombre="${nombre}" data-precio="${Number(prod.precioVenta)}">
                <img src="${imagen}" class="card-img-top" alt="${nombre}" style="height:120px; object-fit:cover;">
                <div class="card-body p-2">
                  <h6 class="card-title mb-1 small text-truncate">${nombre}</h6>
                  <p class="fw-bold text-success mb-0">S/ ${Number(prod.precioVenta).toFixed(2)}</p>
                </div>
              </div>
            </div>
          `;
        contenedor.append(card);
      });
    }

    // --- Lógica del Carrito y Registro de Orden de Venta ---

    function agregarProductoAlCarrito(sku, nombre, precio, cantidad) {
      const productoExistente = appState.carrito.find((p) => p.sku === sku);
      if (productoExistente) {
        productoExistente.cantidad += cantidad;
      } else {
        appState.carrito.push({
          sku,
          nombre,
          precio: parseFloat(precio),
          cantidad,
        });
      }
      showToast('success', `${nombre} agregado.`);
      renderizarTablaVenta();
    }

    function actualizarCantidadEnCarrito(sku, nuevaCantidad) {
      const producto = appState.carrito.find((p) => p.sku === sku);
      if (producto) {
        producto.cantidad = nuevaCantidad;
        renderizarTablaVenta();
      }
    }

    function removerProductoDelCarrito(sku) {
      appState.carrito = appState.carrito.filter((p) => p.sku !== sku);
      renderizarTablaVenta();
    }

    function renderizarTablaVenta() {
      const tbody = $('#ventaItemsBody').empty();
      let totalGeneral = 0;
      if (appState.carrito.length === 0) {
        tbody.html(
          '<tr><td colspan="5" class="text-center text-muted">Agrega productos desde la galería o con el escáner.</td></tr>'
        );
      } else {
        appState.carrito.forEach((item) => {
          const nombre = escapeHTML(item.nombre);
          const sku = escapeHTML(item.sku);
          const precio = Number(item.precio) || 0;
          const cantidad = Number(item.cantidad) || 0;
          const subtotal = precio * cantidad;
          totalGeneral += subtotal;
          tbody.append(`
          <tr data-sku="${sku}">
            <td>${nombre}</td>
            <td><input type="number" class="form-control form-control-sm cantidad-item" value="${cantidad}" min="1" style="width: 80px;"></td>
            <td>S/ ${precio.toFixed(2)}</td>
            <td class="fw-bold">S/ ${subtotal.toFixed(2)}</td>
            <td><button class="btn btn-sm btn-danger quitar-item"><i class="bi bi-trash"></i></button></td>
          </tr>`);
        });
      }
      $('#totalVenta').text(`S/ ${totalGeneral.toFixed(2)}`);
    }

    function resetearFormularioVenta() {
      appState.carrito = [];
      renderizarTablaVenta();
      $('#codigoBarras').val('').focus();
      $('#selectCliente').val('varios').trigger('change');
      $('#selectPc').val('');
    }

    // --- Lógica para el Registro de Pago Consolidado ---

    $('#formRegistrarPago').on('submit', function (e) {
      e.preventDefault();
      const totalACobrar = parseFloat($('#pagoConsumoTotal').val() || 0);
      const montoPagado = parseFloat($('#pagoMontoPagado').val() || 0);

      if (montoPagado > totalACobrar) {
        showError(
          'Monto Incorrecto',
          'El monto pagado no puede ser mayor al consumo total.'
        );
        return;
      }
      const clienteSeleccionado = $('#pagoSelectCliente option:selected');
      const datosPago = {
        cliente: {
          dni: clienteSeleccionado.val(),
          nombre: clienteSeleccionado.text(),
        },
        totalACobrar: totalACobrar,
        montoPagado: montoPagado,
        metodoPago: $('#pagoMetodo').val(),
        descripcion: $('#pagoReferencia').val(),
        sesionID: appState.caja.SesionID,
        usuarioEmail: appState.user.email,
      };
      const btn = $(this).find('button[type="submit"]');
      btn
        .prop('disabled', true)
        .html(
          '<span class="spinner-border spinner-border-sm"></span> Guardando...'
        );

      google.script.run
        .withSuccessHandler((res) => {
          modalRegistrarPago.hide();
          showToast('success', res.message);
          if ($('#panelGestionDeudas').is(':visible')) {
            $('#btnRefrescarDeudas').click();
          }
          btn.prop('disabled', false).text('Guardar Pago'); // <-- CORRECCIÓN
        })
        .withFailureHandler((err) => {
          showError('Error al Procesar Pago', err.message);
          btn.prop('disabled', false).text('Guardar Pago'); // <-- CORRECCIÓN
        })
        .registrarPagoConsolidado(datosPago);
    });

    // --- Manejadores de Eventos del Módulo ---

    $('#btnVerVentas').on('click', function () {
      const panel = $('#panelPuntoDeVenta');
      panel.slideToggle();
      if (panel.is(':visible') && appState.productos.length === 0) {
        cargarProductosParaVenta();
        cargarClientesEnSelects();
      }
    });

    $(document).on('click', '.btnCategoria', function () {
      const categoria = $(this).data('categoria');
      $('.btnCategoria').removeClass('active');
      $(this).addClass('active');
      renderizarGaleriaProductos(categoria);
    });

    $('#codigoBarras').on('keypress', function (e) {
      if (e.which === 13) {
        e.preventDefault();
        const codigo = $(this).val().trim();
        if (codigo) {
          google.script.run
            .withSuccessHandler((productoEncontrado) => {
              if (productoEncontrado) {
                agregarProductoAlCarrito(
                  productoEncontrado.SKU,
                  productoEncontrado.Nombre,
                  productoEncontrado.PrecioVenta,
                  1
                );
                $(this).val('').focus();
              } else {
                showError(
                  'No encontrado',
                  'El producto no existe o no está activo.'
                );
              }
            })
            .buscarProductoPorCodigoBarras(codigo);
        }
      }
    });

    $(document).on('click', '.producto-item', function () {
      const card = $(this);
      agregarProductoAlCarrito(
        card.data('sku'),
        card.data('nombre'),
        card.data('precio'),
        1
      );
    });

    $(document).on('change', '.cantidad-item', function () {
      const sku = $(this).closest('tr').data('sku');
      const nuevaCantidad = parseInt($(this).val());
      if (nuevaCantidad > 0) {
        actualizarCantidadEnCarrito(sku, nuevaCantidad);
      } else {
        removerProductoDelCarrito(sku);
      }
    });

    $(document).on('click', '.quitar-item', function () {
      const sku = $(this).closest('tr').data('sku');
      removerProductoDelCarrito(sku);
    });

    // =================================================================
    //  EVENTO FINALIZAR VENTA (CORREGIDO Y BLINDADO)
    // =================================================================
    
    // Usamos .off() para limpiar cualquier listener previo y evitar el error 429
    $('#btnFinalizarVenta').off('click').on('click', function () {
      
      // 1. Validaciones iniciales
      if (!appState.caja || appState.caja.Estado !== 'Abierta') {
        showError(
          'Caja Cerrada',
          'Debes tener una sesión de caja abierta para registrar ventas.'
        );
        return;
      }
      
      if (appState.carrito.length === 0) {
        showError(
          'Carrito Vacío',
          'Agrega productos al carrito antes de registrar la venta.'
        );
        return;
      }

      // 2. Bloqueo de Botón (UX)
      const btn = $(this);
      // Guardamos el HTML original (icono + texto) para restaurarlo luego
      const contenidoOriginal = '<i class="bi bi-check-circle"></i> Finalizar Venta'; 
      
      btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Registrando Orden...');

      // 3. Preparación de Datos
      const clienteSeleccionado = $('#selectCliente option:selected');
      
      // Validación extra por seguridad: asegurar que hay cliente
      let nombreCliente = clienteSeleccionado.text();
      if(!clienteSeleccionado.val()) {
          // Si por alguna razón no hay cliente seleccionado, forzamos uno genérico o validamos
          // (Depende de tu lógica, aquí asumo que siempre quieres enviar algo)
      }

      const ordenData = {
        carrito: appState.carrito,
        cliente: {
          dni: clienteSeleccionado.val(),
          nombre: nombreCliente,
        },
        pc: $('#selectPc').val(),
        sesionID: appState.caja.SesionID,
        usuarioEmail: appState.user.email,
      };

      // 4. Llamada al Backend
      google.script.run
        .withSuccessHandler((resultado) => {
          Swal.fire({
            icon: 'success',
            title: 'Orden Registrada',
            text: `La orden ${resultado.ventaID} por un total de S/ ${resultado.total.toFixed(2)} ha sido registrada y está pendiente de pago.`,
            timer: 2000,
            showConfirmButton: false
          });
          
          resetearFormularioVenta();
          
          // Restaurar botón
          btn.prop('disabled', false).html(contenidoOriginal);
        })
        .withFailureHandler((err) => {
          console.error("Error en venta:", err);
          showError('Error al Registrar Orden', err.message);
          
          // Restaurar botón para permitir reintento
          btn.prop('disabled', false).html(contenidoOriginal);
        })
        .registrarOrdenDeVenta(ordenData);
    });

    $('#btnAbrirModalPago').on('click', function () {
      if (!appState.caja || appState.caja.Estado !== 'Abierta') {
        showError('Caja Cerrada', 'Debes tener una sesión de caja abierta.');
        return;
      }
      $('#formRegistrarPago')[0].reset();
      cargarClientesEnSelects('#pagoSelectCliente');
      bootstrap.Modal.getInstance(
        document.getElementById('modalRegistrarPago')
      ).show();
    });

    // Historial de Ventas
    $('#btnHistorialVentas').on('click', function () {
      const panel = $('#historialVentasPanel');
      panel.slideToggle();
      if (panel.is(':visible')) {
        cargarHistorialVentas();
      }
    });

    function cargarHistorialVentas() {
      $('#historialBody').html(
        '<tr><td colspan="7" class="text-center"><div class="spinner-border"></div></td></tr>'
      );
      google.script.run
        .withSuccessHandler((historial) => {
          historialVentasCache = historial;
          renderizarHistorial(historialVentasCache);
        })
        .withFailureHandler((error) => {
          showError(
            'Error del Servidor',
            'No se pudo cargar el historial. Error: ' + error.message
          );
          $('#historialBody').html(
            '<tr><td colspan="7" class="text-center text-danger">Error al cargar datos.</td></tr>'
          );
        })
        .obtenerHistorialVentas();
    }

    /**
     * --- VERSIÓN RECUPERADA (03/NOV) ---
     * Renderiza el historial de ventas en la tabla y se asegura de que DataTables
     * se reinicialice correctamente después de cada actualización de datos.
     * @param {Array<Object>} ventas - El array de objetos de venta del servidor.
     */
    function renderizarHistorial(ventas) {
      console.log("📦 [DEBUG] Datos recibidos en renderizarHistorial:", ventas);
      if (ventas && ventas.length > 0) {
          console.log("🔍 [DEBUG] Estructura del primer objeto venta:", ventas[0]);
          console.log("💰 [DEBUG] Valor de totalVenta:", ventas[0].totalVenta);
          console.log("Tipo de totalVenta:", typeof ventas[0].totalVenta);
      }
      // Primero, verificamos si la tabla ya es una DataTable.
      if ($.fn.DataTable.isDataTable('#tablaHistorial')) {
        // Si ya existe, la destruimos por completo. Esto es clave.
        $('#tablaHistorial').DataTable().destroy();
      }

      // Ahora que la tabla está "limpia", vaciamos el tbody para prepararlo para los nuevos datos.
      const tbody = $('#historialBody').empty();

      if (!ventas || ventas.length === 0) {
        tbody.html(
          '<tr><td colspan="7" class="text-center text-muted">No se encontraron ventas para mostrar.</td></tr>'
        );
      } else {
        // Llenamos el tbody con las nuevas filas.
        ventas.forEach((venta) => {
          const estado = escapeHTML(venta.EstadoPago);
          const ventaId = escapeHTML(venta.VentaID);
          const usuario = escapeHTML(venta.UsuarioEmail);
          const cliente = escapeHTML(venta.ClienteNombre);
          const estadoBadge = obtenerBadgeEstado(venta.EstadoPago);
          const botonesAccion = generarBotonesAccion(
            venta.EstadoPago,
            venta.VentaID
          );
          const valorCrudo = venta.totalVenta ?? venta.Total ?? venta.Monto ?? 0;
          const precioFinal = Number(valorCrudo);
          const fila = `
                    <tr>
                        <td>${ventaId}</td>
                        <td>${formatearFechaHora(venta.FechaHora)}</td>
                        <td>${usuario}</td>
                        <td>${cliente}</td>
                        <td>S/ ${precioFinal.toFixed(2)}</td>
                        <td><span class="badge ${estadoBadge}">${estado}</span></td>
                        <td class="text-nowrap">${botonesAccion}</td>
                    </tr>
                `;
          tbody.append(fila);
        });
      }

      // Finalmente, con el HTML ya renderizado en la página, inicializamos DataTables.
      $('#tablaHistorial').DataTable({
        language: {
          url: '//cdn.datatables.net/plug-ins/1.11.5/i18n/es-ES.json',
        },
        order: [[1, 'desc']], // Ordenar por fecha descendente
        responsive: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50],
      });
    }

    /**
     * Genera los botones de acción para una venta según su estado.
     * @param {string} estado - El estado actual de la venta.
     * @param {string} ventaID - El ID de la venta.
     * @returns {string} El HTML de los botones de acción.
     */
    function generarBotonesAccion(estado, ventaID) {
      const btnVer = `<button class="btn btn-sm btn-info ver-detalles" data-id="${ventaID}" title="Ver Detalles"><i class="bi bi-eye"></i></button>`;

      if (estado === 'Pendiente') {
        const btnConfirmar = `<button class="btn btn-sm btn-success btn-confirmar-venta" data-id="${ventaID}" title="Confirmar Venta"><i class="bi bi-cart-check"></i></button>`;
        const btnCancelar = `<button class="btn btn-sm btn-danger btn-cancelar-venta" data-id="${ventaID}" title="Cancelar Venta"><i class="bi bi-cart-x"></i></button>`;
        return `${btnVer} ${btnConfirmar} ${btnCancelar}`;
      }

      return btnVer;
    }

    /**
     * Devuelve la clase CSS de Bootstrap para el badge del estado.
     * @param {string} estado - El estado de la venta.
     * @returns {string} La clase CSS.
     */
    function obtenerBadgeEstado(estado) {
      switch (estado) {
        case 'Confirmado':
        case 'Confirmada':
          return 'bg-success';
        case 'Cancelada':
          return 'bg-danger';
        case 'Pendiente':
          return 'bg-warning text-dark';
        // [MEJORA] Añadido el estado 'Pagada' que se usa en Ventas.gs
        case 'Pagada':
          return 'bg-primary';
        default:
          return 'bg-secondary';
      }
    }

    /**
     * Formatea una fecha ISO a un formato local legible.
     * @param {string} fechaISO - La fecha en formato ISO.
     * @returns {string} La fecha formateada.
     */
    function formatearFechaHora(fechaISO) {
      if (!fechaISO) return 'N/A';
      const fecha = new Date(fechaISO);
      return fecha.toLocaleString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }

    // --- AÑADE ESTOS NUEVOS MANEJADORES DE EVENTOS A TU JS ---
    // (Puedes ponerlos junto a los otros eventos del historial)

    /**
     * Maneja el clic en el botón para Confirmar una Venta.
     */
    $(document).on('click', '.btn-confirmar-venta', function () {
      const ventaID = $(this).data('id');
      console.log('ID de Venta a confirmar:', ventaID);
      Swal.fire({
        title: '¿Confirmar esta venta?',
        text: `La venta ${ventaID} se marcará como "Confirmada". Esta acción es final y no se podrá cancelar después.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#198754',
        confirmButtonText: 'Sí, ¡confirmar!',
        cancelButtonText: 'No',
      }).then((result) => {
        if (result.isConfirmed) {
          google.script.run
            .withSuccessHandler((res) => {
              Swal.fire('¡Confirmada!', res, 'success');
              cargarHistorialVentas(); // Recargar la lista para ver el cambio de estado
            })
            .withFailureHandler((err) => showError('Error', err.message))
            .gestionarOrdenVenta(ventaID, 'CONFIRMAR');
        }
      });
    });

    /**
     * Maneja el clic en el botón para Cancelar una Venta.
     */
    $(document).on('click', '.btn-cancelar-venta', function () {
      const ventaID = $(this).data('id');
      Swal.fire({
        title: '¿Cancelar esta venta?',
        text: `Se cancelará la venta ${ventaID} y el stock de los productos será devuelto. ¡Esta acción no se puede deshacer!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, ¡cancelar!',
        cancelButtonText: 'No',
      }).then((result) => {
        if (result.isConfirmed) {
          google.script.run
            .withSuccessHandler((res) => {
              Swal.fire('¡Cancelada!', res, 'success');
              cargarHistorialVentas(); // Recargar la lista para ver el cambio de estado
            })
            .withFailureHandler((err) => showError('Error', err.message))
            .gestionarOrdenVenta(ventaID, 'CANCELAR');
        }
      });
    });

    $(document).on('click', '.ver-detalles', function (e) {
      e.preventDefault();
      const ventaID = $(this).data('id');
      const venta = historialVentasCache.find((v) => v.VentaID === ventaID);
      if (venta) {
        $('#modalDetalleVentaLabel').text(
          `Detalles de Venta: ${venta.VentaID}`
        );
        $('#infoVenta').html(
          `<p><strong>Fecha:</strong> ${formatearFechaHora(venta.FechaHora)} | <strong>Usuario:</strong> ${venta.UsuarioEmail}</p><p><strong>Cliente:</strong> ${venta.ClienteNombre}</p>`
        );
        const modalBody = $('#modalDetalleBody').html(
          '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>'
        );
        modalDetalleVenta.show();
        google.script.run
          .withSuccessHandler((detalles) => {
            modalBody.empty();
            if (detalles && detalles.length > 0) {
              detalles.forEach((d) => {
                modalBody.append(
                  `<tr><td>${d.SKU}</td><td>${d.ProductoNombre}</td><td>${d.Cantidad}</td><td>S/ ${Number(d.PrecioUnitario).toFixed(2)}</td><td>S/ ${Number(d.Subtotal).toFixed(2)}</td></tr>`
                );
              });
            } else {
              modalBody.html(
                '<tr><td colspan="5" class="text-center text-muted">No se encontraron productos para esta venta.</td></tr>'
              );
            }
          })
          .withFailureHandler((err) =>
            modalBody.html(
              '<tr><td colspan="5" class="text-center text-danger">Error al cargar detalles.</td></tr>'
            )
          )
          .obtenerDetallesDeVenta(ventaID);
      }
    });

    //----------------------------------------------------
    // 10. MÓDULO DE DASHBOARD Y REPORTES
    //----------------------------------------------------

    // --- Variables para las instancias de los gráficos ---
    let chartRendimiento = null;
    let chartTopProductosMonto = null;
    let chartTopProductosCantidad = null;
    let chartVentasCategoria = null;
    let chartActividadHora = null;

    /**
     * Función que se llama una vez al cargar la app para configurar el dashboard.
     */
    function inicializarDashboard() {
      // Configurar fechas por defecto (últimos 15 días)
      const hoy = new Date();
      const hace15Dias = new Date();
      hace15Dias.setDate(hoy.getDate() - 15);

      $('#dashboardFechaInicio').val(hace15Dias.toISOString().split('T')[0]);
      $('#dashboardFechaFin').val(hoy.toISOString().split('T')[0]);

      cargarDatosDashboard();
    }

    /**
     * Llama al backend para obtener los datos del dashboard y los renderiza.
     */
    function cargarDatosDashboard() {
      const filtros = {
        fechaInicio: $('#dashboardFechaInicio').val(),
        fechaFin: $('#dashboardFechaFin').val(),
      };

      if (!filtros.fechaInicio || !filtros.fechaFin) {
        showError(
          'Fechas requeridas',
          'Debes seleccionar una fecha de inicio y fin.'
        );
        return;
      }

      // Mostrar estado de carga
      $('#contenidoDashboard').html(
        '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p>Cargando datos del dashboard...</p></div>'
      );

      google.script.run
        .withSuccessHandler(renderizarDashboard)
        .withFailureHandler((err) =>
          showError('Error al Cargar Dashboard', err.message)
        )
        .obtenerDatosDashboard(filtros);
    }

    /**
     * Dibuja la tabla y el gráfico del dashboard principal.
     * @param {object} data - El objeto con { historial, resumenGrafico }.
     */
    function renderizarDashboard(data) {
      const contenido = $('#contenidoDashboard').empty();
      if (!data || !data.historial) {
        contenido.html(
          '<p class="text-center text-muted">No se encontraron datos para el período seleccionado.</p>'
        );
        return;
      }

      // 1. Renderizar la tabla de Resúmenes de Cierre
      let tablaHtml = `
          <h4 class="mt-4">Historial de Cierres de Caja</h4>
          <div class="table-responsive">
              <table id="tablaResumenesCierre" class="table table-sm table-striped w-100">
                  <thead>
                      <tr><th>Sesión ID</th><th>Fecha Cierre</th><th>Usuario</th><th>Monto Apertura</th><th>Total Ventas App</th><th>Total Egresos</th><th>Efectivo Esperado</th><th>Efectivo Real</th><th>Diferencia</th></tr>
                  </thead>
                  <tbody>
      `;
      data.historial.forEach((cierre) => {
        const diferencia = Number(cierre[12]); // Asumiendo el orden de columnas del backend
        let claseDiferencia = 'text-success';
        if (diferencia < 0) claseDiferencia = 'text-danger';
        else if (diferencia > 0) claseDiferencia = 'text-warning';

        tablaHtml += `
              <tr>
                  <td>${cierre[0]}</td>
                  <td>${new Date(cierre[1]).toLocaleDateString()}</td>
                  <td>${cierre[2]}</td>
                  <td>S/ ${Number(cierre[3]).toFixed(2)}</td>
                  <td>S/ ${Number(cierre[5]).toFixed(2)}</td>
                  <td>S/ ${Number(cierre[9]).toFixed(2)}</td>
                  <td>S/ ${Number(cierre[10]).toFixed(2)}</td>
                  <td>S/ ${Number(cierre[11]).toFixed(2)}</td>
                  <td class="fw-bold ${claseDiferencia}">S/ ${diferencia.toFixed(2)}</td>
              </tr>
          `;
      });
      tablaHtml += '</tbody></table></div>';
      contenido.html(tablaHtml);
      activarDataTables('#tablaResumenesCierre');

      // 2. Renderizar el gráfico de Rendimiento
      if (chartRendimiento) {
        chartRendimiento.destroy();
      }
      const ctx = document
        .getElementById('graficoRendimiento')
        .getContext('2d');
      chartRendimiento = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.resumenGrafico.labels,
          datasets: [
            {
              label: 'Ingresos por Ventas (App)',
              data: data.resumenGrafico.ventas,
              borderColor: 'rgba(25, 135, 84, 1)',
              backgroundColor: 'rgba(25, 135, 84, 0.2)',
              fill: true,
              tension: 0.1,
            },
            {
              label: 'Egresos Totales',
              data: data.resumenGrafico.egresos,
              borderColor: 'rgba(220, 53, 69, 1)',
              backgroundColor: 'rgba(220, 53, 69, 0.2)',
              fill: true,
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Rendimiento del Negocio' },
          },
        },
      });
    }

    // --- Manejadores de Eventos del Dashboard y Reportes ---

    // Botones de filtro rápido para el dashboard
    $('#btnAplicarFiltroDashboard').on('click', cargarDatosDashboard);

    // Botón para mostrar el panel de reportes
    $('#btnVerReportes').on('click', function () {
      $('#panelReportes').slideToggle();
    });

    // Lógica para cargar diferentes reportes al hacer clic en sus botones
    $('#btnReporteFlujo').on('click', function () {
      const filtros = obtenerFiltrosReporte();
      if (!filtros) return;
      google.script.run
        .withSuccessHandler(renderizarReporteFlujoDinero)
        .withFailureHandler((err) => showError('Error', err.message))
        .obtenerReporteFlujoDinero(filtros);
    });

    $('#btnReporteRentabilidad').on('click', function () {
      const filtros = obtenerFiltrosReporte();
      if (!filtros) return;
      google.script.run
        .withSuccessHandler(renderizarReporteRentabilidad)
        .withFailureHandler((err) => showError('Error', err.message))
        .obtenerReporteRentabilidad(filtros);
    });

    $('#btnReporteBI').on('click', function () {
      const filtros = obtenerFiltrosReporte();
      if (!filtros) return;
      google.script.run
        .withSuccessHandler(renderizarReporteBI)
        .withFailureHandler((err) => showError('Error', err.message))
        .obtenerMetricasBI(filtros);
    });

    function obtenerFiltrosReporte() {
      const filtros = {
        fechaInicio: $('#reporteFechaInicio').val(),
        fechaFin: $('#reporteFechaFin').val(),
      };
      if (!filtros.fechaInicio || !filtros.fechaFin) {
        showError(
          'Fechas requeridas',
          'Debes seleccionar un período para el reporte.'
        );
        return null;
      }
      $('#contenidoReportes').html(
        '<div class="text-center p-5"><div class="spinner-border text-info"></div><p>Generando reporte...</p></div>'
      );
      return filtros;
    }

    // --- Funciones para Renderizar los Reportes Específicos ---

    function renderizarReporteFlujoDinero(data) {
      const contenido = $('#contenidoReportes').empty();
      const html = `
          <h4>Reporte de Flujo de Dinero</h4>
          <ul class="list-group">
              <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-success"><strong>(+) Ingresos por Ventas y Consumos:</strong> <span class="badge bg-primary rounded-pill">S/ ${data.ingresosPorVentas.toFixed(2)}</span></li>
              <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-success"><strong>(+) Ingresos por Cobro de Deudas:</strong> <span class="badge bg-primary rounded-pill">S/ ${data.ingresosPorDeudas.toFixed(2)}</span></li>
              <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-danger"><strong>(-) Egresos por Gastos y Compras:</strong> <span class="badge bg-primary rounded-pill">S/ ${data.totalEgresos.toFixed(2)}</span></li>
              <li class="list-group-item d-flex justify-content-between align-items-center list-group-item-warning"><strong>(-) Créditos Otorgados (Nuevas Deudas):</strong> <span class="badge bg-primary rounded-pill">S/ ${data.creditosOtorgados.toFixed(2)}</span></li>
          </ul>
      `;
      contenido.html(html);
    }

    function renderizarReporteRentabilidad(data) {
      const contenido = $('#contenidoReportes').empty();
      const html = `
          <h4>Reporte de Rentabilidad</h4>
          <ul class="list-group">
              <li class="list-group-item"><strong>Total Ventas (Bruto):</strong> S/ ${data.totalVentasBrutas.toFixed(2)}</li>
              <li class="list-group-item"><strong>(-) Costo de Mercadería Vendida:</strong> S/ ${data.totalCostoMercaderia.toFixed(2)}</li>
              <li class="list-group-item list-group-item-info"><strong>(=) Utilidad Bruta:</strong> S/ ${data.utilidadBruta.toFixed(2)}</li>
              <li class="list-group-item"><strong>(-) Gastos Operativos del Período:</strong> S/ ${data.totalEgresos.toFixed(2)}</li>
              <li class="list-group-item list-group-item-success"><strong>(=) Utilidad Neta (Estimada):</strong> S/ ${data.utilidadNeta.toFixed(2)}</li>
          </ul>
      `;
      contenido.html(html);
    }

    function renderizarReporteBI(data) {
      const contenido = $('#contenidoReportes').empty();
      // Preparar el HTML con los canvas para los gráficos
      contenido.html(`
          <h4>Reportes de Inteligencia de Negocio</h4>
          <div class="row">
              <div class="col-lg-6 mb-4"><canvas id="chartTopProductosMonto"></canvas></div>
              <div class="col-lg-6 mb-4"><canvas id="chartTopProductosCantidad"></canvas></div>
              <div class="col-lg-6 mb-4"><canvas id="chartVentasCategoria"></canvas></div>
              <div class="col-lg-6 mb-4"><canvas id="chartActividadHora"></canvas></div>
          </div>
      `);

      // Destruir gráficos anteriores si existen
      if (chartTopProductosMonto) chartTopProductosMonto.destroy();
      if (chartTopProductosCantidad) chartTopProductosCantidad.destroy();
      if (chartVentasCategoria) chartVentasCategoria.destroy();
      if (chartActividadHora) chartActividadHora.destroy();

      // Renderizar cada gráfico
      chartTopProductosMonto = new Chart(
        document.getElementById('chartTopProductosMonto'),
        {
          type: 'bar',
          data: {
            labels: data.topProductosMonto.map((p) => p.nombre),
            datasets: [
              {
                label: 'Top 5 por Monto (S/)',
                data: data.topProductosMonto.map((p) => p.monto),
                backgroundColor: 'rgba(25, 135, 84, 0.7)',
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
              title: { display: true, text: 'Top 5 Productos por Ingresos' },
            },
          },
        }
      );
      chartTopProductosCantidad = new Chart(
        document.getElementById('chartTopProductosCantidad'),
        {
          type: 'bar',
          data: {
            labels: data.topProductosCantidad.map((p) => p.nombre),
            datasets: [
              {
                label: 'Top 5 por Cantidad Vendida',
                data: data.topProductosCantidad.map((p) => p.cantidad),
                backgroundColor: 'rgba(13, 110, 253, 0.7)',
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
              title: { display: true, text: 'Top 5 Productos por Unidades' },
            },
          },
        }
      );
      chartVentasCategoria = new Chart(
        document.getElementById('chartVentasCategoria'),
        {
          type: 'doughnut',
          data: {
            labels: Object.keys(data.ventasPorCategoria),
            datasets: [
              {
                label: 'Ventas por Categoría',
                data: Object.values(data.ventasPorCategoria),
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Distribución de Ventas por Categoría',
              },
            },
          },
        }
      );
      chartActividadHora = new Chart(
        document.getElementById('chartActividadHora'),
        {
          type: 'bar',
          data: {
            labels: [...Array(24).keys()].map((h) => `${h}:00`),
            datasets: [
              {
                label: 'N° de Ventas',
                data: data.actividadPorHora,
                backgroundColor: 'rgba(255, 193, 7, 0.7)',
              },
            ],
          },
          options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Horas Pico de Ventas' } },
          },
        }
      );
    }

//----------------------------------------------------
    // 11. MÓDULO DE LÓGICA DE CAJA (FINAL)
    //----------------------------------------------------

    let resumenDeCierreCache = null;

    /**
     * Verifica el estado de la caja al iniciar la app.
     */
    function verificarEstadoDeCajaAlCargar() {
      google.script.run
        .withSuccessHandler((sesionAbierta) => {
          if (sesionAbierta) {
            appState.caja = sesionAbierta;
            $('#cajaBlocker').hide(); 
            $('#btnCerrarCaja').show();
            showToast('info', `Sesión de caja ${sesionAbierta.SesionID} activa.`);
            inicializarDashboard(); 
          } else {
            appState.caja = null;
            $('#cajaBlocker').show();
            modalAbrirCaja.show();
            $('#btnCerrarCaja').hide();
          }
        })
        .withFailureHandler((err) => {
          showError('Error Crítico', 'No se pudo verificar caja: ' + err.message);
          $('#cajaBlocker').show();
        })
        .obtenerEstadoCajaActual();
    }

    // Evento para el formulario de abrir caja
    $('#formAbrirCaja').on('submit', function (e) {
      e.preventDefault();
      const monto = parseFloat($('#montoApertura').val());
      if (isNaN(monto) || monto < 0) {
        showError('Monto inválido', 'Ingresa un monto válido.');
        return;
      }
      const btn = $(this).find('button[type="submit"]');
      btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Abriendo...');

      google.script.run
        .withSuccessHandler((nuevaSesion) => {
          appState.caja = nuevaSesion;
          modalAbrirCaja.hide();
          $('#cajaBlocker').fadeOut();
          Swal.fire('¡Caja Abierta!', `Turno iniciado con S/ ${monto.toFixed(2)}`, 'success');
          $('#btnCerrarCaja').show();
          inicializarDashboard();
          btn.prop('disabled', false).text('Iniciar Caja');
        })
        .withFailureHandler((err) => {
          showError('Error', err.message);
          btn.prop('disabled', false).text('Iniciar Caja');
        })
        .iniciarNuevaSesion(monto, appState.user.email);
    });

    // Evento para el botón de cerrar caja
    $('#btnCerrarCaja').on('click', function () {
      showToast('info', 'Calculando resumen del turno...');
      
      google.script.run
        .withSuccessHandler((resumen) => {
          resumenDeCierreCache = resumen;
          console.log("Resumen recibido:", resumen);
          // --- LLENADO DEL MODAL DE CIERRE ---
          
          // 1. Resumen Informativo
          $('#cierreTotalVentasApp').text(`S/ ${Number(resumen.totalVentasApp || 0).toFixed(2)}`);
          $('#cierreQVentas').text(resumen.qVentas || 0);

          // 2. Desglose de Movimientos 
          // [CORREGIDO] Usamos los nombres que definimos en el Backend Caja.gs
          $('#cierrePagosDeuda').text(`S/ ${Number(resumen.cobrosDeudaEfectivo || 0).toFixed(2)}`);
          
          // (-) Deducciones
          // [CORREGIDO] Usamos 'ventasDigitales' en lugar de 'totalYapePlin'
          $('#cierreYapePlin').text(`S/ ${Number(resumen.ventasDigitales || 0).toFixed(2)}`); 
          $('#cierreDeudasNuevas').text(`S/ ${Number(resumen.totalDeudasNuevas || 0).toFixed(2)}`);
          $('#cierreEgresos').text(`S/ ${Number(resumen.totalGastos || 0).toFixed(2)}`);

          $('#formCerrarCaja')[0].reset();
          
          // Limpiamos y recalculamos
          $('#cierreMontoCyberplanet').val(''); 
          $('#cierreMontoReal').val('');
          $('#cierreMontoEsperado').text('Esperando dato Cyberplanet...');
          $('#cierreDiferencia').text('---');

          modalCerrarCaja.show();
        })
        .withFailureHandler((err) => showError('Error al obtener resumen', err.message))
        .obtenerResumenParaCierre(appState.caja.SesionID);
    });

    // Calcular el cierre en tiempo real
    $('#cierreMontoCyberplanet, #cierreMontoReal').on('input', calcularCierreCajaDefinitivo);

    // Lógica de cálculo en tiempo real (Frontend - BLINDADA)
    function calcularCierreCajaDefinitivo() {
      if (!resumenDeCierreCache) return;
      
      const montoApertura = parseFloat(appState.caja.MontoApertura || 0);
      const montoCyber = parseFloat($('#cierreMontoCyberplanet').val() || 0);
      const montoReal = parseFloat($('#cierreMontoReal').val() || 0);

      // Usamos "|| 0" para proteger contra valores undefined o null
      const cobrosDeuda = resumenDeCierreCache.cobrosDeudaEfectivo || 0;
      // Protección doble: busca el nombre nuevo O el viejo
      const ventasDig = resumenDeCierreCache.ventasDigitales || resumenDeCierreCache.totalYapePlin || 0; 
      const fiados = resumenDeCierreCache.totalDeudasNuevas || 0;
      const gastos = resumenDeCierreCache.totalGastos || 0;

      const ingresos = montoApertura + montoCyber + cobrosDeuda;
      const egresos = ventasDig + fiados + gastos;
      
      const esperado = ingresos - egresos;

      $('#cierreMontoEsperado').text(`S/ ${esperado.toFixed(2)}`);

      const diferencia = montoReal - esperado;
      const elDiferencia = $('#cierreDiferencia');
      
      let signo = diferencia > 0 ? '+' : '';
      // Evitamos mostrar "NaN" si el cálculo falla por alguna razón extrema
      const diffTexto = isNaN(diferencia) ? "Error" : `S/ ${signo}${diferencia.toFixed(2)}`;
      elDiferencia.text(diffTexto);
      
      elDiferencia.removeClass('text-success text-danger text-warning');
      if (Math.abs(diferencia) < 0.10) elDiferencia.addClass('text-success');
      else if (diferencia > 0) elDiferencia.addClass('text-warning');
      else elDiferencia.addClass('text-danger');
    }

    // Evento para el formulario de cierre final
    $('#formCerrarCaja').on('submit', function (e) {
      e.preventDefault();
      const datosCierre = {
        sesionID: appState.caja.SesionID,
        montoCyberplanet: parseFloat($('#cierreMontoCyberplanet').val() || 0),
        montoReal: parseFloat($('#cierreMontoReal').val() || 0),
        emailUsuario: appState.user.email,
        notas: $('#cierreNotas').val(),
      };

      const btn = $(this).find('button[type="submit"]');
      btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Cerrando...');

      google.script.run
        .withSuccessHandler((resumenFinal) => {
          modalCerrarCaja.hide();
          Swal.fire(
            '¡Caja Cerrada!',
            'El resumen del turno ha sido guardado. La aplicación se reiniciará.',
            'success'
          ).then(() => location.reload());
        })
        .withFailureHandler((err) => {
          showError('Error al Cerrar Caja', err.message);
          btn.prop('disabled', false).text('Guardar y Cerrar Turno');
        })
        .finalizarCierreCaja(datosCierre);
    });

    // =================================================================
    // LÓGICA PARA EL PANEL DE HISTORIAL DE VENTAS
    // =================================================================

    /**
     * Maneja el clic en el botón "Ver Historial" desde el panel de Punto de Venta.
     * Oculta el panel de ventas y muestra el panel de historial.
     */
    $(document).on('click', '#btnHistorialVentas', function () {
      const panelVenta = $('#panelVentas');
      const panelHistorial = $('#panelHistorial');

      panelVenta.hide();
      panelHistorial.fadeIn();

      // Carga los datos del historial si es la primera vez que se abre
      if (!panelHistorial.hasClass('loaded')) {
        // Activa la primera pestaña por defecto y carga sus datos
        $('#tabHistorialOrdenes').click();
        cargarHistorialVentas();
        panelHistorial.addClass('loaded');
      }
    });

    /**
     * Maneja el clic en el botón para volver al panel principal del Punto de Venta.
     */
    $(document).on('click', '#btnVolverAPDV', function () {
      $('#panelHistorial').hide();
      $('#panelVentas').fadeIn();
    });

    /**
     * Maneja el clic en el botón de refresco manual del historial.
     * Vuelve a cargar los datos desde el servidor.
     */
    $(document).on('click', '#btnRefrescarHistorial', function () {
      showToast('info', 'Actualizando historial...');
      cargarHistorialVentas(); // Llama a la función que busca los datos frescos
    });

    /**
     * Maneja el clic en la pestaña de "Verificación de Turno".
     * Carga la lista de sesiones de caja la primera vez que se abre.
     */
    $(document).on('click', '#tabVerificacionTurno', function () {
      const select = $('#selectSesionVerificacion');
      // Solo cargar si el select está vacío para evitar recargas innecesarias
      if (select.children().length === 0) {
        select.html('<option>Cargando sesiones...</option>');
        google.script.run
          .withSuccessHandler((sesiones) => {
            select
              .empty()
              .append('<option value="">-- Selecciona una sesión --</option>');
            if (sesiones && sesiones.length > 0) {
              // Seleccionar la sesión activa por defecto si existe
              const sesionActivaId = appState.caja
                ? appState.caja.SesionID
                : null;
              sesiones.forEach((sesion) => {
                const option = $('<option>')
                  .val(sesion.sesionID)
                  .text(sesion.texto);
                if (sesion.sesionID === sesionActivaId) {
                  option.prop('selected', true);
                }
                select.append(option);
              });
            }
          })
          .withFailureHandler((err) => {
            showError('Error', 'No se pudo cargar el historial de sesiones.');
            select.empty().append('<option value="">Error al cargar</option>');
          })
          .obtenerHistorialSesiones();
      }
    });

    /**
     * Maneja el clic en el botón para verificar los productos vendidos en una sesión.
     */
    $(document).on('click', '#btnVerificarSesion', function () {
      const sesionID = $('#selectSesionVerificacion').val();
      if (!sesionID) {
        showError(
          'Selección requerida',
          'Por favor, selecciona una sesión de caja para verificar.'
        );
        return;
      }

      const tbody = $('#verificacionBody').html(
        '<tr><td colspan="4" class="text-center"><div class="spinner-border spinner-border-sm"></div> Buscando productos...</td></tr>'
      );

      google.script.run
        .withSuccessHandler((resumen) => {
          tbody.empty();
          if (resumen && resumen.length > 0) {
            resumen.forEach((producto) => {
              const fila = `
                          <tr>
                              <td>${producto.SKU}</td>
                              <td>${producto.ProductoNombre}</td>
                              <td class="fw-bold text-center">${producto.CantidadTotal}</td>
                              <td>S/ ${producto.VentaTotal.toFixed(2)}</td>
                          </tr>
                      `;
              tbody.append(fila);
            });
          } else {
            tbody.html(
              '<tr><td colspan="4" class="text-center text-muted">No se encontraron ventas de productos en esta sesión.</td></tr>'
            );
          }
        })
        .withFailureHandler((err) => {
          showError('Error', 'No se pudo generar el resumen de productos.');
          tbody.html(
            '<tr><td colspan="4" class="text-center text-danger">Error al cargar los datos.</td></tr>'
          );
        })
        .obtenerResumenProductosVendidosPorSesion(sesionID);
    });
    //----------------------------------------------------
    // 14. MÓDULO DE GESTIÓN DE DEUDAS (VERSIÓN MEJORADA)
    // Incluye: Corrección de bug de refresco, colores de
    // vencimiento y alertas de deudas que vencen hoy.
    //----------------------------------------------------

    // --- VARIABLE DE CACHÉ ---
    let datosDeudasCache = null;

    // --- FUNCIÓN CENTRAL DE CARGA DE DATOS ---
    /**
     * [NUEVA FUNCIÓN]
     * Carga todos los datos de deudas desde el backend.
     * Maneja el caché y las alertas de vencimiento.
     * @param {boolean} forzarRefresco - Si es true, ignora el caché y pide datos nuevos.
     */
    function cargarDatosDeudas(forzarRefresco = false) {
        // 1. Decidir la pestaña activa (o la primera por defecto)
        let tabId = $('#panelGestionDeudas .nav-tabs .nav-link.active').attr('id');
        if (!tabId) {
            tabId = 'tabDeudasPendientes'; // Default a la pestaña 1
            $('#' + tabId).addClass('active');
        }

        // 2. Usar el caché si existe y no se está forzando
        if (datosDeudasCache && !forzarRefresco) {
            renderizarVista(tabId); // Simplemente renderizar
            return;
        }

        // 3. Si no hay caché o se fuerza, buscar en el backend
        const contenido = $('#contenidoPanelDeudas').html('<div class="text-center p-5"><div class="spinner-border"></div><p class="mt-2">Cargando datos del módulo de deudas...</p></div>');
        
        google.script.run
            .withSuccessHandler(datosCompletos => {
              console.log("DATOS COMPLETOS RECIBIDOS:", datosCompletos);
                datosDeudasCache = datosCompletos; // Guardar en caché
                
                // --- ¡FEATURE 2: ALERTA DE VENCIMIENTOS! ---
                if (datosCompletos.pendientes && datosCompletos.pendientes.length > 0) {
                    const hoySinHora = new Date(new Date().setHours(0, 0, 0, 0));
                    let deudasVencenHoy = 0;
                    
                    datosCompletos.pendientes.forEach(deuda => {
                        if (deuda.FechaVencimiento) {
                            const fechaVenc = new Date(deuda.FechaVencimiento + 'T00:00:00'); // Comparar como fecha local
                            if (fechaVenc.getTime() === hoySinHora.getTime()) {
                                deudasVencenHoy++;
                            }
                        }
                    });

                    if (deudasVencenHoy > 0) {
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'warning',
                            title: `¡Atención! Tienes ${deudasVencenHoy} deuda(s) que vencen hoy.`,
                            showConfirmButton: false,
                            timer: 4000
                        });
                    }
                }
                // --- FIN FEATURE 2 ---

                renderizarVista(tabId); // Renderizar la vista solicitada
            })
            .withFailureHandler(err => {
                showError('Error al cargar deudas', err.message);
                contenido.html(`<div class="alert alert-danger">${err.message}</div>`);
            })
            .obtenerDatosCompletosDeudas();
    }

    /**
     * [NUEVA FUNCIÓN]
     * Renderiza el contenido de la pestaña según el ID.
     * Se llama después de que los datos se cargan.
     */
    function renderizarVista(tabId) {
        if (!datosDeudasCache) return; // Seguridad

        switch(tabId) {
            case 'tabDeudasPendientes':
                renderizarTablaDeudas(datosDeudasCache.pendientes);
                break;
            case 'tabHistorialDeudas':
                renderizarTablaHistorial(datosDeudasCache.historialDeudas, 'Deudas Creadas');
                break;
            case 'tabHistorialPagosDeuda':
                renderizarTablaHistorial(datosDeudasCache.historialPagos, 'Pagos de Deuda');
                break;
        }
    }


    // --- FUNCIONES DE RENDERIZADO DE TABLAS ---

    /**
     * [MODIFICADA]
     * Dibuja la tabla de deudas pendientes (Consolidadas).
     * Ahora incluye lógica de colores para vencimientos.
     */
    function renderizarTablaDeudas(deudas) {
        const contenido = $('#contenidoPanelDeudas').empty();
        const tablaHtml = `
            <div class="input-group mb-3" style="max-width: 400px;">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input type="text" id="filtroDeudas" class="form-control" placeholder="Buscar por Cliente o DNI...">
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-hover" id="tablaDeudasPendientes">
                <thead class="table-dark">
                  <tr><th>Cliente</th><th>Monto Original</th><th>Saldo Pendiente</th><th>Fecha Creación</th><th>Vencimiento</th><th>Notas</th><th>Acciones</th></tr>
                </thead>
                <tbody id="deudasBody"></tbody>
              </table>
            </div>
        `;
        contenido.html(tablaHtml);

        const tbody = $('#deudasBody');
        if (!deudas || deudas.length === 0) {
            tbody.html('<tr><td colspan="7" class="text-center text-muted">¡Felicidades! No hay deudas pendientes.</td></tr>');
            return;
        }

        const hoySinHora = new Date(new Date().setHours(0, 0, 0, 0));

        deudas.forEach(deuda => {
            const saldoPendiente = Number(deuda.SaldoPendiente) || 0;
            let botonAccion = `<button class="btn btn-sm btn-success pagar-deuda" data-deuda-id="${deuda.DeudaID}" data-cliente-id="${deuda.ClienteID}" data-cliente-nombre="${deuda.ClienteNombre}" data-saldo="${saldoPendiente}"><i class="bi bi-cash-coin"></i> Registrar Pago</button>`;
            
            // --- ¡FEATURE 1: LÓGICA DE COLORES! ---
            let claseFila = '';
            let textoVencimiento = deuda.FechaVencimiento || 'N/A';
            
            if (deuda.FechaVencimiento) {
                const fechaVenc = new Date(deuda.FechaVencimiento + 'T00:00:00'); // Comparar como fecha local
                const diffTime = fechaVenc - hoySinHora;
                const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDias < 0) {
                    claseFila = 'table-danger'; // Vencida (Rojo)
                    textoVencimiento += ` (Vencida hace ${Math.abs(diffDias)} días)`;
                } else if (diffDias <= 3) {
                    claseFila = 'table-warning'; // Por vencer (Amarillo)
                    textoVencimiento += ` (Vence en ${diffDias} días)`;
                }
            }
            // --- FIN FEATURE 1 ---
            
            const fila = `
                <tr class="${claseFila}">
                    <td>${deuda.ClienteNombre || ''} (${deuda.ClienteID || ''})</td>
                    <td>S/ ${(Number(deuda.MontoOriginal) || 0).toFixed(2)}</td>
                    <td class="fw-bold">S/ ${saldoPendiente.toFixed(2)}</td>
                    <td>${deuda.FechaCreacion || ''}</td>
                    <td>${textoVencimiento}</td>
                    <td>${deuda.Notas || ''}</td>
                    <td>${botonAccion}</td>
                </tr>`;
            tbody.append(fila);
        });
    }

    /**
     * [SIN CAMBIOS]
     * Dibuja una tabla de historial genérica.
     */
    function renderizarTablaHistorial(historial, tipo) {
        // ... (Esta función se mantiene igual que en la versión anterior)
        const contenido = $('#contenidoPanelDeudas').empty();
        if (!historial || historial.length === 0) {
            contenido.html(`<p class="text-center text-muted">No hay registros en el historial de ${tipo.toLowerCase()}.</p>`);
            return;
        }
        const headers = Object.keys(historial[0]);
        const tablaId = "tablaHistorialGenerica";
        const searchInput = `
          <div class="input-group mb-3" style="max-width: 400px;">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input type="text" class="form-control filtro-historial" placeholder="Buscar en historial..." data-table-id="${tablaId}">
          </div>
        `;
        const tablaHtml = `
          <div class="table-responsive">
            <table class="table table-sm table-striped table-bordered" id="${tablaId}">
              <thead class="table-dark">
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${historial.map(row => `<tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </div>`;
        contenido.html(searchInput + tablaHtml);
    }


    // --- MANEJADORES DE EVENTOS ---

    /**
     * [MODIFICADO]
     * Clic en el Sidebar ("Deudas").
     * Ahora solo se asegura de que el caché se borre si el panel
     * está oculto, y llama a la función de carga.
     */
    $('#btnVerDeudas').on('click', function() {
        // Si el panel de deudas NO está visible, limpiamos el caché
        // para asegurar que se carguen datos frescos.
        if (!$('#panelDeudas').is(':visible')) {
            datosDeudasCache = null;
        }
        
        // Dejamos que el script genérico muestre el panel...
        // y llamamos a nuestra función de carga.
        cargarDatosDeudas(false);
    });

    /**
     * [ELIMINADO]
     * El botón 'btnClosePanelDeudas' se eliminó del HTML,
     * por lo que ya no necesitamos su evento.
     */
    // $('#btnClosePanelDeudas').on('click', ...) // ELIMINADO


    /**
     * [SIN CAMBIOS]
     * Evento para el botón 'Añadir Nueva Deuda'.
     * (Utiliza la versión de 'cargarClientesEnSelects' que ya corregimos)
     */
    $('#btnAnadirDeuda').on('click', function () {
        if (!appState.caja || appState.caja.Estado !== 'Abierta') {
            showError('Caja Cerrada', 'Debes tener una sesión de caja abierta.');
            return;
        }
        const form = $('#formNuevaDeuda');
        form[0].reset();
        const selectId = '#deudaSelectCliente'; 
        const select = $(selectId);
        if (select.length === 0) {
          showError('Error de UI', 'No se encontró el <select> con id "deudaSelectCliente" en el modal.');
          return;
        }
        cargarClientesEnSelects(selectId); 
        setTimeout(() => {
            $(selectId + " option[value='varios']").remove();
            $(selectId).prepend('<option value="" selected disabled>Seleccione un cliente...</option>');
            $(selectId).val("");
        }, 300);
        modalNuevaDeuda.show();
    });

/**
     * [CORREGIDO Y BLINDADO]
     * Evento de envío para el formulario de nueva deuda.
     * Se usa .off('submit') para evitar el error 429 (Duplicidad de llamadas).
     */
    $('#formNuevaDeuda').off('submit').on('submit', function (e) {
        e.preventDefault(); 
        
        const form = $(this);
        const btnSubmit = form.find('button[type="submit"]');
        
        // Guardamos el texto actual del botón para restaurarlo después
        const textoBotonOriginal = btnSubmit.text(); 

        const clienteSeleccionado = $('#deudaSelectCliente option:selected');
        const monto = parseFloat($('#deudaMonto').val());
        
        // 1. Validaciones
        if (!clienteSeleccionado.val() || clienteSeleccionado.val() === "varios") {
            showError('Datos incompletos', 'Debe seleccionar un cliente específico.'); 
            return;
        }
        if (!monto || monto <= 0) {
            showError('Datos incompletos', 'El monto debe ser un número positivo.'); 
            return;
        }

        // 2. Preparación de datos (Tu lógica de extracción de nombre)
        const dniCliente = clienteSeleccionado.val();
        const textoCompleto = clienteSeleccionado.text();
        let nombreParseado = textoCompleto.replace(/\(.*\)/, '').trim();
        const partes = nombreParseado.split(' - ');
        
        if (partes.length > 1) { 
            nombreParseado = partes[1].trim(); 
        } else { 
            nombreParseado = partes[0].trim(); 
        }
        const nombreCliente = nombreParseado;

        const datosDeuda = {
            cliente: { dni: dniCliente, nombre: nombreCliente },
            monto: monto,
            fechaVencimiento: $('#deudaFechaVencimiento').val() || '',
            notas: $('#deudaNotas').val() || '',
            sesionID: appState.caja.SesionID,
            usuarioEmail: appState.user.email
        };

        // 3. Bloqueo de botón
        btnSubmit.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Guardando...');
        
        // 4. Envío al Backend
        google.script.run
            .withSuccessHandler(res => {
                // 'res' es ahora un objeto simple {deudaID, monto}
                showToast('success', `Deuda ${res.deudaID} creada por S/ ${res.monto.toFixed(2)}.`);
                
                // --- INICIO DE LA CORRECCIÓN ---
                // 1. Forzamos el refresco llamando al botón
                $('#btnRefrescarDeudas').click();
                // --- FIN DE LA CORRECCIÓN ---

                modalNuevaDeuda.hide();
                form[0].reset();
                
                // Restauramos botón
                btnSubmit.prop('disabled', false).text(textoBotonOriginal); 
            })
            .withFailureHandler(err => {
                showError('Error al crear deuda', err.message);
                // Restauramos botón
                btnSubmit.prop('disabled', false).text(textoBotonOriginal);
            })
            .crearNuevaDeuda(datosDeuda);
    });


    /**
     * [MODIFICADO]
     * Lógica para cambiar entre las Pestañas (Tabs).
     * Ahora solo activa la pestaña y llama a la función de carga.
     */
    $('#panelGestionDeudas .nav-tabs .nav-link').on('click', function(e) {
        e.preventDefault();
        if ($(this).hasClass('active') && datosDeudasCache) {
            return; // No hacer nada si ya está activa y hay caché
        }
        
        $('#panelGestionDeudas .nav-tabs .nav-link').removeClass('active');
        $(this).addClass('active');
        
        // Llama a la función central (usará el caché)
        cargarDatosDeudas(false); 
    });

    /**
     * [MODIFICADO]
     * Evento para el botón de refrescar datos.
     * Ahora solo llama a la función de carga forzando el refresco.
     */
    $('#btnRefrescarDeudas').on('click', function() {
        showToast('info', 'Actualizando datos...');
        cargarDatosDeudas(true); // ¡Forzar refresco!
    });

    /**
     * [SIN CAMBIOS]
     * Evento para el botón "Registrar Pago".
     * (Se mantiene la lógica de SweetAlert)
     */
    $(document).on('click', '.pagar-deuda', function() {
        if (!appState.caja || appState.caja.Estado !== 'Abierta') {
            showError('Caja Cerrada', 'Debes tener una sesión de caja abierta.'); return;
        }
        const btnData = $(this).data();
        const saldoFormateado = Number(btnData.saldo).toFixed(2);
        Swal.fire({
            title: `Pagar Deuda de ${btnData.clienteNombre}`,
            html: `
                <p>Saldo pendiente: <strong>S/ ${saldoFormateado}</strong></p>
                <input type="number" id="swal-monto" class="swal2-input" placeholder="Monto a pagar" value="${saldoFormateado}" step="0.01" min="0.01" max="${saldoFormateado}">
                <select id="swal-metodo" class="swal2-select">
                    <option value="Efectivo">Efectivo</option>
                    <option value="Yape/Plin">Yape/Plin</option>
                    <option value="Tarjeta">Tarjeta</option>
                </select>
                <textarea id="swal-notas" class="swal2-textarea" placeholder="Notas del pago (opcional)"></textarea>
            `,
            confirmButtonText: 'Registrar Pago',
            showCancelButton: true,
            focusConfirm: false,
            preConfirm: () => {
                const monto = parseFloat(document.getElementById('swal-monto').value);
                if (!monto || monto <= 0 || monto > Number(btnData.saldo) + 0.01) {
                    Swal.showValidationMessage(`El monto debe ser válido y no mayor al saldo de S/ ${saldoFormateado}`);
                    return false;
                }
                return {
                    monto: monto,
                    metodoPago: document.getElementById('swal-metodo').value,
                    notas: document.getElementById('swal-notas').value
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const datosPago = {
                    deudaID: btnData.deudaId, 
                    clienteID: btnData.clienteId,
                    monto: result.value.monto,
                    metodoPago: result.value.metodoPago,
                    notas: result.value.notas,
                    sesionID: appState.caja.SesionID,
                    usuarioEmail: appState.user.email
                };
                showToast('info', 'Registrando pago...');
                google.script.run
                    .withSuccessHandler(res => {
                        // 'res' es ahora un objeto simple {message}
                        showToast('success', res.message);

                        // --- INICIO DE LA CORRECCIÓN ---
                        // 1. Forzamos el refresco llamando al botón
                        $('#btnRefrescarDeudas').click();
                        // --- FIN DE LA CORRECCIÓN ---
                    })
                    .withFailureHandler(err => showError('Error al registrar pago', err.message))
                    .registrarPagoDeDeuda(datosPago);
            }
        });
    });

    /** ============================================================
     *  15. MÓDULO PAGOS YAPE – FRONTEND JS (conexión con PagosYape.gs)
     * ============================================================ */
    // ===============================
    //  Inicialización del módulo
    // ===============================
    function initPagosYape() {

        console.log("Inicializando Pagos Yape...");
        
        // Usamos el ID directo que tienes en tu HTML
        const selectElement = $("#pmCliente");

        if (selectElement.length === 0) {
            console.error("ERROR CRÍTICO: No se encontró el elemento #pmCliente en el DOM.");
            return;
        }

        // 1. Cargar clientes usando tu función GLOBAL
        // Asegúrate de que 'cargarClientesEnSelects' esté definida globalmente
        if (typeof cargarClientesEnSelects === "function") {
             // Le pasamos el ID con el #
            cargarClientesEnSelects("#pmCliente"); 
        } else {
            console.error("La función global cargarClientesEnSelects no está definida.");
        }

        // 2. Cargar tabla de pagos
        cargarTablaPagos();

        // 3. Configurar Eventos (Evitando duplicados)
        $("#btnRefrescarPagos").off().on("click", function () {
            cargarTablaPagos();
        });

        $("#formPagoManual").off().on("submit", function (e) {
            e.preventDefault();
            registrarPagoManual();
        });

        console.log("PagosYape inicializado correctamente.");
    }
    // ============================================================
    //  Cargar la tabla principal de pagos (Manual + Automático)
    // ============================================================
    function cargarTablaPagos() {
      console.log("🚀 [FRONTEND] Iniciando carga de tabla de pagos...");
      
      // Mostrar indicador de carga visual
      $("#tablaHistorialPagos tbody").html('<tr><td colspan="10" class="text-center p-3"><div class="spinner-border text-primary"></div> Cargando...</td></tr>');

      google.script.run
        .withSuccessHandler((data) => {
          console.log("✅ [FRONTEND] Datos recibidos del backend:", data);
          pintarTablaPagos(data);
        })
        .withFailureHandler((err) => {
          console.error("❌ [FRONTEND] Error al traer pagos:", err);
          $("#tablaHistorialPagos tbody").html(`<tr><td colspan="10" class="text-center text-danger">Error: ${err.message}</td></tr>`);
        })
        .obtenerPagosYape();
    }

    // ============================================================
    //  Pintar Tabla Pagos (NUEVAS COLUMNAS)
    // ============================================================
    function pintarTablaPagos(data) {
      const tbody = $("#tablaHistorialPagos tbody");
      const thead = $("#tablaHistorialPagos thead");
      
      // Actualizar encabezados dinámicamente si es necesario, o asegúrate que tu HTML tenga:
      // <th>Fecha</th><th>Cliente</th><th>Monto</th><th>Código</th><th>Ref.</th><th>Método</th><th>Tipo</th><th>Nota</th><th>Registrado Por</th><th>Acciones</th>
      
      tbody.empty();

      if (!data || data.length === 0) {
         tbody.html('<tr><td colspan="10" class="text-center text-muted p-3">No hay pagos registrados.</td></tr>');
         return;
      }

      data.forEach((item) => {
        const color = obtenerColorMetodo(item.metodo);
        const esManual = item.tipo === "MANUAL";

        const acciones = esManual
          ? `<button class="btn btn-outline-danger btn-sm btn-eliminar-pago" data-id="${item.id}" title="Eliminar"><i class="bi bi-trash"></i></button>`
          : `<span class="text-muted"><i class="bi bi-robot" title="Automático"></i></span>`;

        tbody.append(`
          <tr>
            <td style="white-space:nowrap;">${item.fecha}</td>
            <td><small class="fw-bold">${item.cliente}</small></td>
            <td class="text-success fw-bold">S/ ${Number(item.monto).toFixed(2)}</td>
            <td><span class="badge bg-light text-dark border">${item.codigo}</span></td>
            <td><small>${item.referencia}</small></td>
            <td><span class="badge" style="background:${color}">${item.metodo}</span></td>
            <td>
              ${item.tipo === "AUTOMATICO" 
                ? '<span class="badge bg-indigo">Auto</span>' 
                : '<span class="badge bg-secondary">Manual</span>'}
            </td>
            <td><small class="text-muted fst-italic">${item.nota}</small></td>
            <td><small>${item.usuario || '-'}</small></td>
            <td>${acciones}</td>
          </tr>
        `);
      });
    }

    // =====================================================================
    //  LISTENER PARA ELIMINAR PAGO (Solución al error de scope)
    // =====================================================================
    $(document).on('click', '.btn-eliminar-pago', function() {
        // 1. Obtenemos el ID del atributo data-id
        const id = $(this).data('id');
        
        // 2. Llamamos a tu función interna
        eliminarPagoManual(id);
    });

    // =====================================================================
    //  Registrar Pago Manual (CON DATOS DE SESIÓN)
    // =====================================================================
    function registrarPagoManual() {
      if (!appState.caja || appState.caja.Estado !== 'Abierta') {
         Swal.fire("Caja Cerrada", "Debes tener turno abierto para registrar ingresos.", "warning");
         return;
      }

      // Capturar el nombre del cliente desde el texto del select
      let clienteNombre = "Cliente Varios";
      const clienteSelect = $("#pmCliente option:selected");
      if (clienteSelect.val()) {
          clienteNombre = clienteSelect.text(); // Ej: "Machelo - Roger..."
      }

      const data = {
        fecha: $("#pmFecha").val() || new Date().toISOString().split("T")[0],
        monto: parseFloat($("#pmMonto").val()),
        cliente: clienteNombre,
        metodo: $("#pmMetodo").val(),
        codigo: $("#pmCodigo").val() || "-",
        referencia: $("#pmReferencia").val() || "-",
        nota: $("#pmNota").val() || "",
        // Datos de sesión
        sesionID: appState.caja.SesionID,
        usuarioEmail: appState.user.email
      };

      if (!data.monto || data.monto <= 0) {
        Swal.fire("Error", "El monto debe ser mayor a 0", "error");
        return;
      }

      const btn = $("#formPagoManual button[type='submit']");
      btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Guardando...');

      google.script.run
        .withSuccessHandler(() => {
          Swal.fire({
              icon: 'success',
              title: 'Registrado',
              text: 'Pago guardado exitosamente.',
              timer: 2000,
              showConfirmButton: false
          });
          
          // Limpiar formulario pero mantener fecha actual
          $("#formPagoManual")[0].reset();
          $("#pmFecha").val(new Date().toISOString().split("T")[0]);
          
          cargarTablaPagos();
          btn.prop('disabled', false).html('<i class="bi bi-save me-2"></i>Registrar Pago');
        })
        .withFailureHandler(err => {
            Swal.fire("Error", err.message, "error");
            btn.prop('disabled', false).html('<i class="bi bi-save me-2"></i>Registrar Pago');
        })
        .registrarPagoManual(data);
    }

    // =====================================================================
    //  Eliminar Pago Manual
    // =====================================================================
    function eliminarPagoManual(id) {
      Swal.fire({
        title: "¿Eliminar pago?",
        text: "Esta acción no se puede deshacer.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Eliminar",
      }).then((res) => {
        if (res.isConfirmed) {
          google.script.run
            .withSuccessHandler(() => {
              Swal.fire("Eliminado", "Pago eliminado correctamente", "success");
              cargarTablaPagos();
            })
            .eliminarPagoManual(id);
        }
      });
    }

    // =====================================================================
    //  Editar Pago Manual
    // =====================================================================
    function editarPagoManual(id) {
      Swal.fire({
        title: "Editar monto",
        input: "number",
        inputAttributes: { step: "0.10" },
        showCancelButton: true,
        confirmButtonText: "Guardar",
      }).then((res) => {
        if (res.isConfirmed) {
          const nuevoMonto = res.value;

          if (nuevoMonto <= 0) {
            Swal.fire("Error", "El monto no es válido", "error");
            return;
          }

          const data = {
            fecha: new Date().toISOString().split("T")[0],
            monto: nuevoMonto,
            metodo: "YAPE",
            codigo: "-",
          };

          google.script.run
            .withSuccessHandler(() => {
              Swal.fire("Actualizado", "Pago actualizado", "success");
              cargarTablaPagos();
            })
            .editarPagoManual(id, data);
        }
      });
    }

    // =====================================================================
    //  Colores por tipo de pago (bancos)
    // =====================================================================
    function obtenerColorMetodo(m) {
      switch (m) {
        case "YAPE": return "#7b2cbf";
        case "PLIN": return "#00bcd4";
        case "INTERBANK": return "#00a859";
        case "BBVA": return "#0039a6";
        case "BCP": return "#ff6600";
        case "SCOTIABANK": return "#c8102e";
        case "EFECTIVO": return "#198754";
        default: return "#6c757d";
      }
    }

    // =====================================================================
    //  16. MÓDULO DE GESTIÓN DE EGRESOS (FRONTEND)
    // =====================================================================

    /**
     * Carga la tabla de egresos de la sesión actual.
     * Se llama desde el Switch de navegación.
     */
    function cargarHistorialEgresos() {
        if (!appState.caja || appState.caja.Estado !== 'Abierta') {
            $("#tablaEgresosBody").html('<tr><td colspan="5" class="text-center text-muted">No hay sesión de caja activa.</td></tr>');
            return;
        }

        console.log("Cargando historial de egresos...");
        $("#tablaEgresosBody").html('<tr><td colspan="5" class="text-center"><div class="spinner-border text-primary spinner-border-sm"></div> Cargando...</td></tr>');

        google.script.run
            .withSuccessHandler(renderizarTablaEgresos)
            .withFailureHandler(err => {
                console.error(err);
                showError("Error al cargar gastos", err.message);
            })
            .obtenerEgresosSesionActual(appState.caja.SesionID);
    }

    /**
     * Pinta la tabla de egresos en el HTML.
     */
    function renderizarTablaEgresos(egresos) {
        const tbody = $("#tablaEgresosBody"); // Asegúrate que tu tabla en HTML tenga este ID en el tbody
        tbody.empty();

        if (!egresos || egresos.length === 0) {
            tbody.html('<tr><td colspan="5" class="text-center text-muted fst-italic">No hay gastos registrados en este turno.</td></tr>');
            return;
        }

        egresos.forEach(egreso => {
            // Estilo según tipo
            let badgeClass = 'bg-secondary';
            if (egreso.tipo === 'GASTO_GENERAL') badgeClass = 'bg-warning text-dark';
            if (egreso.tipo === 'COMPRA_MERCADERIA') badgeClass = 'bg-info text-dark';
            if (egreso.tipo === 'RETIRO_EFECTIVO') badgeClass = 'bg-danger';

            const fila = `
                <tr>
                    <td>${egreso.fecha}</td>
                    <td><span class="badge ${badgeClass}">${egreso.tipo}</span></td>
                    <td>${egreso.descripcion}</td>
                    <td class="fw-bold text-danger">- S/ ${Number(egreso.monto).toFixed(2)}</td>
                    <td><small class="text-muted">${egreso.id}</small></td>
                </tr>
            `;
            tbody.append(fila);
        });
    }

    // --- Evento para el Botón "Guardar Gasto" (en el Modal) ---
    // Asegúrate de que este evento se declare una sola vez (ej. en $(document).ready)
    $('#formRegistrarEgreso').on('submit', function(e) {
        e.preventDefault();
        
        if (!appState.caja || appState.caja.Estado !== 'Abierta') {
            showError('Caja Cerrada', 'Debes tener turno abierto.');
            return;
        }

        const datosEgreso = {
            tipo: $('#egresoTipo').val(), // Asegúrate de usar el <select> que te recomendé antes
            monto: parseFloat($('#egresoMonto').val()),
            descripcion: $('#egresoDescripcion').val(),
            sesionID: appState.caja.SesionID,
            usuarioEmail: appState.user.email
        };

        const btn = $(this).find('button[type="submit"]');
        btn.prop('disabled', true).text('Guardando...');

        google.script.run
            .withSuccessHandler(res => {
                showToast('success', res.message);
                modalRegistrarEgreso.hide();
                $('#formRegistrarEgreso')[0].reset();
                cargarHistorialEgresos(); // Recargar la tabla automáticamente
                btn.prop('disabled', false).text('Guardar Egreso');
            })
            .withFailureHandler(err => {
                showError('Error', err.message);
                btn.prop('disabled', false).text('Guardar Egreso');
            })
            .registrarNuevoEgreso(datosEgreso);
    });

  });
</script>

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
    const modalAbrirCaja = new bootstrap.Modal(
      document.getElementById('modalAbrirCaja'),
      { backdrop: 'static', keyboard: false }
    );
    const modalCerrarCaja = new bootstrap.Modal(
      document.getElementById('modalCerrarCaja')
    );
    const modalProducto = new bootstrap.Modal(
      document.getElementById('modalProducto')
    );
    const modalMovimiento = new bootstrap.Modal(
      document.getElementById('modalMovimiento')
    );
    const modalPrevisualizacionImportar = new bootstrap.Modal(
      document.getElementById('modalPrevisualizacionImportar')
    );
    const modalDetalleVenta = new bootstrap.Modal(
      document.getElementById('modalDetalleVenta')
    );
    const modalNuevaDeuda = new bootstrap.Modal(
      document.getElementById('modalNuevaDeuda')
    );
    const modalRegistrarPago = new bootstrap.Modal(
      document.getElementById('modalRegistrarPago')
    );
    const modalRegistrarEgreso = new bootstrap.Modal(
      document.getElementById('modalRegistrarEgreso')
    );

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
        pageLength: 10
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
          VerHistorial: '#btnHistorialVentas'
        },
        Inventario: {
          Ver: '#panelInventario',
          Registrar: '#btnAgregarProducto, #btnImportarInventario'
        },
        Pagos: {
          Ver: '#panelPagos',
          Registrar: '#btnRegistrarPago'
        },
        Deudas: {
          Ver: '#panelDeudas',
          Registrar: '#btnNuevaDeuda'
        },
        Gastos: {
          Ver: '#panelGastos',
          Registrar: '#btnRegistrarEgreso'
        },
        Reportes: {
          Ver: '#panelReportes'
        },
        Administracion: {
          Ver: '#adminSubmenu',
          GestionarEmpleados: '#panelAdminEmpleados',
          GestionarPermisos: '#panelAdminPermisos'
        },
        Caja: {
          Cerrar: '#btnCerrarCaja'
        }
      };

      // Ocultar elementos no permitidos
      Object.keys(permisosDOM).forEach(modulo => {
        Object.keys(permisosDOM[modulo]).forEach(accion => {
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
     * Maneja el envío del formulario de login.
     */
    $('#loginForm').off('submit').on('submit', function (event) {
      event.preventDefault();
      const email = $('#username').val().trim();
      const password = $('#password').val().trim();

      if (!email || !password) {
        showError('Campos vacíos', 'Por favor, completa todos los campos.');
        return;
      }

      setLoginButtonState(true);

      google.script.run
        .withSuccessHandler((user) => {
          appState.user = user;
          $('#loginPage').hide();
          $('#mainApp').show();
          $('#user-name').text(user.nombre);
          $('#user-email').text(user.email);
          restrictUIByPermissions(); // Aplicar restricciones de permisos
          verificarEstadoDeCajaAlCargar();
          showToast('success', `Bienvenido, ${user.nombre}`);
        })
        .withFailureHandler((err) => {
          showError('Error de inicio de sesión', err.message);
          setLoginButtonState(false);
        })
        .iniciarSesion(email, password);
    });

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
        }
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
     * ★★★ LÓGICA DE PERMISOS REFACTORIZADA ★★★
     * Recorre los permisos del usuario y muestra u oculta elementos de la UI.
     * CADA elemento interactivo en el HTML debe tener el atributo `data-perm="Modulo.Accion"`.
     * Ejemplo: <button data-perm="Ventas.crear">Nueva Venta</button>
     */
    function setupPermissions() {
      const permisos = appState.user.permisos;

      // Ocultar TODO lo que requiera un permiso para empezar
      $('[data-perm]').hide();

      // Recorrer los permisos del usuario y mostrar los elementos permitidos
      for (const modulo in permisos) {
        for (const accion in permisos[modulo]) {
          if (permisos[modulo][accion] === true) {
            // Muestra el elemento que coincide exactamente con "Modulo.Accion"
            $(`[data-perm="${modulo}.${accion}"]`).show();
          }
        }
      }
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

    // Inicialización de modales (asegúrate de que existan en el HTML)
    // const modalProducto = new bootstrap.Modal(document.getElementById('modalProducto'));
    // const modalMovimiento = new bootstrap.Modal(document.getElementById('modalMovimiento'));
    // const modalPrevisualizacionImportar = new bootstrap.Modal(document.getElementById('modalPrevisualizacionImportar'));

    // --- Utilidades de números/moneda (región es-PE + PEN) ---
    const toNumber = (v) => Number(String(v ?? '').toString().replace(',', '.')) || 0;
    const formatPEN = (n) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n || 0);

    // Escapar valor para usar en regex de DataTables
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // --- Carga y Renderizado de la UI ---
    function cargarModuloInventario() {
      if (
        appState.user &&
        appState.user.permisos?.Inventario &&
        appState.user.permisos.Inventario.ver
      ) {
        google.script.run
          .withSuccessHandler((inventario) => {
            inventarioCompleto = inventario || [];
            renderizarTablaInventario(inventarioCompleto);
            actualizarDashboardInventario(inventarioCompleto);
            cargarFiltrosInventario(inventarioCompleto);

            // Llenar datalist de SKUs si existe en el DOM
            const $listaSkus = $('#listaSkus');
            if ($listaSkus.length) {
              $listaSkus.empty();
              inventarioCompleto.forEach((p) =>
                $listaSkus.append(`<option value="${p.SKU}">${p.Nombre}</option>`)
              );
            }
          })
          .withFailureHandler((err) => showError('Error al cargar inventario', err?.message || String(err)))
          .obtenerInventarioCompleto();
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
        stock,           // num para ordenar
        stockMin,        // num para ordenar
        precioCosto,     // num para ordenar
        precioVenta,     // num para ordenar
        valorStock,      // num para ordenar
        // Acciones (HTML)
        `
          <div class="btn-group" role="group">
            <button class="btn btn-sm btn-outline-info ver-historial-producto" title="Ver Historial (Kardex)"><i class="bi bi-list-ol"></i></button>
            <button class="btn btn-sm btn-outline-primary btn-editar-producto" data-perm="Inventario.editar" title="Editar Producto"><i class="bi bi-pencil-square"></i></button>
            ${estado === 'Activo' ? `<button class="btn btn-sm btn-outline-danger btn-desactivar-producto" data-perm="Inventario.eliminar" title="Desactivar Producto"><i class="bi bi-slash-circle"></i></button>` : ''}
          </div>
        `,
        p,           // 10: objeto producto (oculto)
        claseFila    // 11: clase fila (oculto)
      ];
    });

    if (tablaDT) {
      tablaDT.clear();
      tablaDT.rows.add(dataTableData).draw();
      return;
    }

    tablaDT = $('#tablaInventario').DataTable({
      data: dataTableData,
      language: { url: '//cdn.datatables.net/plug-ins/1.10.25/i18n/Spanish.json' },
      columns: [
        { title: 'SKU' },
        { title: 'Nombre' },
        { title: 'Código Barras' },
        { title: 'Categoría' },
        // Render numéricos con formato para display pero manteniendo sort por valor
        { title: 'Stock', render: (d, t) => (t === 'display' ? `<span class="fw-bold ${d <= 0 ? 'text-danger' : ''}">${d}</span>` : d) },
        { title: 'Stock Mínimo', render: (d, t) => (t === 'display' ? `${d}` : d) },
        { title: 'Precio Costo', render: (d, t) => (t === 'display' ? `${formatPEN(d)}` : d) },
        { title: 'Precio Venta', render: (d, t) => (t === 'display' ? `${formatPEN(d)}` : d) },
        { title: 'Valor Stock', render: (d, t) => (t === 'display' ? `${formatPEN(d)}` : d) },
        { title: 'Acciones', orderable: false, searchable: false },
        { visible: false, searchable: false }, // objeto producto
        { visible: false, searchable: false }, // clase fila
      ],
      createdRow: function (row, data) {
        $(row).addClass(data[11]);
        $(row).data('producto', data[10]);
      }
    });

    // Filtro por Categoría (col 3) con match exacto, escapando regex
    $('#filtroCategoria').off('change').on('change', function () {
      const v = this.value;
      if (!v) {
        tablaDT.column(3).search('').draw();
      } else {
        tablaDT.column(3).search(`^${escapeRegex(v)}$`, true, false).draw();
      }
    });

    // Filtro por Estado (custom) solo para esta tabla
    let estadoFiltro = '';
    let estadoFiltroRegistrado = false;
    const filtroEstadoFn = function (settings, data, dataIndex) {
      if (!estadoFiltro) return true; // sin filtro
      // limitar al id de nuestra tabla
      if (settings.nTable && settings.nTable.id !== 'tablaInventario') return true;
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

    $('#filtroEstado').off('change').on('change', function () {
      estadoFiltro = this.value || '';
      tablaDT.draw();
    });
  }

    function actualizarDashboardInventario(inventario) {
      const valorTotal = inventario.reduce(
        (sum, p) => sum + Number(p.Stock) * Number(p.PrecioCosto),
        0
      );
      const itemsBajoStock = inventario.filter(
        (p) => p.Estado === 'Activo' && Number(p.Stock) <= Number(p.StockMinimo)
      ).length;
      $('#valorTotalInventario').text(`S/ ${valorTotal.toFixed(2)}`);
      $('#totalSkus').text(inventario.length);
      $('#itemsStockBajo').text(itemsBajoStock);
    }

    function abrirModalProducto(producto = null) {
      const esEdicion = producto !== null;
      $('#formProducto')[0].reset();

      $('#modalProductoLabel').text(
        esEdicion ? 'Editar Producto' : 'Agregar Nuevo Producto'
      );
      $('#prodSku').prop('disabled', esEdicion);

      if (esEdicion) {
        $('#prodSku').val(producto.SKU);
        $('#prodNombre').val(producto.Nombre);
        $('#prodCodigoBarras').val(producto.CodigoBarras);
        $('#prodStock').val(producto.Stock).prop('disabled', true);
        $('#prodStockMin').val(producto.StockMinimo);
        $('#prodPrecioCosto').val(producto.PrecioCosto);
        $('#prodPrecioVenta').val(producto.PrecioVenta);
        $('#prodImagenUrl').val(producto.ImagenURL);
        google.script.run
          .withSuccessHandler((categorias) => {
            const select = $('#prodCategoria')
              .empty()
              .append('<option value="">Seleccione o cree una...</option>');
            categorias.forEach((cat) =>
              select.append(`<option value="${cat}">${cat}</option>`)
            );
            $('#prodCategoria').val(producto.Categoria);
          })
          .obtenerCategoriasUnicas();
      } else {
        $('#prodStock').prop('disabled', false);
        google.script.run
          .withSuccessHandler((categorias) => {
            const select = $('#prodCategoria')
              .empty()
              .append('<option value="">Seleccione o cree una...</option>');
            categorias.forEach((cat) =>
              select.append(`<option value="${cat}">${cat}</option>`)
            );
          })
          .obtenerCategoriasUnicas();
      }

      modalProducto.show();
    }

    // --- Manejadores de Eventos ---

    $('#btnVerInventario').on('click', function () {
      const panel = $('#panelGestionInventario');
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
      $('#formMovimiento')[0].reset();
      modalMovimiento.show();
    });

    $('#formMovimiento').on('submit', function (e) {
      e.preventDefault();
      const movimiento = {
        sku: $('#movSku').val(),
        tipo: $('#movTipo').val(),
        cantidad: Number($('#movCantidad').val()),
        notas: $('#movNotas').val(),
        emailUsuario: appState.user.email,
      };
      if (movimiento.tipo !== 'INGRESO') movimiento.cantidad *= -1; // Convertir a negativo si es salida
      if (movimiento.cantidad === 0) {
        showError('Cantidad inválida', 'La cantidad no puede ser cero.');
        return;
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
                productosValidos.forEach((p) =>
                  tbody.append(
                    `<tr>${headers.map((h) => `<td>${p[h]}</td>`).join('')}</tr>`
                  )
                );
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
            tablaHtml += `<tr><td>${mov.FechaHora}</td><td>${mov.Tipo}</td><td class="${cantClass} fw-bold">${cantSigno}${mov.Cantidad}</td><td>${mov.UsuarioEmail}</td><td>${mov.Notas}</td></tr>`;
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

    // --- Lógica de la Galería de Productos y Carrito ---

    function cargarProductosParaVenta() {
      google.script.run
        .withSuccessHandler((productos) => {
          appState.productos = productos;
          const categorias = [
            'Todos',
            ...new Set(productos.map((p) => p.categoria || 'Varios')),
          ];
          const botonesCategorias = $('#botonesCategorias').empty();
          categorias.forEach((cat) => {
            const activeClass = cat === 'Todos' ? 'active' : '';
            botonesCategorias.append(
              `<button type="button" class="btn btn-outline-primary btn-sm m-1 ${activeClass} btnCategoria" data-categoria="${cat}">${cat}</button>`
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
        const imagen = escapeHTML(prod.imagen || 'https://via.placeholder.com/150');
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

    $('#btnFinalizarVenta').on('click', function () {
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
      const btn = $(this);
      btn
        .prop('disabled', true)
        .html(
          '<span class="spinner-border spinner-border-sm"></span> Registrando Orden...'
        );
      const clienteSeleccionado = $('#selectCliente option:selected');
      const ordenData = {
        carrito: appState.carrito,
        cliente: {
          dni: clienteSeleccionado.val(),
          nombre: clienteSeleccionado.text(),
        },
        pc: $('#selectPc').val(),
        sesionID: appState.caja.SesionID,
        usuarioEmail: appState.user.email,
      };
      google.script.run
        .withSuccessHandler((resultado) => {
          Swal.fire({
            icon: 'success',
            title: 'Orden Registrada',
            text: `La orden ${resultado.ventaID} por un total de S/ ${resultado.total.toFixed(2)} ha sido registrada y está pendiente de pago.`,
          });
          resetearFormularioVenta();
          btn
            .prop('disabled', false)
            .html('<i class="bi bi-check-circle"></i> Finalizar Venta'); // <-- CORRECCIÓN
        })
        .withFailureHandler((err) => {
          showError('Error al Registrar Orden', err.message);
          btn
            .prop('disabled', false)
            .html('<i class="bi bi-check-circle"></i> Finalizar Venta'); // <-- CORRECCIÓN
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
   * --- VERSIÓN RECUPERADA (02/AGOSTO) ---
   * Renderiza el historial de ventas en la tabla y se asegura de que DataTables
   * se reinicialice correctamente después de cada actualización de datos.
   * @param {Array<Object>} ventas - El array de objetos de venta del servidor.
   */
  function renderizarHistorial(ventas) {
      // Primero, verificamos si la tabla ya es una DataTable.
      if ($.fn.DataTable.isDataTable('#tablaHistorial')) {
          // Si ya existe, la destruimos por completo. Esto es clave.
          $('#tablaHistorial').DataTable().destroy();
      }

      // Ahora que la tabla está "limpia", vaciamos el tbody para prepararlo para los nuevos datos.
      const tbody = $('#historialBody').empty();

      if (!ventas || ventas.length === 0) {
          tbody.html('<tr><td colspan="7" class="text-center text-muted">No se encontraron ventas para mostrar.</td></tr>');
      } else {
          // Llenamos el tbody con las nuevas filas.
          ventas.forEach((venta) => {
              const estado = escapeHTML(venta.Estado);
              const ventaId = escapeHTML(venta.VentaID);
              const usuario = escapeHTML(venta.UsuarioEmail);
              const cliente = escapeHTML(venta.ClienteNombre);
              const estadoBadge = obtenerBadgeEstado(venta.Estado);
              const botonesAccion = generarBotonesAccion(venta.Estado, venta.VentaID);
              const fila = `
                  <tr>
                      <td>${ventaId}</td>
                      <td>${formatearFechaHora(venta.FechaHora)}</td>
                      <td>${usuario}</td>
                      <td>${cliente}</td>
                      <td>S/ ${Number(venta.Total).toFixed(2)}</td>
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
      const btnVer = `<button class="btn btn-sm btn-info ver-detalles" data-id="${ventaID}" title="Ver Detalles"><i class="fas fa-eye"></i></button>`;
      
      if (estado === 'Pendiente') {
          const btnConfirmar = `<button class="btn btn-sm btn-success btn-confirmar-venta" data-id="${ventaID}" title="Confirmar Venta"><i class="fas fa-check"></i></button>`;
          const btnCancelar = `<button class="btn btn-sm btn-danger btn-cancelar-venta" data-id="${ventaID}" title="Cancelar Venta"><i class="fas fa-times"></i></button>`;
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
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: true
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

    $(document).on('click', '.cancelar-venta', function () {
      const ventaID = $(this).data('id');
      Swal.fire({
        title: '¿Cancelar esta venta?',
        text: `Se cancelará la venta ${ventaID} y el stock será devuelto. ¡Esta acción no se puede deshacer!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, ¡cancelar!',
      }).then((result) => {
        if (result.isConfirmed) {
          google.script.run
            .withSuccessHandler((res) => {
              Swal.fire('Cancelada', res, 'success');
              cargarHistorialVentas();
            })
            .withFailureHandler((err) => showError('Error', err.message))
            .cancelarVenta(ventaID);
        }
      });
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
    // 11. MÓDULO DE LÓGICA DE CAJA
    //----------------------------------------------------

    // const modalAbrirCaja = new bootstrap.Modal(document.getElementById('modalAbrirCaja'), {
    //   backdrop: 'static',
    //   keyboard: false
    // });
    // const modalCerrarCaja = new bootstrap.Modal(document.getElementById('modalCerrarCaja'));
    let resumenDeCierreCache = null;

    /**
     * Verifica el estado de la caja al iniciar la app. Si está cerrada,
     * bloquea la UI y muestra el modal de apertura.
     */
    function verificarEstadoDeCajaAlCargar() {
      google.script.run
        .withSuccessHandler((sesionAbierta) => {
          if (sesionAbierta) {
            appState.caja = sesionAbierta;
            $('#cajaBlocker').hide(); // Asegúrate de tener <div id="cajaBlocker"> en tu HTML
            $('#btnCerrarCaja').show();
            showToast(
              'info',
              `Sesión de caja ${sesionAbierta.SesionID} ya está activa.`
            );
            inicializarDashboard(); // Ahora que la caja está verificada, cargamos el dashboard
          } else {
            appState.caja = null;
            $('#cajaBlocker').show();
            modalAbrirCaja.show();
            $('#btnCerrarCaja').hide();
          }
        })
        .withFailureHandler((err) => {
          showError(
            'Error Crítico de Caja',
            'No se pudo verificar el estado de la caja: ' + err.message
          );
          $('#cajaBlocker').show(); // Bloquear por seguridad
        })
        .obtenerEstadoCajaActual();
    }

    // Evento para el formulario de abrir caja
    $('#formAbrirCaja').on('submit', function (e) {
      e.preventDefault();
      const monto = parseFloat($('#montoApertura').val());
      if (isNaN(monto) || monto < 0) {
        showError(
          'Monto inválido',
          'Por favor, ingresa un monto de apertura válido.'
        );
        return;
      }
      const btn = $(this).find('button[type="submit"]');
      btn
        .prop('disabled', true)
        .html(
          '<span class="spinner-border spinner-border-sm"></span> Abriendo...'
        );

      google.script.run
        .withSuccessHandler((nuevaSesion) => {
          appState.caja = nuevaSesion;
          modalAbrirCaja.hide();
          $('#cajaBlocker').fadeOut();
          Swal.fire(
            '¡Caja Abierta!',
            `Turno iniciado con S/ ${monto.toFixed(2)}`,
            'success'
          );
          $('#btnCerrarCaja').show();
          inicializarDashboard();
          btn.prop('disabled', false).text('Iniciar Caja'); // <-- CORRECCIÓN
        })
        .withFailureHandler((err) => {
          showError('Error', err.message);
          btn.prop('disabled', false).text('Iniciar Caja'); // <-- CORRECCIÓN
        })
        .iniciarNuevaSesion(monto, appState.user.email);
    });

    // Evento para el botón de cerrar caja
    $('#btnCerrarCaja').on('click', function () {
      showToast('info', 'Calculando resumen del turno...');
      google.script.run
        .withSuccessHandler((resumen) => {
          resumenDeCierreCache = resumen;
          // Llenar los campos del resumen en el modal
          $('#cierreTotalVentasApp').text(
            `S/ ${resumen.totalVentasApp.toFixed(2)}`
          );
          $('#cierreQVentas').text(resumen.qVentas);
          $('#cierrePagosDeuda').text(
            `S/ ${resumen.totalPagosDeudaEfectivo.toFixed(2)}`
          );
          $('#cierreYapePlin').text(`S/ ${resumen.totalYapePlin.toFixed(2)}`);
          $('#cierreDeudasNuevas').text(
            `S/ ${resumen.totalDeudasNuevas.toFixed(2)}`
          );
          $('#cierreEgresos').text(`S/ ${resumen.totalGastos.toFixed(2)}`);

          $('#formCerrarCaja')[0].reset();
          calcularCierreCajaDefinitivo();
          modalCerrarCaja.show();
        })
        .withFailureHandler((err) =>
          showError('Error al obtener resumen', err.message)
        )
        .obtenerResumenParaCierre(appState.caja.SesionID);
    });

    // Calcular el cierre en tiempo real al escribir en los inputs
    $('#cierreMontoCyberplanet, #cierreMontoReal').on(
      'input',
      calcularCierreCajaDefinitivo
    );

    function calcularCierreCajaDefinitivo() {
      if (!resumenDeCierreCache) return;
      const montoCyber = parseFloat($('#cierreMontoCyberplanet').val() || 0);
      const montoReal = parseFloat($('#cierreMontoReal').val() || 0);

      // Aplicamos la fórmula del backend
      const esperado =
        montoCyber +
        resumenDeCierreCache.totalPagosDeudaEfectivo -
        resumenDeCierreCache.totalYapePlin -
        resumenDeCierreCache.totalDeudasNuevas -
        resumenDeCierreCache.totalGastos;
      $('#cierreMontoEsperado').text(`S/ ${esperado.toFixed(2)}`);

      const diferencia = montoReal - esperado;
      const elDiferencia = $('#cierreDiferencia');
      elDiferencia.text(`S/ ${diferencia.toFixed(2)}`);
      elDiferencia
        .removeClass('text-success text-danger text-warning')
        .addClass(
          diferencia === 0
            ? 'text-success'
            : diferencia > 0
              ? 'text-warning'
              : 'text-danger'
        );
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
      btn
        .prop('disabled', true)
        .html(
          '<span class="spinner-border spinner-border-sm"></span> Cerrando...'
        );

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
          btn.prop('disabled', false).text('Guardar y Cerrar Turno'); // <-- CORRECCIÓN
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
  });
</script>

# RA GYM · versión mejorada

Esta entrega conserva la conexión pública de `sitio/config.js` enviada en el segundo ZIP. No contiene claves administrativas. Es un sitio estático: para publicarlo no necesitas Node, instalar paquetes ni compilar.

## Actualizar tu sistema existente

1. Haz un respaldo de tu base de datos desde Supabase antes de actualizarla.
2. En tu proyecto de Supabase abre **SQL Editor**, pega el contenido completo de `base-de-datos/4_actualizar_inscripcion.sql` y pulsa **Run**. Se ejecuta en una transacción, se puede repetir y no elimina socios ni pagos. No ejecutes el archivo de socios de ejemplo sobre la base real.
3. Publica la carpeta **sitio completa**, incluyendo `assets`, `vendor` y `cuotas.js`, en el mismo alojamiento que usabas. Conserva tu dominio y recarga con Ctrl+F5.
4. Entra a recepción con tu cuenta habitual. Revisa la fecha de inscripción de los socios anteriores y prueba el acceso de un cliente.

La actualización SQL es necesaria **antes** de publicar el sitio nuevo. La aplicación anterior no conoce la fecha de inscripción y sus altas/ediciones dejan de ser compatibles con las nuevas funciones; actualiza ambos componentes en la misma ventana de mantenimiento.

Si partes de una base nueva, usa `1_crear_base_de_datos.sql` y luego `2_dar_permiso_a_recepcion.sql` siguiendo `GUIA.md`. El archivo 1 ya incluye los cambios; en ese caso no hace falta ejecutar también el 4.

## Qué cambió

- Acceso de **Cliente** seleccionado primero, también después de cerrar sesión. Pestañas accesibles por teclado.
- Interfaz clara, adaptable a celular y computadora, con fondo adaptado a partir de la imagen de gimnasio adjunta, superficies blancas y estados identificados por texto y color.
- Recepción: filtros **Activos**, **Al día**, **Con retraso**, **De baja**; búsquedas separadas por **nombre** y **CI**. Se pueden combinar. El nombre admite búsquedas sin acentos; la CI admite puntos y espacios.
- Alta y edición con **fecha exacta de inscripción**. La primera cuota vence ese día y las siguientes el mismo día de cada mes. Si ese día no existe en un mes, vence el último día: 31/01 → 28/02 → 31/03. En año bisiesto, 29/02.
- Se mantienen los períodos `AAAA-MM` y los pagos anteriores: no se regeneran ni borran.
- Los socios antiguos reciben como fecha inicial el primer día del mes que ya tenían registrado. No existe información suficiente para adivinar su fecha exacta; recepción puede corregirla. No se permite mover la inscripción después de un pago existente.
- **Fecha de pago** elegible con calendario. Registra cuándo se recibió el dinero, entre la inscripción y hoy; no cambia el vencimiento mensual. Se pueden registrar varias cuotas y adelantos. El formulario muestra los períodos cubiertos y sus vencimientos.
- El cliente ve su fecha de inscripción, estado, carnet e historial de pagos.
- Fuentes y biblioteca Supabase incluidas localmente para reducir dependencias de servicios externos. La base de datos sigue necesitando conexión a Internet.

## Pruebas y límites

Comprobado: 11 pruebas de reglas de cuotas y búsqueda; instalación SQL limpia y repetida; migración desde el esquema original con datos conservados; crear socio, consultar PIN, registrar pagos y controles de permisos en PostgreSQL embebido (PGlite con pgcrypto). Flujo de pantallas probado en Chromium con Supabase simulado, en escritorio y móvil, sin errores JavaScript ni desbordamiento horizontal.

Las capturas de `capturas/` usan datos ficticios de prueba. No muestran datos de tu base.

La conexión real desde el entorno de trabajo está pendiente: el proxy bloquea el dominio del proyecto con HTTP 403. Se guardó su permiso en el borrador de configuración del entorno. Un borrador no aplica el permiso ni publica la aplicación. Tampoco se aplicó la migración al proyecto real: una clave pública de navegador no autoriza administrar el esquema SQL. Usa el SQL Editor de Supabase para el paso 2.

## Desarrollo local

Desde esta carpeta:

```sh
python -m http.server 8000 --directory sitio
```

En tu computadora puedes abrir el puerto 8000 en el navegador. Este servidor es solo para desarrollo; publica `sitio/` en un alojamiento estático para uso diario.

Las reglas se prueban sin instalar dependencias:

```sh
node --test tests/cuotas.test.cjs
```

Para las pruebas opcionales de base de datos y navegador (Node 22 o superior, Linux x64 para el Chromium incluido):

```sh
npm ci
npm run test:db
npm run test:ui
```

La prueba de navegador inicia su propio servidor temporal y guarda capturas. Las pruebas no contactan tu Supabase ni modifican datos reales. `tests/fixtures/esquema-original.sql` es exclusivamente la base anterior para comprobar la migración, no un archivo para ejecutar sobre producción.

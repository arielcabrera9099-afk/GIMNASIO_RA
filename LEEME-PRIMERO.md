# RA GYM · versión mejorada

Esta entrega conserva la conexión pública de `sitio/config.js` enviada en el segundo ZIP. No contiene claves administrativas. Es un sitio estático: para publicarlo no necesitas Node, instalar paquetes ni compilar.

## Logo del gimnasio

El acceso, las cabeceras y los íconos del navegador y de instalación usan una versión digital adaptada del logo RA Training Gym adjunto, en blanco y negro. El archivo está en `sitio/assets/logo-ra-training-gym.png`. Para activar este cambio solo vuelve a subir la carpeta `sitio` completa a Netlify y recarga con Ctrl+F5; no requiere cambios en Supabase.

## Confirmación por WhatsApp sin API de pago

Esta mejora **no requiere SQL nuevo**. Si ya usas la versión anterior, vuelve a subir `sitio/` completa a Netlify, incluido el nuevo archivo `whatsapp.js`.

1. En **Nuevo socio** o **Editar datos**, completa **Teléfono / WhatsApp**. Para Paraguay acepta `0981 123456`, `981123456` o `+595 981 123456`; el enlace usa el código internacional +595. Para otros países, escribe el número con `+` y código de país.
2. Registra la cuota como siempre. Después de guardarla aparece **Confirmación de pago**, con los meses realmente abonados, monto total, fecha y estado de cuotas.
3. Revisa el número y pulsa **Enviar confirmación por WhatsApp**. Se abrirá WhatsApp o WhatsApp Web con el mensaje preparado. **Debes pulsar Enviar dentro de WhatsApp** para enviarlo. El sistema no lo envía automáticamente ni cobra una tarifa de API.

Si no hay teléfono o el número no es válido, el pago queda guardado igualmente. Puedes completar/corregir el número en esta pantalla para ese comprobante. Si lo completas allí no se guarda en la ficha: para reutilizarlo en próximos pagos, agrégalo en **Editar datos** del socio.

El mensaje solo dice **Al día** cuando la información actualizada confirma que no hay cuotas pendientes. En un pago parcial muestra las cuotas que faltan. Si el pago se guardó pero falló la actualización, informa que el estado de cuotas está pendiente de verificar. Para volver a abrir un comprobante anterior, abre la ficha del socio y pulsa **WhatsApp** junto al mes en **Pagos registrados**. Ese botón verifica el registro y prepara la confirmación de ese mes; no registra otro pago. No vuelvas a cobrar ni registrar el pago para reenviar su comprobante.

No hace falta contratar WhatsApp Business API ni otra integración. Es un enlace `wa.me` al chat del socio, disponible en celular y computadora con WhatsApp. Se necesita conexión a Internet y una cuenta de WhatsApp; la disponibilidad del destinatario y la entrega del mensaje las gestiona WhatsApp. El sistema no marca el mensaje como enviado o entregado solo por abrir el enlace.

## Pases diarios: visitantes que no son mensualeros

Para activar esta actualización, ejecuta **`base-de-datos/7_pases_diarios.sql`** en **Supabase → SQL Editor → Run** y vuelve a subir la carpeta **`sitio` completa** a tu proyecto de Netlify. El archivo crea una tabla independiente y conserva todos los socios y pagos mensuales existentes. No repitas las migraciones 4, 5 o 6 si ya las aplicaste.

En recepción pulsa **Pases diarios**. Cualquier cuenta autorizada de recepción puede registrar:

- Nombre del visitante; CI opcional.
- Fecha de visita y pago (hoy por defecto), con calendario **Elegir fecha**. No acepta fechas futuras.
- Precio del pase en guaraníes, método de pago y nota opcional. Ingresa tu tarifa por día; el sistema recuerda el último monto mientras está abierto.

Cada registro corresponde a una visita pagada. La misma persona puede volver otro día y registrar un pase nuevo. No se crea un socio mensual ni se generan cuotas o deudas mensuales para el visitante. Los pases diarios no dan acceso al carnet de socios con PIN.

La sección muestra **pases de hoy** y **cobrado hoy**, con historial filtrable por fecha, nombre o CI. **Ver todos los días** muestra el historial completo; **Actualizar pases** vuelve a consultar la base. Si el registro no se puede confirmar por un fallo de red, revisa el historial antes de reintentarlo para evitar duplicados.

El Excel incluye una quinta hoja **Pases diarios**, con todo el historial independientemente de los filtros. **Resumen general** muestra la cantidad de pases, ingresos diarios acumulados y recaudación total (mensualidades más pases). El total de socios y las cuotas pendientes siguen correspondiendo solo a los mensualeros. Para evitar un informe incompleto, la exportación requiere que la tabla de pases diarios esté creada y accesible.

## Calendario y gestión de recepcionistas (nueva actualización)

**Fecha preferida:** en Nuevo socio o Editar socio pulsa **📅 Elegir fecha**. Aparece un calendario con selector de mes y año. Pulsa un día para seleccionarlo; **Seleccionar hoy** vuelve a la fecha actual. También puedes seguir escribiendo en el campo. No permite elegir una fecha anterior a la inscripción.

**Recepcionistas:** se administran desde la aplicación con una cuenta administradora. Requiere esta configuración inicial, una sola vez:

1. Ya debes tener aplicadas las migraciones 4 y 5. Abre `base-de-datos/6_gestion_recepcionistas.sql`. En la línea `correo_admin text := 'CAMBIAR_POR_TU_CORREO';` reemplaza el texto entre comillas por el correo con el que tú ya entras a Recepción. Ejecuta todo el archivo en **Supabase → SQL Editor**. No asignes este permiso a todas las cuentas: elige la cuenta que va a administrar al personal.
2. Para crear cuentas nuevas desde la aplicación, en **Supabase → Authentication → Sign In / Providers** activa **Allow new users to sign up** y verifica que el proveedor **Email** esté habilitado. Este permiso permite crear cuentas de autenticación; el acceso a los datos del gimnasio sigue limitado a las cuentas autorizadas en recepción. Solo el administrador puede dar ese acceso mediante la aplicación.
3. Si usas confirmación por correo, en **Authentication → URL Configuration → Site URL** configura la dirección real de tu sitio de Netlify. El nuevo usuario debe confirmar el correo antes de iniciar sesión. Las confirmaciones y los límites de envío dependen de la configuración de correo de tu proyecto.
4. Vuelve a subir la carpeta `sitio` completa al mismo proyecto de Netlify. Cierra sesión y vuelve a entrar con tu correo de administrador. Aparecerá **Recepcionistas** en la barra de recepción.

Desde **Recepcionistas**, escribe el correo y una contraseña inicial (mínimo 8 caracteres) y pulsa **Crear recepcionista**. La contraseña se envía al sistema de autenticación de Supabase; no se guarda en tablas del gimnasio ni en el navegador. Comunícala al nuevo recepcionista por tu medio habitual. Crear la cuenta no cambia la sesión del administrador.

Si la cuenta ya existe o se creó sin completar la autorización, escribe solo su correo y pulsa **Dar acceso a cuenta existente**. No cambia su contraseña. La lista muestra si está pendiente la confirmación de correo.

**Quitar acceso** retira los permisos del gimnasio, conservando la cuenta de autenticación y los registros de pagos. Las cuentas administradoras están protegidas y no se pueden retirar desde esa pantalla. Las cuentas normales de recepción no pueden gestionar personal. Después de esta configuración inicial, las altas y bajas se hacen desde tu sistema; no necesitas volver al SQL Editor por cada persona.

Estas funciones fueron comprobadas con PostgreSQL embebido y autenticación simulada en Chromium. La migración y los ajustes de autenticación deben aplicarse en tu proyecto real antes de usar la gestión de personal.

## Nueva descarga Excel

La descarga Excel por sí sola no requiere SQL adicional. Para usar además la gestión de recepcionistas, aplica la migración 6 como se indica arriba. Si solo actualizas Excel: descarga el ZIP actualizado y vuelve a subir la carpeta `sitio` completa a tu proyecto existente en Netlify.

En recepción encontrarás **Descargar Excel**, junto a Nuevo socio y Registrar pago. Genera un archivo `.xlsx` con cinco hojas. Al abrirlo verás primero **Resumen general**, con **TOTAL DE SOCIOS** destacado:

- **Resumen general:** total de socios (incluye los que no tienen pagos), activos, al día, con retraso, de baja, cuotas registradas, total abonado y saldo pendiente.
- **Pagos registrados:** todos los abonos, incluidos los socios de baja, con nombre, CI, período de cuota, monto, fecha, método y nota.
- **Resumen de socios:** inscripción, primer vencimiento, cuota mensual, estado, saldo pendiente y total abonado.
- **Cuotas pendientes:** cuotas vencidas sin pago de los socios activos, con sus fechas de vencimiento y montos.
- **Pases diarios:** visitas y pagos por día, sin generar obligaciones mensuales.

Los períodos aparecen con el nombre del mes y año: **OCTUBRE(2026)**, tanto en pagos como en cuotas pendientes. Las fechas de pago siguen siendo fechas reales de Excel y los importes se conservan como números.

La descarga incluye **todos los registros**, sin aplicar los filtros de búsqueda o estado de la pantalla. Antes de generar el archivo, actualiza los datos; si no puede conectar, informa el error y evita exportar información desactualizada. El archivo se genera en el navegador y no se envía a servicios externos. No incluye PIN ni claves.

## Actualizar tu sistema existente

1. Haz un respaldo de tu base de datos desde Supabase antes de actualizarla.
2. Si ya aplicaste la migración 4, **no la repitas**. Si nunca la aplicaste, ejecuta primero `4_actualizar_inscripcion.sql`. Luego, en tu proyecto de Supabase abre **SQL Editor**, pega el contenido completo de `base-de-datos/5_fecha_pago_preferida.sql` y pulsa **Run**. Se ejecuta en una transacción, se puede repetir y no elimina socios ni pagos. No ejecutes el archivo de socios de ejemplo sobre la base real.
3. Publica la carpeta **sitio completa**, incluyendo `assets`, `vendor` y `cuotas.js`, en el mismo alojamiento que usabas. Conserva tu dominio y recarga con Ctrl+F5.
4. Entra a recepción con tu cuenta habitual. Revisa la fecha de inscripción de los socios anteriores y prueba el acceso de un cliente.

La migración **5** es necesaria **antes** de publicar esta actualización. Si ya usabas la versión mejorada anterior, solo necesitas ejecutar `5_fecha_pago_preferida.sql` y volver a subir `sitio/` a Netlify. La aplicación anterior no conoce la fecha de inscripción y sus altas/ediciones dejan de ser compatibles con las nuevas funciones; actualiza ambos componentes en la misma ventana de mantenimiento.

Si partes de una base nueva, usa `1_crear_base_de_datos.sql` y luego `2_dar_permiso_a_recepcion.sql` siguiendo `GUIA.md`. El archivo 1 ya incluye los cambios de cuotas mensuales; en ese caso no hace falta ejecutar el 4 ni el 5. Ejecuta también el 7 para los pases diarios y configura el 6 si quieres gestionar recepcionistas desde la aplicación.

## Qué cambió

- Acceso de **Cliente** seleccionado primero, también después de cerrar sesión. Pestañas accesibles por teclado.
- Interfaz clara, adaptable a celular y computadora, con fondo adaptado a partir de la imagen de gimnasio adjunta, superficies blancas y estados identificados por texto y color.
- Recepción: filtros **Activos**, **Al día**, **Con retraso**, **De baja**; búsquedas separadas por **nombre** y **CI**. Se pueden combinar. El nombre admite búsquedas sin acentos; la CI admite puntos y espacios.
- Alta y edición con **fecha exacta de inscripción** y **fecha de pago acordada**, independientes. Al crear un socio ambas traen hoy por defecto. Puedes elegir una fecha de pago igual o posterior a la inscripción; esa es la primera cuota y las siguientes vencen el mismo día de cada mes. El primer período de cuota corresponde al mes de esa fecha elegida; no genera deuda antes de ese primer vencimiento. Si ese día no existe en un mes, vence el último día: 31/01 → 28/02 → 31/03. En año bisiesto, 29/02.
- Se mantienen los períodos `AAAA-MM` y los pagos anteriores: no se regeneran ni borran.
- La migración 4 asigna a los socios originales el primer día del mes que ya tenían registrado. La migración 5 conserva la fecha de inscripción existente como su primer vencimiento, por lo que no cambia su estado de cuotas. No existe información suficiente para adivinar su fecha exacta; recepción puede corregirla. No se permite mover la inscripción después de un pago existente.
- **Fecha de pago** elegible con calendario. Registra cuándo se recibió el dinero, entre la inscripción y hoy; no cambia el vencimiento mensual. Se pueden registrar varias cuotas y adelantos. El formulario muestra los períodos cubiertos y sus vencimientos.
- El cliente ve su fecha de inscripción, el día de pago mensual acordado, estado, carnet e historial de pagos.
- Fuentes y biblioteca Supabase incluidas localmente para reducir dependencias de servicios externos. La base de datos sigue necesitando conexión a Internet.

## Pruebas y límites

Comprobado: 23 pruebas de reglas de cuotas, búsqueda y exportación XLSX; instalación SQL limpia y repetida; migración desde el esquema original con datos conservados; crear socio, consultar PIN, registrar pagos y controles de permisos en PostgreSQL embebido (PGlite con pgcrypto). Flujo de pantallas probado en Chromium con Supabase simulado, en escritorio y móvil, sin errores JavaScript ni desbordamiento horizontal. Se descargó y volvió a leer el Excel generado en Chromium para comprobar filas, fechas y tipos de datos; también se verificó que los filtros no recortan la exportación y que un fallo de actualización impide descargar datos antiguos.

Las capturas de `capturas/` usan datos ficticios de prueba. No muestran datos de tu base.

La conexión real desde el entorno de trabajo está pendiente: el proxy bloquea el dominio del proyecto con HTTP 403. Se guardó su permiso en el borrador de configuración del entorno. Un borrador no aplica el permiso ni publica la aplicación. No se aplicaron estas migraciones al proyecto real: una clave pública de navegador no autoriza administrar el esquema SQL. Usa el SQL Editor de Supabase para el paso 2.

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
npm test
npm run test:db
npm run test:ui
```

La prueba de navegador inicia su propio servidor temporal y guarda capturas. Las pruebas no contactan tu Supabase ni modifican datos reales. `tests/fixtures/esquema-original.sql` es exclusivamente la base anterior para comprobar la migración, no un archivo para ejecutar sobre producción.

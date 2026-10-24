> **Versión actualizada:** si ya tienes la base conectada, empieza por `LEEME-PRIMERO.md` y la migración más reciente `5_fecha_pago_preferida.sql` (después de la 4, si aún no la aplicaste).

# Guía: poner en marcha las Cuotas del Gimnasio

Al terminar tendrás una dirección web (por ejemplo `https://gimnasio-fuerza-total.netlify.app`) que funciona en cualquier celular o computador, sin cuenta de Claude. Recepción entra con correo y contraseña. Cada socio entra con su cédula y un PIN.

**Tiempo:** 30 a 40 minutos la primera vez.
**Costo:** los dos servicios tienen plan gratuito (ver "Límites del plan gratuito" al final).
**Qué necesitas:** un computador con internet, un correo electrónico y el Bloc de notas.
**Nota:** los nombres de los menús de Supabase y Netlify pueden cambiar un poco con el tiempo. Si no encuentras uno, busca el más parecido.

## Qué contiene esta carpeta

| Carpeta o archivo | Para qué sirve |
|---|---|
| `sitio/` | La página web. Esta carpeta es la que se publica. |
| `base-de-datos/` | Tres scripts para crear la base de datos en Supabase. No se publican. |
| `GUIA.md` | Esta guía. |

Los datos viven en **Supabase** (la base de datos, en la nube) y la página se publica en **Netlify** (el hosting). Tu computador no guarda nada.

---

## Paso 1. Crear el proyecto en Supabase

1. Entra a **supabase.com**, presiona **Start your project** y crea tu cuenta (con tu correo o con GitHub).
2. Presiona **New project** y completa:
   - **Name:** por ejemplo `gimnasio`.
   - **Database password:** crea una contraseña larga y guárdala en un lugar seguro. No la vas a usar en la página, pero te hará falta si algún día administras la base directamente.
   - **Region:** elige la más cercana a Paraguay (South America, São Paulo).
3. Presiona **Create new project** y espera uno o dos minutos hasta que termine de prepararse.

## Paso 2. Crear las tablas

1. En el menú de la izquierda abre **SQL Editor** y presiona **New query**.
2. Abre con el Bloc de notas el archivo `base-de-datos/1_crear_base_de_datos.sql`. Selecciona todo (Ctrl+A), copia (Ctrl+C), pega en Supabase (Ctrl+V) y presiona **Run**.
3. Debe aparecer **Success**. Si Supabase avisa de "operaciones destructivas", confirma: el script solo reemplaza reglas que él mismo crea.

*Opcional, para probar con datos de ejemplo:* repite lo mismo con `3_socios_de_ejemplo_opcional.sql`. Crea 6 socios con PIN `1234`. El mismo archivo indica cómo borrarlos después.

## Paso 3. Crear la cuenta de recepción

1. En Supabase abre **Authentication > Users** y presiona **Add user > Create new user**.
2. Escribe el correo y una contraseña. Marca **Auto Confirm User** y crea el usuario.
3. Vuelve a **SQL Editor > New query**. Abre `base-de-datos/2_dar_permiso_a_recepcion.sql`, cambia `CAMBIAR@CORREO.COM` por ese mismo correo, pega todo y presiona **Run**.
4. El resultado debe mostrar el correo. Si sale vacío, el correo no coincide con el del usuario.

Si vas a crear todas las cuentas manualmente desde Supabase puedes desactivar **Allow new users to sign up** en **Authentication → Sign In / Providers**. Para usar **Crear recepcionista** dentro de esta versión, esa opción debe permanecer activada. Si no encuentras la opción, no pasa nada: aunque alguien se registrara, solo las cuentas del paso 3 tienen permiso de recepción.

Para gestionar las siguientes cuentas desde la aplicación, configura una vez `6_gestion_recepcionistas.sql` siguiendo `LEEME-PRIMERO.md`. Después usa el botón **Recepcionistas** con tu cuenta administradora. El método manual anterior sigue disponible.

## Paso 4. Copiar los dos datos de conexión

En Supabase abre **Project Settings > API Keys** (también aparecen en el botón **Connect**, arriba). Copia:

- **Project URL**: una dirección que termina en `.supabase.co`.
- **Publishable key**: empieza con `sb_publishable_`. Si tu proyecto todavía muestra claves antiguas, usa la llamada `anon` (public).

> **Nunca uses la clave `secret` ni `service_role`.** Esas dan control total de la base de datos. La publishable es pública por diseño: la seguridad la dan las reglas del paso 2.

## Paso 5. Pegar los datos en la página

1. Abre `sitio/config.js` con el Bloc de notas.
2. Reemplaza los tres textos entre comillas:
   - `NOMBRE`: el nombre de tu gimnasio.
   - `SUPABASE_URL`: la dirección del paso 4.
   - `SUPABASE_KEY`: la clave publishable del paso 4.
3. Guarda con **Archivo > Guardar como** y, abajo, en **Codificación**, elige **UTF-8**. Así los acentos se ven bien.
4. *Opcional:* en `sitio/manifest.webmanifest` cambia `name` y `short_name`. Es el nombre que aparece bajo el ícono cuando alguien agrega la página a su pantalla de inicio.

## Paso 6. Publicar la página en Netlify

1. Crea una cuenta gratuita en **netlify.com** e inicia sesión.
2. Entra a **app.netlify.com/drop**.
3. Arrastra la carpeta **`sitio`** completa (no el ZIP ni la carpeta de arriba) al recuadro.
4. Netlify te da una dirección terminada en `.netlify.app`.

> Los sitios que se suben sin iniciar sesión se borran en aproximadamente una hora. Inicia sesión antes de arrastrar la carpeta, o crea la cuenta cuando Netlify te lo pida, para que el sitio quede guardado.

Para cambiar el nombre de la dirección, entra a tu sitio en Netlify y busca **Site configuration > Change site name**. Si más adelante editas `config.js` u otro archivo, entra a la pestaña **Deploys** de tu sitio y arrastra la carpeta `sitio` de nuevo.

Otros servicios gratuitos para sitios estáticos (Cloudflare Pages, Vercel) también sirven. Lo único que se publica es la carpeta `sitio`.

## Paso 7. Probar

1. Abre tu dirección. Debes ver la pantalla con las pestañas **Recepción** y **Socio**.
2. En **Recepción** entra con el correo y la contraseña del paso 3.
3. Presiona **Nuevo socio**, completa los datos y presiona **Generar** para crear un PIN. Anótalo: se muestra una sola vez.
4. Presiona **Registrar pago** y registra una cuota.
5. Abre la misma dirección en tu celular, entra por la pestaña **Socio** con la cédula y el PIN, y comprueba que aparece el pago.
6. Si cargaste los ejemplos, bórralos (instrucción al final de `3_socios_de_ejemplo_opcional.sql`).

## Paso 8. Que los socios la usen desde el celular

- **Compártela por WhatsApp**: manda la dirección del paso 6.
- **Código QR**: genera uno gratuito en cualquier sitio de códigos QR pegando tu dirección, imprímelo y pégalo en recepción.
- **Pantalla de inicio**: cada socio puede dejarla como si fuera una app.
  - Android (Chrome): menú de tres puntos > **Agregar a la pantalla principal** (o **Instalar aplicación**).
  - iPhone (Safari): botón **Compartir** > **Agregar a inicio**.

---

## Uso diario

- **Registrar un pago:** en la lista, **Registrar pago** en la fila del socio. Se asigna a los meses más viejos sin pagar. Con **+** se registran varias cuotas juntas, incluso adelantadas.
- **Pases diarios:** usa esta sección para visitantes que abonan por día. Ejecuta una vez `7_pases_diarios.sql` para activarla; registra cada visita sin crear cuotas mensuales.
- **Descargar registros:** en recepción, **Descargar Excel** genera un archivo con todos los pagos registrados, el resumen de socios y las cuotas pendientes. Ignora los filtros de pantalla.
- **Ver quién debe:** el filtro **Con retraso** y el orden **Más retraso primero**. Cada socio muestra "Al día" o "N cuotas de retraso".
- **Corregir un error:** abre el socio (clic en su nombre) y presiona **Quitar** junto al pago. Pide una segunda confirmación.
- **Dar de baja:** abre el socio y presiona **Dar de baja**. Conserva su historial, deja de contar como activo y ya no puede entrar.
- **Cambiar el PIN o la cuota:** abre el socio y presiona **Editar datos**. Un PIN nuevo también desbloquea a un socio que se equivocó muchas veces.
- **Cuotas:** la primera vence en la fecha de pago acordada al registrar al socio (hoy por defecto) y las siguientes ese mismo día de cada mes (o el último día si no existe). Una cuota cuenta como pagada cuando hay un pago registrado para ese mes.

## Si algo falla

| Qué ves | Qué hacer |
|---|---|
| "Falta conectar la base de datos" | `config.js` todavía tiene los textos `PEGA_AQUI`. Complétalo (paso 5) y publica de nuevo la carpeta. |
| "Esta cuenta no tiene permiso de recepción" | Falta el paso 3.3, o el correo del script no coincide exactamente con el del usuario. |
| "Correo o contraseña incorrectos" en recepción | Revisa la contraseña. Si el usuario se creó sin **Auto Confirm User**, bórralo en Authentication > Users y créalo otra vez (repite el paso 3). |
| La lista de socios no carga | Revisa tu conexión. Si el proyecto estuvo mucho tiempo sin uso, puede estar pausado: entra a Supabase y presiona **Restore project**. |
| Cambié `config.js` y no se nota | Publica de nuevo la carpeta `sitio` (paso 6) y recarga la página con Ctrl+F5. |
| Un socio dice que su PIN no funciona | Después de 5 intentos fallidos, su cédula se bloquea 15 minutos. En **Editar datos** puedes ponerle un PIN nuevo y se desbloquea en el acto. |
| Olvidé la contraseña de recepción | Borra el usuario en Authentication > Users, créalo de nuevo y repite el paso 3. |

## Seguridad

- Los PIN se guardan **cifrados** en la base de datos; ni recepción puede verlos. Por eso se muestran una sola vez al crearlos.
- Un socio solo puede ver **sus propios** pagos. Nadie sin sesión de recepción puede leer la lista de socios.
- 5 PIN incorrectos seguidos bloquean esa cédula durante 15 minutos, para que nadie pueda adivinar un PIN.
- Cada recepcionista debe tener **su propia cuenta**. No compartan una contraseña. Para quitarle el acceso a alguien, bórralo en Authentication > Users.
- Un PIN de 4 a 6 dígitos es una protección sencilla, adecuada para consultar cuotas. Esta página **no cobra en línea**: registra pagos que se hicieron en efectivo, transferencia, tarjeta o billetera. No guardes en ella números de tarjeta ni datos bancarios.
- Los datos son personales (nombre, cédula, teléfono). Cuida quién tiene acceso a Supabase y a la cuenta de recepción.

## Límites del plan gratuito

Datos consultados el 22 de octubre de 2026 en fuentes públicas. Las condiciones de los planes pueden cambiar, revísalas en supabase.com/pricing y netlify.com/pricing.

- **Supabase gratuito:** 500 MB de base de datos (alcanza de sobra para miles de socios) y 5 GB de transferencia al mes. Los proyectos se **pausan tras 7 días sin actividad**; si recepción usa la página a diario no pasa, y si se pausa se restaura desde el panel. **No incluye respaldos diarios.**
- **Respaldo:** una vez al mes, en Supabase abre **Table Editor**, elige la tabla `socios` y luego `pagos`, y usa la opción **Export** para bajar un archivo CSV. Guárdalos en un lugar seguro: el de `socios` contiene los PIN cifrados.
- **Claves:** Supabase está reemplazando las claves antiguas (`anon`) por las nuevas (`publishable`). Esta página funciona con las dos; si el panel te ofrece crear las nuevas, úsalas.

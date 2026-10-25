/* Cuotas del Gimnasio · lógica de la página
   Los datos viven en Supabase. Este archivo no guarda nada sensible. */
(() => {
'use strict';

const CFG = window.CONFIG || {};
const NOMBRE = (CFG.NOMBRE || 'Cuotas del Gimnasio').trim();
document.title = NOMBRE;

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MES3 = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const METODOS = ['Efectivo','Transferencia','Tarjeta','Billetera digital'];
const pad = n => String(n).padStart(2, '0');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const miles = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtGs = n => 'Gs. ' + miles(n);
const fmtCI = ci => miles(ci);
const periodoDe = (y, m) => `${y}-${pad(m + 1)}`;
const periodoHoy = () => { const d = new Date(); return periodoDe(d.getFullYear(), d.getMonth()); };
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const sumaMeses = (p, n) => { const [y, m] = p.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}`; };
const etiqueta = p => { const [y, m] = p.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
const etiquetaCorta = p => `${MES3[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}`;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fmtFecha = iso => { if (!ISO.test(iso || '')) return '—'; const [y, m, d] = iso.split('-').map(Number); return `${d} ${MES3[m - 1].toLowerCase()} ${y}`; };
const fmtCorta = iso => ISO.test(iso || '') ? `${iso.slice(8)}/${iso.slice(5, 7)}` : '';
const byNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
const activo = c => c.activo !== false;

const CHECK = '<svg class="ck" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg>';
const LOGO = '<img class="gym-logo" src="assets/logo-ra-training-gym.png" alt="RA Training Gym" width="96" height="96">';
const EQUIS = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" fill="none"/></svg>';

/* ---------- Estado ---------- */
const S = {
  admin: false, calendario: null,
  diarios: [], diariosFecha: '', diariosNombre: '', diariosCi: '', diariosError: '', tarifaDiaria: '',
  session: null,        // {rol:'recepcion'} | {rol:'cliente'}
  rolTab: 'cliente',
  clientes: [],         // recepción: todos los socios con sus pagos
  cargado: false, errorDatos: false, ultimaCarga: 0,
  socio: null,          // socio: su ficha {nombre, ci, inicio, cuota, pagos:{}}
  creds: null,          // socio: cédula y PIN, solo en memoria para "Actualizar"
  filtro: 'todos', orden: 'retraso', q: '', ci: '',
  modal: null,
  anio: new Date().getFullYear()
};
const app = $('#app');
const dlg = $('#dlg');

/* ---------- Conexión con Supabase ---------- */
const configurado = !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY &&
  /^https:\/\//.test(CFG.SUPABASE_URL) && !/PEGA_AQUI/.test(CFG.SUPABASE_URL + CFG.SUPABASE_KEY));
let sb = null;
if (configurado && window.supabase && typeof window.supabase.createClient === 'function') {
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
}

function msgError(e, porDefecto) {
  const m = String((e && e.message) || '');
  if (m.includes('fecha_pago_socio_invalida')) return 'La fecha de pago debe ser válida e igual o posterior a la inscripción.';
  if (m.includes('inscripcion_posterior_a_pagos')) return 'La inscripción o el primer vencimiento no pueden dejar fuera pagos que ya tiene el socio.';
  if (m.includes('inscripcion_invalida')) return 'Revisa la fecha de inscripción.';
  if (m.includes('fecha_pago_invalida')) return 'La fecha de pago debe estar entre la inscripción y hoy.';
  if (m.includes('ci_duplicada')) return 'Ya existe un socio con esa cédula.';
  if (m.includes('pin_invalido')) return 'El PIN debe tener entre 4 y 6 dígitos.';
  if (m.includes('sin_permiso')) return 'Tu cuenta no tiene permiso para hacer esto.';
  if (m.includes('socio_no_encontrado')) return 'No se encontró el socio. Actualiza la lista.';
  if (e && e.code === '23505') return 'Esa cuota ya estaba registrada. La lista se actualizó, revisa y vuelve a intentar.';
  return porDefecto;
}

async function esAdministrador() {
  try { const {data,error} = await sb.rpc('es_administrador'); return !error && data === true; } catch { return false; }
}

async function esRecepcion() {
  const { data, error } = await sb.rpc('es_recepcion');
  return !error && data === true;
}

// Trae todas las filas de una tabla de a 1000 (límite de Supabase por consulta).
async function traerTodo(tabla, cols, orden) {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    let q = sb.from(tabla).select(cols);
    orden.forEach(c => { q = q.order(c); });
    const { data, error } = await q.range(desde, desde + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

let enCurso = null;
async function hacerCarga(silencioso) {
  try {
    const [socios, pagos] = await Promise.all([
      traerTodo('socios', 'id,nombre,ci,telefono,cuota,inicio,inscripcion,fecha_pago,activo,creado', ['nombre', 'id']),
      traerTodo('pagos', 'socio_id,periodo,monto,fecha,metodo,nota', ['socio_id', 'periodo'])
    ]);
    const mapa = new Map(socios.map(s => [s.id, { ...s, pagos: {} }]));
    for (const p of pagos) {
      const c = mapa.get(p.socio_id);
      if (c) c.pagos[p.periodo] = { monto: p.monto, fecha: p.fecha, metodo: p.metodo, ...(p.nota ? { nota: p.nota } : {}) };
    }
    S.clientes = [...mapa.values()];
    S.errorDatos = false; S.cargado = true; S.ultimaCarga = Date.now();
  } catch (e) {
    S.errorDatos = true;
    if (!silencioso) toast('No se pudieron cargar los datos. Revisa tu conexión.');
  }
  update();
}
// Espera a que termine una carga en curso y hace una nueva, para no mostrar datos viejos.
async function cargar(silencioso) {
  if (!sb) return;
  while (enCurso) await enCurso;
  enCurso = hacerCarga(silencioso);
  try { await enCurso; } finally { enCurso = null; }
}

/* ---------- Reglas de cuotas ---------- */
function pagosDe(c) {
  return Object.entries(c.pagos || {}).filter(([, v]) => v).map(([periodo, v]) => ({ periodo, ...v }));
}
// Una cuota por mes, desde el mes de inicio hasta el mes actual. Retraso = meses sin pago registrado.
function estado(c) {
  return Cuotas.estado(c, hoyISO());
}
function proximosPeriodos(c, n) {
  const pg = c.pagos || {};
  const out = [];
  let p = /^\d{4}-\d{2}$/.test(c.inicio || '') ? c.inicio : periodoHoy();
  for (let i = 0; out.length < n && i < 1200; i++, p = sumaMeses(p, 1)) if (!pg[p]) out.push(p);
  return out;
}
function ultimoPago(c) {
  const f = pagosDe(c).map(p => p.fecha).filter(Boolean).sort();
  return f.length ? f[f.length - 1] : '';
}

/* ---------- Piezas visuales ---------- */
function pillHTML(c, e) {
  if (!activo(c)) return '<span class="pill baja">De baja</span>';
  if (e.retraso === 0) return '<span class="pill ok">Al día</span>';
  const t = e.adeuda.map(etiquetaCorta).join(', ');
  return `<span class="pill late" title="Adeuda: ${esc(t)}">${e.retraso} ${e.retraso === 1 ? 'cuota' : 'cuotas'} de retraso</span>`;
}
function tira(c, n = 6) {
  const hoyP = periodoHoy(); const pg = c.pagos || {}; let h = '';
  for (let i = n - 1; i >= 0; i--) {
    const p = sumaMeses(hoyP, -i);
    const pagado = !!pg[p]; const antes = p < Cuotas.fechaPago(c).slice(0,7);
    const cls = pagado ? 'pagada' : (antes ? 'previa' : (Cuotas.vence(c,p) <= hoyISO() ? 'debe' : 'futura'));
    const txt = pagado ? 'pagada' : (antes ? 'antes de inscribirse' : (Cuotas.vence(c,p) <= hoyISO() ? 'adeudada' : 'por vencer'));
    h += `<span class="cell ${cls}" title="${etiqueta(p)}: ${txt}"></span>`;
  }
  return `<span class="tira" aria-hidden="true">${h}</span>`;
}
function carnetHTML(c, anio, modo) {
  const hoyP = periodoHoy(); const pg = c.pagos || {}; let cells = '';
  for (let m = 0; m < 12; m++) {
    const p = periodoDe(anio, m); const v = pg[p];
    let cls = '', inner = '', sr = '';
    if (v) { cls = 'pagada'; sr = 'pagada'; inner = `<span class="pie"><span class="dia">${fmtCorta(v.fecha)}</span>${CHECK}</span>`; }
    else if (p < Cuotas.fechaPago(c).slice(0,7)) { cls = 'previa'; sr = 'antes de inscribirse'; }
    else if (p >= Cuotas.fechaPago(c).slice(0,7) && Cuotas.vence(c,p) <= hoyISO()) { cls = 'debe'; sr = 'adeudada'; }
    cells += `<li class="mes ${cls}"><span class="mn">${MES3[m]}</span>${sr ? `<span class="sr">${sr}</span>` : ''}${inner}</li>`;
  }
  const leyenda = true
    ? '<div class="leyenda"><span><i class="sw pagada"></i>Pagada</span><span><i class="sw debe"></i>Adeudada</span><span><i class="sw previa"></i>Antes de inscribirse</span></div>' : '';
  return `<div class="carnet"><div class="carnet-top"><span>${modo === 'cliente' ? 'Cuotas pagadas' : 'Cuotas del año'}</span><span class="mono">${anio}</span></div><ol class="meses">${cells}</ol>${leyenda}</div>`;
}
function anioNav() {
  return `<div class="anio-nav"><button type="button" class="btn ghost sm" data-act="anio" data-d="-1" aria-label="Año anterior">‹</button><strong class="anio">${S.anio}</strong><button type="button" class="btn ghost sm" data-act="anio" data-d="1" aria-label="Año siguiente">›</button></div>`;
}
function topHTML(rol) {
  return `<header class="top"><div class="brand">${LOGO}<span>${esc(NOMBRE)}</span></div><div class="top-r"><span class="rol">${rol}</span><button type="button" class="btn ghost sm" data-act="salir">Salir</button></div></header>`;
}

/* ---------- Pantalla de acceso ---------- */
function configHTML() {
  return `<main class="wrap"><div class="aviso cfg"><strong>Falta conectar la base de datos.</strong>
    <span>Abre el archivo config.js, pega la dirección y la clave pública de tu proyecto de Supabase y vuelve a publicar la carpeta. Los pasos están en la guía, paso 5.</span></div></main>`;
}
function loginHTML() {
  const tab = S.rolTab;
  const mesActual = new Date().getMonth();
  let demo = '';
  for (let m = 0; m < 12; m++) {
    demo += m <= mesActual
      ? `<li class="mes pagada"><span class="mn">${MES3[m]}</span><span class="pie">${CHECK}</span></li>`
      : `<li class="mes"><span class="mn">${MES3[m]}</span></li>`;
  }
  return `
  <main class="login">
    <section class="hero"><div class="login-brand">${LOGO}<span>${esc(NOMBRE)}</span></div>
      <p class="eyebrow">GIMNASIO · PORTAL DE SOCIOS</p>
      <h1>Tu esfuerzo.<br>Tu progreso.<br><em>Todo al día.</em></h1>
      <p class="lead">Un espacio para seguir entrenando. Consulta tus cuotas, revisa tus pagos y mantén tu membresía al día.</p>
      <div class="hero-note"><span>01 / TU MEMBRESÍA, MÁS SIMPLE</span><p>Menos trámites.<br>Más tiempo para entrenar.</p></div><div class="carnet login-carnet" aria-hidden="true">
        <div class="carnet-top"><span>Carnet de socio</span><span class="mono">${new Date().getFullYear()}</span></div>
        <ol class="meses">${demo}</ol>
      </div>
    </section>
    <section class="panel">
      <div class="tabs" role="tablist" aria-label="Tipo de acceso">
        <button type="button" id="tabCliente" aria-controls="panelAcceso" tabindex="${tab === 'cliente' ? 0 : -1}" role="tab" class="tab" aria-selected="${tab === 'cliente'}" data-act="rol" data-r="cliente">Cliente</button>
        <button type="button" id="tabRecepcion" aria-controls="panelAcceso" tabindex="${tab === 'recepcion' ? 0 : -1}" role="tab" class="tab" aria-selected="${tab === 'recepcion'}" data-act="rol" data-r="recepcion">Recepción</button>
      </div>
      <div id="panelAcceso" class="panel-body" role="tabpanel" aria-labelledby="${tab === 'cliente' ? 'tabCliente' : 'tabRecepcion'}">${tab === 'recepcion' ? panelRecepcion() : panelCliente()}</div>
    </section>
  </main>`;
}
function panelRecepcion() {
  return `<p class="eyebrow">GESTIÓN DEL GIMNASIO</p><h2>Acceso de recepción</h2><p class="panel-intro">Administra socios, cuotas y pagos desde un solo lugar.</p>
  <form id="formStaff" class="form" novalidate>
    <div class="field"><label for="stEmail">Correo</label><input id="stEmail" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false"></div>
    <div class="field"><label for="stPass">Contraseña</label><input id="stPass" type="password" autocomplete="current-password"></div>
    <p class="error" id="stError" role="alert" hidden></p>
    <button class="btn primary block" type="submit" id="stOk">Entrar a recepción</button>
  </form>`;
}
function panelCliente() {
  return `<p class="eyebrow">BIENVENIDO DE NUEVO</p><h2>Tu espacio de entrenamiento</h2><p class="panel-intro">Ingresa con tu cédula y el PIN que te entregó recepción.</p>
  <form id="formLogin" class="form" autocomplete="off" novalidate>
    <div class="field"><label for="lgCi">Número de cédula</label><input id="lgCi" inputmode="numeric" autocomplete="off" placeholder="Ej. 4123456"></div>
    <div class="field"><label for="lgPin">PIN</label><input id="lgPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="4 a 6 dígitos"></div>
    <p class="error" id="lgError" role="alert" hidden></p>
    <button class="btn primary block" type="submit" id="lgOk">Ver mis cuotas</button>
    <p class="hint">El PIN te lo entrega recepción al inscribirte.</p>
  </form>`;
}
function refrescarLogin() { if (!S.session) app.innerHTML = loginHTML(); }

async function entrarRecepcion() {
  if (!sb) { toast('Configura la conexión a Supabase para iniciar sesión.'); return; }
  const err = $('#stError'); const btn = $('#stOk');
  const fallo = m => { err.textContent = m; err.hidden = false; btn.disabled = false; };
  const email = $('#stEmail').value.trim(); const pass = $('#stPass').value;
  if (!email || !pass) return fallo('Escribe tu correo y tu contraseña.');
  btn.disabled = true; err.hidden = true;
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) return fallo('Correo o contraseña incorrectos.');
    if (!(await esRecepcion())) { await sb.auth.signOut(); return fallo('Esta cuenta no tiene permiso de recepción.'); }
  } catch { return fallo('No se pudo conectar. Revisa tu conexión e intenta de nuevo.'); }
  S.admin = await esAdministrador();
  S.session = { rol: 'recepcion' }; S.cargado = false; S.clientes = [];
  render(); cargar(true);
}

/* ---------- Recepción ---------- */
function recepcionHTML() {
  return `<div class="wrap">
    ${topHTML('Recepción')}
    <div id="avisoDatos"></div>
    <section id="stats" class="stats" aria-label="Resumen"></section>
    <section class="toolbar">
      <div class="search field"><label for="busca">Nombre del cliente</label><input id="busca" type="search" placeholder="Buscar por nombre…" value="${esc(S.q)}" autocomplete="off"></div>
      <div class="search field"><label for="buscaCi">Cédula de identidad</label><input id="buscaCi" type="search" inputmode="numeric" placeholder="Buscar por CI…" value="${esc(S.ci)}" autocomplete="off"></div>
      <div id="chips" class="chips" role="group" aria-label="Filtrar por estado"></div>
      <div class="toolbar-r">
        <label class="sr" for="orden">Ordenar</label>
        <select id="orden"><option value="retraso" ${S.orden === 'retraso' ? 'selected' : ''}>Más retraso primero</option><option value="nombre" ${S.orden === 'nombre' ? 'selected' : ''}>Nombre A–Z</option></select>
        <button type="button" class="btn ghost sm" data-act="actualizar">Actualizar</button>
        ${S.admin ? '<button type="button" class="btn" data-act="recepcionistas">Recepcionistas</button>' : ''}
        <button type="button" class="btn" data-act="pases-diarios">Pases diarios</button>
        <button type="button" class="btn" data-act="exportar-excel" title="Exporta todos los registros, sin aplicar los filtros de pantalla">Descargar Excel</button>
        <button type="button" class="btn" data-act="nuevo-cliente">Nuevo socio</button>
        <button type="button" class="btn primary" data-act="cobrar-global">Registrar pago</button>
      </div>
    </section>
    <p id="resultados" class="hint" aria-live="polite"></p><div id="cabecera" class="thead" aria-hidden="true"><span>Socio</span><span>Cuota</span><span>Estado</span><span>Últimos 6 meses</span><span>Último pago</span><span></span></div>
    <ul id="lista" class="lista"></ul>
  </div>`;
}
function renderStats() {
  const v = S.clientes.map(c => ({ c, e: estado(c) })).filter(x => activo(x.c));
  const aldia = v.filter(x => x.e.retraso === 0).length;
  const conRet = v.filter(x => x.e.retraso > 0);
  const cuotas = conRet.reduce((s, x) => s + x.e.retraso, 0);
  const deuda = conRet.reduce((s, x) => s + x.e.retraso * (x.c.cuota || 0), 0);
  const mes = periodoHoy();
  const cobrado = S.clientes.reduce((s, c) => s + pagosDe(c).filter(p => (p.fecha || '').slice(0, 7) === mes).reduce((a, p) => a + (Number(p.monto) || 0), 0), 0);
  $('#stats').innerHTML = `
    <div class="stat"><span class="lab">Socios activos</span><span class="num">${v.length}</span></div>
    <div class="stat ok"><span class="lab">Al día</span><span class="num">${aldia}</span></div>
    <div class="stat late"><span class="lab">Con retraso</span><span class="num">${conRet.length}</span><p class="sub">${cuotas} ${cuotas === 1 ? 'cuota' : 'cuotas'} · ${fmtGs(deuda)}</p></div>
    <div class="stat"><span class="lab">Cuotas cobradas en ${MESES[Number(mes.slice(5)) - 1].toLowerCase()}</span><span class="num">${miles(cobrado)}</span><p class="sub">guaraníes</p></div>`;
}
function filaHTML({ c, e }) {
  const ult = ultimoPago(c);
  return `<li class="row" data-id="${esc(c.id)}">
    <div class="r-nom"><span class="l1"><button type="button" class="nombre" data-act="detalle">${esc(c.nombre)}</button></span><span class="sub mono">CI ${fmtCI(c.ci)}</span></div>
    <div class="r-cuota mono">${fmtGs(c.cuota)}</div>
    <div class="r-est">${pillHTML(c, e)}</div>
    <div class="r-tira">${tira(c)}</div>
    <div class="r-ult">${ult ? fmtFecha(ult) : '—'}</div>
    <div class="r-act">${activo(c) ? '<button type="button" class="btn sm" data-act="cobrar">Registrar pago</button>' : ''}</div>
  </li>`;
}
function renderLista() {
  const todos = S.clientes.map(c => ({ c, e: estado(c) }));
  const act = todos.filter(x => activo(x.c));
  const cont = {
    todos: act.length,
    aldia: act.filter(x => x.e.retraso === 0).length,
    retraso: act.filter(x => x.e.retraso > 0).length,
    baja: todos.length - act.length
  };
  $('#chips').innerHTML = [['todos', 'Activos'], ['aldia', 'Al día'], ['retraso', 'Con retraso'], ['baja', 'De baja']]
    .map(([k, t]) => `<button type="button" class="chip-btn" aria-pressed="${S.filtro === k}" data-act="filtro" data-f="${k}">${t}<span class="n">${cont[k]}</span></button>`).join('');

  $('#cabecera').hidden = !todos.length;
  if (!S.cargado && !todos.length) {
    $('#lista').innerHTML = `<li class="vacio"><p class="muted">${S.errorDatos ? 'No se pudieron cargar los socios. <button type="button" class="linkbtn" data-act="actualizar">Reintentar</button>' : 'Cargando socios…'}</p></li>`;
    return;
  }
  if (!todos.length) {
    $('#lista').innerHTML = `<li class="vacio"><h2>Todavía no hay socios</h2>
      <p>Agrega el primero para empezar a registrar cuotas.</p>
      <div class="acciones"><button type="button" class="btn primary" data-act="nuevo-cliente">Agregar primer socio</button></div></li>`;
    return;
  }
  let v = todos.filter(x => ({
    todos: activo(x.c), aldia: activo(x.c) && x.e.retraso === 0,
    retraso: activo(x.c) && x.e.retraso > 0, baja: !activo(x.c)
  })[S.filtro]);
  v = v.filter(({c}) => Cuotas.coincide(c, S.q, S.ci));
  $('#resultados').textContent = `${v.length} ${v.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}`;
  v.sort(S.orden === 'nombre' ? (a, b) => byNombre(a.c, b.c) : (a, b) => b.e.retraso - a.e.retraso || byNombre(a.c, b.c));
  $('#lista').innerHTML = v.length ? v.map(filaHTML).join('') : '<li class="vacio"><p class="muted">Ningún socio coincide con la búsqueda o el filtro.</p></li>';
}
function renderAviso() {
  const el = $('#avisoDatos'); if (!el) return;
  el.innerHTML = S.errorDatos && S.cargado
    ? '<p class="aviso">No se pudieron actualizar los datos; se muestra la última lista cargada.<button type="button" class="linkbtn" data-act="actualizar">Reintentar</button></p>' : '';
}

/* ---------- Diálogos ---------- */
function abrir(html) { $('#dlgBody').innerHTML = html; if (!dlg.open) dlg.showModal(); }
function cerrar() { if (dlg.open) dlg.close(); }
dlg.addEventListener('close', () => { S.modal = null; });
dlg.addEventListener('click', e => { if (e.target === dlg) cerrar(); });
const btnCerrar = `<button type="button" class="btn ghost sm" data-act="cerrar" aria-label="Cerrar">${EQUIS}</button>`;

function detalleHTML(c) {
  const e = estado(c);
  const pagos = pagosDe(c).sort((a, b) => b.periodo.localeCompare(a.periodo));
  return `
  <div class="dlg-head"><div><p class="eyebrow">Socio</p><h2 id="dlgTitulo">${esc(c.nombre)}</h2>
    <p class="meta"><span class="mono">CI ${fmtCI(c.ci)}</span>${c.telefono ? ` · <span class="mono">${esc(c.telefono)}</span>` : ''}</p></div>${btnCerrar}</div>
  <div class="detalle-estado">${pillHTML(c, e)}<span class="muted">Cuota ${fmtGs(c.cuota)} · Inscripción ${fmtFecha(Cuotas.inscripcion(c))} · Primer vencimiento ${fmtFecha(Cuotas.fechaPago(c))}</span></div>
  ${e.retraso && activo(c) ? `<p class="debe-lista"><span class="muted">Adeuda:</span>${e.adeuda.map(p => `<span class="chip late">${etiquetaCorta(p)}</span>`).join('')}</p>` : ''}
  <div class="dlg-nav">${anioNav()}</div>
  ${carnetHTML(c, S.anio, 'recepcion')}
  <h3>Pagos registrados</h3>
  ${pagos.length ? `<ul class="hist">${pagos.map(p => `<li><span class="h-per">${etiqueta(p.periodo)}</span><span class="h-fec">${fmtFecha(p.fecha)}</span><span class="h-met">${esc(p.metodo || '')}</span><span class="h-monto mono">${fmtGs(p.monto)}</span><span class="h-acc"><button type="button" class="linkbtn" data-act="whatsapp-pago" data-p="${p.periodo}">WhatsApp</button><button type="button" class="linkbtn danger" data-act="quitar" data-p="${p.periodo}">Quitar</button></span></li>`).join('')}</ul>` : '<p class="muted">Todavía no hay pagos registrados.</p>'}
  <div class="dlg-foot">
    ${activo(c) ? '<button type="button" class="btn primary" data-act="cobrar">Registrar pago</button>' : ''}
    <button type="button" class="btn" data-act="editar">Editar datos</button>
    <button type="button" class="btn ghost" data-act="${activo(c) ? 'baja' : 'reactivar'}">${activo(c) ? 'Dar de baja' : 'Reactivar'}</button>
  </div>`;
}
function abrirDetalle(id) {
  const c = S.clientes.find(x => x.id === id); if (!c) return;
  S.modal = { tipo: 'detalle', id }; S.anio = new Date().getFullYear();
  abrir(detalleHTML(c));
}
function refrescarDetalle() {
  if (!S.modal || S.modal.tipo !== 'detalle') return;
  const c = S.clientes.find(x => x.id === S.modal.id);
  if (!c) { cerrar(); return; }
  $('#dlgBody').innerHTML = detalleHTML(c);
}

function cobrarHTML(c) {
  const lista = S.clientes.filter(activo).sort(byNombre);
  return `<form id="formPago" class="form" novalidate>
    <div class="dlg-head"><div><p class="eyebrow">Recepción</p><h2 id="dlgTitulo">Registrar pago</h2></div>${btnCerrar}</div>
    <div class="field"><label for="pgCliente">Socio</label>
      <select id="pgCliente">${lista.map(x => `<option value="${esc(x.id)}" ${x.id === c.id ? 'selected' : ''}>${esc(x.nombre)} · CI ${fmtCI(x.ci)}</option>`).join('')}</select></div>
    <div class="estado-mini" id="pgEstado"></div>
    <div class="fila2">
      <div class="field"><label for="pgN">Cuotas a registrar</label>
        <div class="stepper"><button type="button" class="btn" data-act="n-menos" aria-label="Una cuota menos">−</button><input id="pgN" type="number" min="1" max="12" value="1" inputmode="numeric"><button type="button" class="btn" data-act="n-mas" aria-label="Una cuota más">+</button></div></div>
      <div class="field"><label for="pgMonto">Monto por cuota (Gs.)</label><input id="pgMonto" type="number" min="0" step="1000" inputmode="numeric" value="${Number(c.cuota) || 0}"></div>
    </div>
    <div class="cubre"><span class="lab">Cubre</span><span id="pgCubre" style="display:contents"></span></div>
    <div class="fila2">
      <div class="field"><label for="pgMetodo">Método de pago</label><select id="pgMetodo">${METODOS.map(m => `<option>${m}</option>`).join('')}</select></div>
      <div class="field"><label for="pgFecha">Fecha de pago</label><input id="pgFecha" type="date" max="${hoyISO()}" min="${Cuotas.inscripcion(c)}" value="${hoyISO()}"></div>
    </div>
    <div class="field"><label for="pgNota">Nota (opcional)</label><input id="pgNota" type="text" maxlength="120" autocomplete="off"></div>
    <p class="error" id="pgError" role="alert" hidden></p>
    <div class="total-fila"><span>Total</span><strong id="pgTotal"></strong></div>
    <div class="dlg-foot"><button type="button" class="btn" data-act="cerrar">Cancelar</button><button class="btn primary" type="submit" id="pgOk">Registrar 1 cuota</button></div>
  </form>`;
}
function abrirCobrar(id) {
  const c = S.clientes.find(x => x.id === id && activo(x));
  if (!c) { toast('Primero agrega un socio activo.'); return; }
  S.modal = { tipo: 'cobrar', id };
  abrir(cobrarHTML(c));
  cobrarActualizar();
}
function cobrarActualizar() {
  const sel = $('#pgCliente'); if (!sel) return;
  const c = S.clientes.find(x => x.id === sel.value); if (!c) return;
  const n = clamp(parseInt($('#pgN').value, 10) || 1, 1, 12);
  const monto = parseInt($('#pgMonto').value, 10) || 0;
  const ps = proximosPeriodos(c, n); const hp = periodoHoy(); const e = estado(c);
  $('#pgEstado').innerHTML = e.retraso
    ? `${pillHTML(c, e)}${e.retraso > 1 ? '<button type="button" class="linkbtn" data-act="cubrir-todo">Cubrir todo lo adeudado</button>' : ''}`
    : '<span class="pill ok">Al día</span><span class="muted">El pago se registra como adelantado.</span>';
  $('#pgCubre').innerHTML = ps.map(p => `<span class="chip ${p > hp ? 'fut' : ''}">${etiquetaCorta(p)} · vence ${fmtCorta(Cuotas.vence(c,p))}${p > hp ? ' · adelantada' : ''}</span>`).join('');
  $('#pgFecha').min = Cuotas.inscripcion(c);
  $('#pgTotal').textContent = fmtGs(monto * n);
  $('#pgOk').textContent = n === 1 ? 'Registrar 1 cuota' : `Registrar ${n} cuotas`;
}
async function enviarPago() {
  if ($('#pgOk')?.disabled) return;
  const err = $('#pgError'); const fallo = m => { err.textContent = m; err.hidden = false; };
  const c = S.clientes.find(x => x.id === $('#pgCliente').value); if (!c) return fallo('Elige un socio.');
  const n = clamp(parseInt($('#pgN').value, 10) || 1, 1, 12);
  const monto = parseInt($('#pgMonto').value, 10);
  const fecha = $('#pgFecha').value; const metodo = $('#pgMetodo').value; const nota = $('#pgNota').value.trim();
  if (!(monto > 0)) return fallo('Ingresa un monto mayor a cero.');
  if (!Cuotas.valida(fecha) || fecha > hoyISO() || fecha < Cuotas.inscripcion(c)) return fallo('La fecha de pago debe estar entre la inscripción y hoy.');
  const filas = proximosPeriodos(c, n).map(periodo => ({ socio_id: c.id, periodo, monto, fecha, metodo, nota }));
  const btn = $('#pgOk'); btn.disabled = true; err.hidden = true;
  const { error } = await sb.from('pagos').insert(filas).then(r => r, () => ({ error: { message: 'red' } }));
  if (error) {
    const dup = error.code === '23505';
    if (dup) { await cargar(true); cobrarActualizar(); }
    fallo(msgError(error, 'No se pudo guardar el pago. Revisa tu conexión e intenta de nuevo.'));
    btn.disabled = false; return;
  }
  await cargar(true);
  if (S.session?.rol !== 'recepcion') return;
  abrirConfirmacionPago(c,filas);
  toast(`${n === 1 ? 'Cuota registrada' : n + ' cuotas registradas'} para ${c.nombre}.`);
}
function abrirConfirmacionPago(c,filas) {
  const actualizado=S.clientes.find(x=>x.id===c.id);
  const texto=ConfirmacionWhatsApp.mensaje({nombre:c.nombre,filas,socio:actualizado,hoy:hoyISO(),verificado:!S.errorDatos&&!!actualizado,gimnasio:NOMBRE},Cuotas);
  S.modal={tipo:'confirmacion',id:c.id};
  abrir(`<div class="dlg-head"><div><p class="eyebrow">Pago guardado</p><h2 id="dlgTitulo">Confirmación de pago</h2></div>${btnCerrar}</div>
    <p class="hint">El pago ya está registrado. Puedes enviar este comprobante por WhatsApp sin contratar una API.</p>
    <div class="form"><div class="field"><label for="waTelefono">WhatsApp del socio</label><input id="waTelefono" type="tel" inputmode="tel" maxlength="30" value="${esc(actualizado?.telefono||c.telefono||'')}" placeholder="0981 123456 o +595 981 123456" aria-describedby="waAyuda"><p id="waAyuda" class="hint">Los celulares de Paraguay se completan con +595. Para otro país, escribe su código internacional. Este número se usa para esta confirmación; para próximos pagos guárdalo en Editar datos del socio.</p></div>
    <div class="field"><label for="waMensaje">Mensaje de confirmación</label><textarea id="waMensaje" rows="11" readonly>${esc(texto)}</textarea></div><p class="error" id="waError" role="status" hidden></p></div>
    <div class="dlg-foot"><button type="button" class="btn" data-act="cerrar">Cerrar</button><a id="waEnviar" class="btn primary" target="_blank" rel="noopener noreferrer" hidden>Enviar confirmación por WhatsApp</a></div>
    <p class="hint">Se abrirá WhatsApp o WhatsApp Web con el mensaje preparado. Revisa el destinatario y pulsa Enviar allí. Abrir el enlace no envía el mensaje automáticamente.</p>`);
  actualizarWhatsApp();
}
async function reenviarConfirmacion(id,periodo) {
  if(S.session?.rol!=='recepcion')return;
  const modal=S.modal;
  await cargar(true);
  if(S.session?.rol!=='recepcion' || S.modal!==modal)return;
  const c=S.clientes.find(x=>x.id===id),p=c?.pagos?.[periodo];
  if(S.errorDatos || !p){toast('No se pudo verificar ese pago. Actualiza el historial e intenta nuevamente.');return;}
  abrirConfirmacionPago(c,[{...p,periodo}]);
}
function actualizarWhatsApp() {
  const input=$('#waTelefono');if(!input)return;
  const url=ConfirmacionWhatsApp.enlace(input.value,$('#waMensaje').value),boton=$('#waEnviar'),error=$('#waError');
  boton.hidden=!url;
  if(url)boton.href=url;else boton.removeAttribute('href');
  error.hidden=!!url;error.textContent=input.value.trim()?'Revisa el número y el código de país antes de abrir WhatsApp.':'El pago está guardado. Completa el número del socio para preparar el chat de WhatsApp.';
}

async function quitarPago(id, periodo) {
  const { error } = await sb.from('pagos').delete().eq('socio_id', id).eq('periodo', periodo).then(r => r, () => ({ error: { message: 'red' } }));
  if (error) { toast(msgError(error, 'No se pudo quitar el pago. Intenta de nuevo.')); return; }
  await cargar(true);
  toast(`Se quitó el pago de ${etiqueta(periodo)}.`);
}

function clienteFormHTML(c) {
  const nuevo = !c;
  return `<form id="formCliente" class="form" novalidate data-id="${nuevo ? '' : esc(c.id)}">
    <div class="dlg-head"><div><p class="eyebrow">Socios</p><h2 id="dlgTitulo">${nuevo ? 'Nuevo socio' : 'Editar socio'}</h2></div>${btnCerrar}</div>
    <div class="field"><label for="cNombre">Nombre completo</label><input id="cNombre" value="${esc(c?.nombre || '')}" autocomplete="off"></div>
    <div class="fila2">
      <div class="field"><label for="cCi">Cédula</label><input id="cCi" inputmode="numeric" value="${esc(c?.ci || '')}" autocomplete="off" placeholder="Solo números"></div>
      <div class="field"><label for="cTel">Teléfono / WhatsApp (opcional)</label><input id="cTel" maxlength="30" placeholder="0981 123456 o +595 981 123456" value="${esc(c?.telefono || '')}" autocomplete="off" inputmode="tel"></div>
    </div>
    <div class="fila2">
      <div class="field"><label for="cCuota">Cuota mensual (Gs.)</label><input id="cCuota" type="number" min="0" step="1000" inputmode="numeric" value="${c ? Number(c.cuota) || '' : 150000}"></div>
      <div class="field"><label for="cInicio">Fecha de inscripción</label><input id="cInicio" type="date" min="1900-01-01" max="${hoyISO()}" value="${esc(c ? Cuotas.inscripcion(c) : hoyISO())}"></div>
    </div>
    <div class="field"><label for="cFechaPago">Fecha de pago de la primera cuota</label><div class="fecha-selector"><input id="cFechaPago" type="date" min="${esc(c ? Cuotas.inscripcion(c) : hoyISO())}" value="${esc(c ? Cuotas.fechaPago(c) : hoyISO())}" aria-describedby="cFechaPagoAyuda"><button type="button" class="btn" id="abrirCalendarioPago" data-act="calendario-pago" aria-controls="calendarioPago" aria-expanded="false">📅 Elegir fecha</button></div><div id="calendarioPago" class="calendario" hidden></div><p id="cFechaPagoAyuda" class="hint">Elige la fecha que le resulte cómoda al socio. Las siguientes cuotas vencerán ese mismo día de cada mes.</p></div>
    <div class="field"><label for="cPin">PIN del socio${nuevo ? '' : ' (vacío para no cambiarlo)'}</label>
      <div class="stepper" style="grid-template-columns:minmax(0,1fr) auto"><input id="cPin" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="4 a 6 dígitos"><button type="button" class="btn" data-act="gen-pin">Generar</button></div></div>
    <p class="hint">La inscripción y el vencimiento son fechas independientes. Si el día elegido no existe en un mes, la cuota vence el último día de ese mes. El PIN se muestra una sola vez al guardar: anótalo para dárselo al socio.</p>
    <p class="error" id="cError" role="alert" hidden></p>
    <div class="dlg-foot"><button type="button" class="btn" data-act="volver">Cancelar</button><button class="btn primary" type="submit" id="cOk">${nuevo ? 'Crear socio' : 'Guardar cambios'}</button></div>
  </form>`;
}
function abrirClienteForm(id) {
  const c = id ? S.clientes.find(x => x.id === id) : null;
  if (id && !c) return;
  S.modal = { tipo: 'cliente', id: id || null };
  abrir(clienteFormHTML(c));
}
async function guardarCliente(f) {
  const id = f.dataset.id || ''; const err = $('#cError'); const fallo = m => { err.textContent = m; err.hidden = false; };
  const nombre = $('#cNombre').value.trim().replace(/\s+/g, ' ');
  const ci = $('#cCi').value.replace(/\D/g, '');
  const telefono = $('#cTel').value.trim();
  const cuota = parseInt($('#cCuota').value, 10);
  const inscripcion = $('#cInicio').value.trim();
  const fechaPago = $('#cFechaPago').value;
  const inicio = fechaPago.slice(0,7);
  const pin = $('#cPin').value.trim();
  if (nombre.length < 2) return fallo('Escribe el nombre del socio.');
  if (ci.length < 5 || ci.length > 10) return fallo('La cédula debe tener entre 5 y 10 dígitos.');
  if (S.clientes.some(x => x.ci === ci && x.id !== id)) return fallo('Ya existe un socio con esa cédula.');
  if (!(cuota > 0)) return fallo('Ingresa la cuota mensual en guaraníes.');
  if (!Cuotas.valida(inscripcion) || inscripcion > hoyISO()) return fallo('Elige una fecha de inscripción válida, hasta hoy.');
  if (!Cuotas.valida(fechaPago) || fechaPago < inscripcion) return fallo('La fecha de pago debe ser igual o posterior a la inscripción.');
  if ((!id || pin) && !/^\d{4,6}$/.test(pin)) return fallo('El PIN debe tener entre 4 y 6 dígitos.');
  const btn = $('#cOk'); btn.disabled = true; err.hidden = true;
  const r = id
    ? await sb.rpc('editar_socio', { p_id: id, p_nombre: nombre, p_ci: ci, p_telefono: telefono, p_cuota: cuota, p_inicio: inicio, p_pin: pin || null, p_inscripcion: inscripcion, p_fecha_pago: fechaPago }).then(x => x, () => ({ error: { message: 'red' } }))
    : await sb.rpc('crear_socio', { p_nombre: nombre, p_ci: ci, p_telefono: telefono, p_cuota: cuota, p_inicio: inicio, p_pin: pin, p_inscripcion: inscripcion, p_fecha_pago: fechaPago }).then(x => x, () => ({ error: { message: 'red' } }));
  if (r.error) { fallo(msgError(r.error, 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.')); btn.disabled = false; return; }
  await cargar(true);
  if (id) { toast(pin ? `Datos guardados. Nuevo PIN: ${pin}` : 'Datos guardados.', pin ? 9000 : 3500); abrirDetalle(id); }
  else { cerrar(); toast(`Socio creado. PIN: ${pin}`, 9000); }
}
async function cambiarEstado(id, activo) {
  const { error } = await sb.rpc('cambiar_estado_socio', { p_id: id, p_activo: activo }).then(r => r, () => ({ error: { message: 'red' } }));
  if (error) { toast(msgError(error, 'No se pudo guardar el cambio.')); return; }
  await cargar(true);
  toast(activo ? 'Socio reactivado.' : 'Socio dado de baja.');
}

/* ---------- Calendario visible, independiente del navegador ---------- */
function campoCalendario() { return $('#'+(S.calendarioCampo || 'cFechaPago')); }
function alternarCalendario(campo = 'cFechaPago') {
  S.calendarioCampo = campo;
  const panel = $('#calendarioPago'); if (!panel) return;
  if (!panel.hidden) { panel.hidden = true; $('#abrirCalendarioPago').setAttribute('aria-expanded','false'); return; }
  const fecha = Cuotas.valida(campoCalendario().value) ? campoCalendario().value : hoyISO();
  S.calendario = {anio:Number(fecha.slice(0,4)),mes:Number(fecha.slice(5,7))-1};
  panel.hidden = false; $('#abrirCalendarioPago').setAttribute('aria-expanded','true'); renderCalendario(); panel.scrollIntoView({block:'nearest'});
}
function renderCalendario() {
  const panel = $('#calendarioPago'); if (!panel || !S.calendario) return;
  const {anio,mes} = S.calendario;
  const min = campoCalendario().min; const max = campoCalendario().max;
  const primero = (new Date(anio,mes,1).getDay()+6)%7;
  const dias = new Date(anio,mes+1,0).getDate();
  const inicial = Math.min(Number(min.slice(0,4)) || anio, anio);
  const final = Math.max(new Date().getFullYear()+10,anio);
  let opciones = ''; for(let y=inicial;y<=final;y++) opciones += `<option value="${y}" ${y===anio?'selected':''}>${y}</option>`;
  let grilla = '<span aria-hidden="true"></span>'.repeat(primero);
  for(let dia=1;dia<=dias;dia++) {
    const fecha = `${anio}-${pad(mes+1)}-${pad(dia)}`;
    grilla += `<button type="button" class="cal-dia ${fecha===hoyISO()?'cal-hoy':''}" data-act="cal-dia" data-fecha="${fecha}" aria-label="${fmtFecha(fecha)}" aria-pressed="${fecha===campoCalendario().value}" ${fecha<min||(max&&fecha>max)?'disabled':''}>${dia}</button>`;
  }
  panel.innerHTML = `<div class="cal-nav"><button type="button" class="btn sm" data-act="cal-mes" data-d="-1" aria-label="Mes anterior" ${anio===1900&&mes===0?'disabled':''}>‹</button><div class="field"><label class="sr" for="calMes">Mes del calendario</label><select id="calMes">${MESES.map((m,i)=>`<option value="${i}" ${i===mes?'selected':''}>${m}</option>`).join('')}</select></div><div class="field"><label class="sr" for="calAnio">Año del calendario</label><select id="calAnio">${opciones}</select></div><button type="button" class="btn sm" data-act="cal-mes" data-d="1" aria-label="Mes siguiente" ${anio===9999&&mes===11?'disabled':''}>›</button></div><div class="cal-semana" aria-hidden="true">${['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d=>`<span>${d}</span>`).join('')}</div><div class="cal-dias" role="group" aria-label="Días de ${MESES[mes]} ${anio}">${grilla}</div><button type="button" class="linkbtn" data-act="cal-hoy" ${hoyISO()<min||(max&&hoyISO()>max)?'disabled':''}>Seleccionar hoy</button>`;
}
function moverCalendario(delta) {
  const d = new Date(S.calendario.anio,S.calendario.mes+delta,1);
  if(d.getFullYear()<1900 || d.getFullYear()>9999) return;
  S.calendario = {anio:d.getFullYear(),mes:d.getMonth()}; renderCalendario();
}
function elegirFecha(fecha) {
  const campo = campoCalendario(); if(!Cuotas.valida(fecha) || fecha<campo.min || (campo.max && fecha>campo.max)) return;
  campo.value = fecha; campo.dispatchEvent(new Event('input',{bubbles:true}));
  $('#calendarioPago').hidden=true; $('#abrirCalendarioPago').setAttribute('aria-expanded','false'); $('#abrirCalendarioPago').focus();
}

/* ---------- Gestión de recepción: privilegios verificados en la base ---------- */
async function abrirRecepcionistas() {
  if (!S.admin || S.session?.rol !== 'recepcion') return;
  S.modal = {tipo:'recepcionistas'};
  abrir(`<div class="dlg-head"><div><p class="eyebrow">Administración</p><h2 id="dlgTitulo">Recepcionistas</h2></div>${btnCerrar}</div>
    <form id="formRecepcionista" class="form" novalidate><h3>Agregar recepcionista</h3>
    <div class="field"><label for="rpEmail">Correo electrónico</label><input id="rpEmail" type="email" autocomplete="off" maxlength="254"></div>
    <div class="field"><label for="rpPass">Contraseña inicial para cuenta nueva</label><input id="rpPass" type="password" autocomplete="new-password" minlength="8"><p class="hint">Mínimo 8 caracteres. Si la cuenta ya existe, usa el botón de acceso sin escribir una contraseña.</p></div>
    <p id="rpError" class="error" role="alert" hidden></p><p id="rpResultado" class="aviso" role="status" hidden></p>
    <div class="acciones"><button id="rpCrear" class="btn primary" type="submit">Crear recepcionista</button><button id="rpExistente" class="btn" type="button" data-act="autorizar-existente">Dar acceso a cuenta existente</button></div></form>
    <h3>Cuentas con acceso</h3><div id="rpLista" aria-live="polite">Cargando…</div>`);
  await cargarRecepcionistas();
}
async function cargarRecepcionistas() {
  const lista = $('#rpLista'); if (!lista || !S.admin) return;
  try {
    const {data,error} = await sb.rpc('listar_recepcionistas'); if(error) throw error;
    if (!lista.isConnected) return;
    lista.innerHTML = `<ul class="staff-list">${(data||[]).map(u=>`<li><div><strong>${esc(u.email)}</strong><p class="hint">${u.administrador?'Administrador':'Recepcionista'} · ${u.confirmado?'Correo confirmado':'Pendiente de confirmar correo'}</p></div>${u.administrador?'':`<button class="btn sm" type="button" data-act="quitar-recepcionista" data-uid="${esc(u.user_id)}">Quitar acceso</button>`}</li>`).join('')}</ul>`;
  } catch { lista.textContent = 'No se pudo cargar la lista. Cierra y vuelve a abrir esta sección.'; }
}
async function guardarRecepcionista(existente) {
  if (!S.admin || S.session?.rol !== 'recepcion') return;
  const err=$('#rpError'), resultado=$('#rpResultado'), crear=$('#rpCrear'), autorizar=$('#rpExistente');
  if(!crear || crear.disabled) return;
  const correo=$('#rpEmail').value.trim().toLowerCase(), clave=$('#rpPass').value;
  const fallo=m=>{if(err.isConnected){err.textContent=m;err.hidden=false;}};
  err.hidden=true; resultado.hidden=true;
  if(!correo || !$('#rpEmail').checkValidity()) return fallo('Escribe un correo electrónico válido.');
  if(!existente && clave.length<8) return fallo('La contraseña inicial debe tener al menos 8 caracteres.');
  crear.disabled=true;autorizar.disabled=true;
  let confirmar=false, creada=false;
  try {
    if(!existente) {
      // Cliente separado: registrar al nuevo usuario nunca cambia la sesión del administrador.
      const altas=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'ra-gym-altas'}});
      try {
        const {data,error}=await altas.auth.signUp({email:correo,password:clave});
        if(error) {
          if(error.code==='signup_disabled' || /signups? not allowed|signup.*disabled/i.test(error.message||'')) throw new Error('altas_deshabilitadas');
          if(error.code==='user_already_exists' || /already registered/i.test(error.message||'')) throw new Error('cuenta_existente');
          if(error.code==='over_email_send_rate_limit' || error.status===429) throw new Error('limite_altas');
          throw new Error('alta_fallida');
        }
        if(!data?.user || data.user.identities?.length===0) throw new Error('cuenta_existente');
        creada=true; confirmar=!data.session;
        if(data.session) await altas.auth.signOut({scope:'local'});
      } finally { if($('#rpPass')) $('#rpPass').value=''; }
    }
    if(S.session?.rol!=='recepcion' || !S.admin) return;
    const {error}=await sb.rpc('autorizar_recepcionista',{p_correo:correo});
    if(error) throw error;
    if(resultado.isConnected) { resultado.textContent=confirmar?'Cuenta creada y autorizada. El recepcionista debe confirmar el enlace recibido en su correo antes de entrar.':(existente?'Acceso de recepción habilitado. La contraseña de esa cuenta no cambió.':'Cuenta creada y autorizada. Ya puede entrar por Recepción.');resultado.hidden=false; }
    await cargarRecepcionistas();
  } catch(e) {
    const m=String(e.message||'');
    fallo(m.includes('altas_deshabilitadas')?'Las altas por correo están desactivadas. Activa una sola vez Allow new users to sign up en Authentication de Supabase.':m.includes('cuenta_existente')?'La cuenta ya existe. Usa Dar acceso a cuenta existente; su contraseña no se cambia.':m.includes('limite_altas')?'Se alcanzó el límite de creación o envío de correos. Espera antes de reintentar o revisa los límites de correo del proyecto.':m.includes('cuenta_no_encontrada')?'No existe una cuenta con ese correo. Usa Crear recepcionista.':m.includes('sin_permiso')?'Tu cuenta ya no tiene permiso de administración.':creada?'La cuenta se creó, pero no se pudo dar acceso. Reintenta con Dar acceso a cuenta existente.':'No se pudo completar el registro. Revisa la conexión y los requisitos de contraseña del proyecto.');
  } finally {crear.disabled=false;autorizar.disabled=false;}
}
async function quitarRecepcionista(id) {
  if(!S.admin || S.session?.rol!=='recepcion') return;
  try {const {error}=await sb.rpc('quitar_recepcionista',{p_user_id:id});if(error)throw error;await cargarRecepcionistas();toast('Acceso de recepción retirado.');}
  catch {toast('No se pudo quitar el acceso. Las cuentas administradoras están protegidas.');}
}

/* ---------- Visitantes que pagan por día ---------- */
async function cargarDiarios() {
  try {
    const datos=await traerTodo('pases_diarios','id,nombre,ci,fecha,monto,metodo,nota,creado',['fecha','id']);
    if(S.session?.rol!=='recepcion') return false;
    S.diarios=datos;S.diariosError='';return true;
  } catch(e) {
    S.diariosError=['PGRST205','42P01'].includes(e.code)?'Para activar esta sección, aplica 7_pases_diarios.sql en Supabase.':'No se pudieron actualizar los pases diarios. Revisa la conexión e intenta nuevamente.';
    return false;
  }
}
async function abrirDiarios() {
  if(S.session?.rol!=='recepcion')return;
  S.modal={tipo:'diarios'};S.diariosFecha=hoyISO();S.diariosNombre='';S.diariosCi='';
  abrir(`<div class="dlg-head"><div><p class="eyebrow">Recepción · Pago por visita</p><h2 id="dlgTitulo">Pases diarios</h2><p class="hint">Registra cada visita sin generar cuotas mensuales.</p></div>${btnCerrar}</div>
    <div id="diariosAviso" role="status"></div><div id="diariosStats" class="diarios-stats"></div>
    <form id="formDiario" class="form" novalidate><h3>Registrar pase</h3>
    <div class="fila2"><div class="field"><label for="pdNombre">Nombre completo</label><input id="pdNombre" maxlength="120" autocomplete="off"></div><div class="field"><label for="pdCi">CI (opcional)</label><input id="pdCi" inputmode="numeric" maxlength="14" placeholder="Solo números" autocomplete="off"></div></div>
    <div class="fila2"><div class="field"><label for="pdFecha">Fecha de la visita y pago</label><div class="fecha-selector"><input id="pdFecha" type="date" min="1900-01-01" max="${hoyISO()}" value="${hoyISO()}"><button type="button" class="btn" id="abrirCalendarioPago" data-act="calendario-pago" data-campo="pdFecha" aria-controls="calendarioPago" aria-expanded="false">📅 Elegir fecha</button></div><div id="calendarioPago" class="calendario" hidden></div></div><div class="field"><label for="pdMonto">Precio del pase (Gs.)</label><input id="pdMonto" type="number" min="1" step="1000" inputmode="numeric" value="${esc(S.tarifaDiaria)}" placeholder="Ingresa el precio por día"></div></div>
    <div class="fila2"><div class="field"><label for="pdMetodo">Método de pago</label><select id="pdMetodo">${METODOS.map(m=>`<option>${m}</option>`).join('')}</select></div><div class="field"><label for="pdNota">Nota (opcional)</label><input id="pdNota" maxlength="120" autocomplete="off"></div></div>
    <p class="error" id="pdError" role="alert" hidden></p><button id="pdGuardar" class="btn primary" type="submit">Registrar pase diario</button></form>
    <h3>Historial de pases</h3><div class="diarios-filtros"><div class="field"><label for="pdFiltroFecha">Fecha (vacía para ver todas)</label><input id="pdFiltroFecha" type="date" value="${hoyISO()}"></div><div class="field"><label for="pdFiltroNombre">Nombre</label><input id="pdFiltroNombre" type="search" placeholder="Buscar nombre"></div><div class="field"><label for="pdFiltroCi">CI</label><input id="pdFiltroCi" type="search" inputmode="numeric" placeholder="Buscar CI"></div></div>
    <div class="acciones"><button type="button" class="btn sm" data-act="diarios-todos">Ver todos los días</button><button type="button" class="btn sm" data-act="diarios-actualizar">Actualizar pases</button></div>
    <p id="pdResultados" class="hint" aria-live="polite"></p><div id="pdLista"></div>`);
  await actualizarDiarios();
}
async function actualizarDiarios() {
  const ok=await cargarDiarios();if(!$('#pdLista'))return;
  $('#diariosAviso').innerHTML=ok?'':`<p class="aviso">${esc(S.diariosError)}</p>`;
  $('#pdGuardar').disabled=!ok;
  renderDiarios();
}
function renderDiarios() {
  if(!$('#pdLista'))return;
  const deHoy=S.diarios.filter(p=>p.fecha===hoyISO());
  $('#diariosStats').innerHTML=`<div><span>Pases de hoy</span><strong>${deHoy.length}</strong></div><div><span>Cobrado hoy</span><strong>${fmtGs(deHoy.reduce((t,p)=>t+Number(p.monto),0))}</strong></div>`;
  const lista=S.diarios.filter(p=>(!S.diariosFecha||p.fecha===S.diariosFecha)&&Cuotas.coincide(p,S.diariosNombre,S.diariosCi)).sort((a,b)=>b.fecha.localeCompare(a.fecha)||String(b.creado).localeCompare(String(a.creado)));
  $('#pdResultados').textContent=`${lista.length} ${lista.length===1?'pase':'pases'} · ${fmtGs(lista.reduce((t,p)=>t+Number(p.monto),0))} en la selección`;
  $('#pdLista').innerHTML=lista.length?`<ul class="diarios-lista">${lista.map(p=>`<li><div><strong>${esc(p.nombre)}</strong><p class="hint">${p.ci?'CI '+esc(p.ci):'Sin CI'} · ${fmtFecha(p.fecha)}</p>${p.nota?`<p class="hint">${esc(p.nota)}</p>`:''}</div><div><strong>${fmtGs(p.monto)}</strong><p class="hint">${esc(p.metodo)}</p></div></li>`).join('')}</ul>`:'<p class="hint">No hay pases para estos filtros.</p>';
}
async function guardarDiario() {
  if(S.session?.rol!=='recepcion')return;
  const btn=$('#pdGuardar'),err=$('#pdError');if(!btn||btn.disabled)return;
  const fallo=m=>{if(err.isConnected){err.textContent=m;err.hidden=false;}};
  const nombre=$('#pdNombre').value.trim().replace(/\s+/g,' '),ci=$('#pdCi').value.replace(/\D/g,''),fecha=$('#pdFecha').value,monto=Number($('#pdMonto').value),metodo=$('#pdMetodo').value,nota=$('#pdNota').value.trim();
  err.hidden=true;
  if(nombre.length<2||nombre.length>120)return fallo('Escribe el nombre del visitante.');
  if($('#pdCi').value.trim()&&!/^\d{5,10}$/.test(ci))return fallo('La CI debe tener entre 5 y 10 dígitos, o quedar vacía.');
  if(!Cuotas.valida(fecha)||fecha>hoyISO())return fallo('Selecciona una fecha válida, hasta hoy.');
  if(!Number.isInteger(monto)||monto<=0||monto>2147483647)return fallo('Ingresa un precio mayor a cero, en guaraníes enteros.');
  btn.disabled=true;
  try {
    const {error}=await sb.from('pases_diarios').insert({nombre,ci,fecha,monto,metodo,nota});if(error)throw error;
    S.tarifaDiaria=String(monto);
    if(!btn.isConnected)return;
    $('#formDiario').reset();$('#pdMonto').value=S.tarifaDiaria;$('#pdFecha').value=hoyISO();
    S.diariosFecha=fecha;$('#pdFiltroFecha').value=fecha;S.diariosNombre='';S.diariosCi='';$('#pdFiltroNombre').value='';$('#pdFiltroCi').value='';
    const ok=await cargarDiarios();if(!btn.isConnected)return;
    $('#diariosAviso').innerHTML=ok?'':`<p class="aviso">El pase se guardó. ${esc(S.diariosError)} No vuelvas a registrarlo.</p>`;
    renderDiarios();toast('Pase diario registrado.');
  } catch {fallo('No se pudo confirmar el registro. Actualiza el historial antes de reintentar para evitar duplicados.');}
  finally {btn.disabled=false;}
}

/* ---------- Exportación de recepción ---------- */
async function descargarExcel(btn) {
  if (S.session?.rol !== 'recepcion' || btn.disabled) return;
  if (!window.ExcelJS || !window.ExportarCuotas) { toast('No se pudo cargar la exportación. Recarga la página.'); return; }
  btn.disabled = true; btn.textContent = 'Preparando Excel…';
  try {
    // Actualiza todas las páginas de socios/pagos; los filtros solo afectan a la pantalla.
    await cargar(true);
    if (S.session?.rol !== 'recepcion') return;
    if (S.errorDatos || !S.cargado) { toast('No se pudo actualizar la información. Revisa tu conexión y vuelve a descargar.'); return; }
    if(!await cargarDiarios()) {toast(S.diariosError);return;}
    const hoy = hoyISO();
    const libro = ExportarCuotas.crearLibro(S.clientes, hoy, window.ExcelJS, Cuotas, S.diarios);
    const buffer = await libro.xlsx.writeBuffer();
    if (S.session?.rol !== 'recepcion') return;
    const url = URL.createObjectURL(new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const enlace = document.createElement('a');
    enlace.href = url; enlace.download = `cuotas-gimnasio-${hoy}.xlsx`;
    document.body.appendChild(enlace); enlace.click(); enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('Excel descargado: resumen, socios, cuotas y pases diarios.');
  } catch {
    toast('No se pudo generar el Excel. Intenta nuevamente.');
  } finally {
    btn.disabled = false; btn.textContent = 'Descargar Excel';
  }
}

/* ---------- Vista de socio ---------- */
function clienteHTML(c) {
  const pg = pagosDe(c).sort((a, b) => b.periodo.localeCompare(a.periodo));
  const total = pg.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const delAnio = pg.filter(p => p.periodo.startsWith(String(S.anio))).length;
  return `<div class="wrap">
    ${topHTML('Socio')}
    <main class="socio">
      <section><p class="eyebrow">Carnet de socio</p><h1 class="nombre-grande">${esc(c.nombre)}</h1>
        <p class="socio-meta"><span class="mono">CI ${fmtCI(c.ci)}</span> · Socio desde ${fmtFecha(Cuotas.inscripcion(c))}</p></section>
      <div class="membership-status">${pillHTML(c, estado(c))}<span>Vencimiento mensual: día ${Number(Cuotas.fechaPago(c).slice(8))} · Cuota ${fmtGs(c.cuota)}</span></div><div class="socio-bar">${anioNav()}<button type="button" class="btn ghost sm" data-act="actualizar-socio">Actualizar</button></div>
      ${carnetHTML(c, S.anio, 'cliente')}
      <p class="resumen">${delAnio} ${delAnio === 1 ? 'cuota pagada' : 'cuotas pagadas'} en ${S.anio}</p>
      <section><h2>Historial de pagos</h2>
        ${pg.length ? `<ul class="hist">${pg.map(p => `<li class="sin-acc"><span class="h-per">${etiqueta(p.periodo)}</span><span class="h-fec">${fmtFecha(p.fecha)}</span><span class="h-met">${esc(p.metodo || '')}</span><span class="h-monto mono">${fmtGs(p.monto)}</span></li>`).join('')}</ul>
        <div class="total-pagado"><span>Total pagado</span><strong>${fmtGs(total)}</strong></div>` : '<p class="muted">Todavía no hay pagos registrados.</p>'}
      </section>
    </main></div>`;
}
function fichaDeSocio(d) {
  const pagos = {};
  (d.pagos || []).forEach(p => { pagos[p.periodo] = { monto: p.monto, fecha: p.fecha, metodo: p.metodo }; });
  return { ...d.socio, pagos };
}
async function pedirFicha(ci, pin) {
  try {
    const { data, error } = await sb.rpc('socio_login', { p_ci: ci, p_pin: pin });
    if (error || !data) return { red: true };
    return data;
  } catch { return { red: true }; }
}
async function entrarSocio() {
  if (!sb) { toast('Configura la conexión a Supabase para consultar tus cuotas.'); return; }
  const err = $('#lgError'); const btn = $('#lgOk');
  const fallo = m => { err.textContent = m; err.hidden = false; btn.disabled = false; };
  const ci = $('#lgCi').value.replace(/\D/g, ''); const pin = $('#lgPin').value.trim();
  if (!ci || !pin) return fallo('Escribe tu cédula y tu PIN.');
  btn.disabled = true; err.hidden = true;
  const d = await pedirFicha(ci, pin);
  if (d.red) return fallo('No se pudo conectar. Revisa tu conexión e intenta de nuevo.');
  if (d.bloqueado) return fallo('Demasiados intentos fallidos. Espera 15 minutos o pide a recepción que te cambie el PIN.');
  if (!d.ok) return fallo('Cédula o PIN incorrectos. Revisa los datos o consulta en recepción.');
  S.socio = fichaDeSocio(d); S.creds = { ci, pin };
  S.session = { rol: 'cliente' }; S.anio = new Date().getFullYear();
  render();
}
async function actualizarSocio() {
  if (!S.creds) return;
  const d = await pedirFicha(S.creds.ci, S.creds.pin);
  if (d.ok) { S.socio = fichaDeSocio(d); update(); toast('Datos actualizados.'); }
  else toast('No se pudo actualizar. Revisa tu conexión.');
}

/* ---------- Render general ---------- */
let tt;
function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, ms);
}
function render() {
  if (!S.session) { app.innerHTML = loginHTML(); return; }
  if (S.session.rol === 'recepcion') { app.innerHTML = recepcionHTML(); update(); return; }
  update();
}
function update() {
  if (!S.session) return;
  if (S.session.rol === 'recepcion') {
    if (!$('#lista')) return;
    renderStats(); renderLista(); renderAviso(); refrescarDetalle();
  } else if (S.socio) {
    app.innerHTML = clienteHTML(S.socio);
  }
}
function armar(el, texto, fn) {
  if (el.dataset.armed) { clearTimeout(el._t); fn(); return; }
  el.dataset.armed = '1'; const orig = el.textContent; el.textContent = texto;
  el._t = setTimeout(() => { delete el.dataset.armed; el.textContent = orig; }, 4000);
}
function sugerido() {
  const act = S.clientes.filter(activo).map(c => ({ c, e: estado(c) }));
  act.sort((a, b) => b.e.retraso - a.e.retraso || byNombre(a.c, b.c));
  return act[0] ? act[0].c.id : null;
}
async function salir() {
  const eraRecepcion = S.session && S.session.rol === 'recepcion';
  S.diarios=[]; S.diariosError=''; S.admin = false; S.session = null; S.socio = null; S.creds = null; S.clientes = []; S.cargado = false; S.q = ''; S.ci = ''; S.filtro = 'todos'; S.rolTab = 'cliente';
  cerrar(); refrescarLogin();
  if (eraRecepcion && sb) { try { await sb.auth.signOut(); } catch {} }
}

/* ---------- Eventos ---------- */
async function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) {
    const row = e.target.closest('.row');
    if (row && !e.target.closest('button')) abrirDetalle(row.dataset.id);
    return;
  }
  const act = el.dataset.act;
  const fila = el.closest('.row');
  switch (act) {
    case 'calendario-pago': alternarCalendario(el.dataset.campo || 'cFechaPago'); break;
    case 'cal-mes': moverCalendario(Number(el.dataset.d)); break;
    case 'cal-dia': elegirFecha(el.dataset.fecha); break;
    case 'cal-hoy': elegirFecha(hoyISO()); break;
    case 'pases-diarios': abrirDiarios(); break;
    case 'diarios-actualizar': actualizarDiarios(); break;
    case 'diarios-todos': S.diariosFecha='';$('#pdFiltroFecha').value='';renderDiarios();break;
    case 'recepcionistas': abrirRecepcionistas(); break;
    case 'autorizar-existente': guardarRecepcionista(true); break;
    case 'quitar-recepcionista': armar(el, '¿Quitar acceso?', () => quitarRecepcionista(el.dataset.uid)); break;
    case 'rol': S.rolTab = el.dataset.r; refrescarLogin(); break;
    case 'salir': salir(); break;
    case 'actualizar': cargar(false); break;
    case 'exportar-excel': descargarExcel(el); break;
    case 'actualizar-socio': actualizarSocio(); break;
    case 'filtro': S.filtro = el.dataset.f; renderLista(); break;
    case 'detalle': if (fila) abrirDetalle(fila.dataset.id); break;
    case 'cobrar': abrirCobrar(fila ? fila.dataset.id : (S.modal && S.modal.id)); break;
    case 'cobrar-global': abrirCobrar(sugerido()); break;
    case 'nuevo-cliente': abrirClienteForm(null); break;
    case 'editar': abrirClienteForm(S.modal && S.modal.id); break;
    case 'volver': if (S.modal && S.modal.id) abrirDetalle(S.modal.id); else cerrar(); break;
    case 'cerrar': cerrar(); break;
    case 'baja': case 'reactivar': cambiarEstado(S.modal && S.modal.id, act === 'reactivar'); break;
    case 'anio':
      S.anio += Number(el.dataset.d);
      if (S.session && S.session.rol === 'cliente') update(); else refrescarDetalle();
      break;
    case 'whatsapp-pago': reenviarConfirmacion(S.modal?.id,el.dataset.p);break;
    case 'quitar': armar(el, '¿Seguro?', () => quitarPago(S.modal.id, el.dataset.p)); break;
    case 'n-mas': case 'n-menos': {
      const i = $('#pgN'); i.value = clamp((parseInt(i.value, 10) || 1) + (act === 'n-mas' ? 1 : -1), 1, 12); cobrarActualizar(); break;
    }
    case 'cubrir-todo': {
      const c = S.clientes.find(x => x.id === $('#pgCliente').value);
      if (c) { $('#pgN').value = clamp(estado(c).retraso, 1, 12); cobrarActualizar(); }
      break;
    }
    case 'gen-pin': $('#cPin').value = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000); break;
  }
}
function onSubmit(e) {
  const f = e.target;
  if (!f || !f.id) return;
  e.preventDefault();
  if (f.id === 'formStaff') entrarRecepcion();
  else if (f.id === 'formLogin') entrarSocio();
  else if (f.id === 'formPago') enviarPago();
  else if (f.id === 'formCliente') guardarCliente(f);
  else if (f.id === 'formDiario') guardarDiario();
  else if (f.id === 'formRecepcionista') guardarRecepcionista(false);
}
function onInput(e) {
  const id = e.target.id;
  if (id === 'busca') { S.q = e.target.value; renderLista(); }
  else if (id === 'buscaCi') { S.ci = e.target.value; renderLista(); }
  else if(id==='pdFiltroFecha'){S.diariosFecha=e.target.value;renderDiarios();}
  else if(id==='pdFiltroNombre'){S.diariosNombre=e.target.value;renderDiarios();}
  else if(id==='pdFiltroCi'){S.diariosCi=e.target.value;renderDiarios();}
  else if (id === 'waTelefono') actualizarWhatsApp();
  else if (id === 'orden') { S.orden = e.target.value; renderLista(); }
  else if (id === 'pgCliente') {
    const c = S.clientes.find(x => x.id === e.target.value);
    if (c) { $('#pgMonto').value = Number(c.cuota) || 0; S.modal = { tipo: 'cobrar', id: c.id }; cobrarActualizar(); }
  }
  else if (id === 'cInicio') { $('#cFechaPago').min = e.target.value; $('#cError').hidden = true; if (!$('#calendarioPago').hidden) renderCalendario(); }
  else if (id === 'cFechaPago') { $('#cError').hidden = true; }
  else if (id === 'calMes' || id === 'calAnio') { S.calendario = {anio:Number($('#calAnio').value),mes:Number($('#calMes').value)}; renderCalendario(); }
  else if (id === 'pgFecha') { $('#pgError').hidden = true; }
  else if (id === 'pgN' || id === 'pgMonto') cobrarActualizar();
}
document.addEventListener('keydown', e => {
  if (e.target.matches('[role=tab]') && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
    e.preventDefault(); S.rolTab = e.key === 'Home' ? 'cliente' : e.key === 'End' ? 'recepcion' : S.rolTab === 'cliente' ? 'recepcion' : 'cliente';
    refrescarLogin(); $('[role=tab][aria-selected=true]').focus();
  }
});
document.addEventListener('click', onClick);
document.addEventListener('submit', onSubmit);
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.session && S.session.rol === 'recepcion' && !dlg.open && Date.now() - S.ultimaCarga > 30000) cargar(true);
});

/* ---------- Arranque ---------- */
async function boot() {
  if (!configurado) { app.innerHTML = loginHTML() + configHTML(); return; }
  if (!sb) { app.innerHTML = '<main class="wrap"><div class="aviso cfg"><strong>No se pudo cargar la conexión con la base de datos.</strong><span>Revisa tu conexión a internet y recarga la página.</span></div></main>'; return; }
  app.innerHTML = loginHTML();
  sb.auth.onAuthStateChange(evento => {
    if (evento === 'SIGNED_OUT' && S.session && S.session.rol === 'recepcion') {
      S.diarios=[]; S.diariosError=''; S.admin = false; S.session = null; S.clientes = []; S.cargado = false; cerrar(); refrescarLogin();
      toast('Tu sesión terminó. Vuelve a entrar.');
    }
  });
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      if (await esRecepcion()) { S.admin = await esAdministrador(); S.session = { rol: 'recepcion' }; render(); cargar(true); }
      else await sb.auth.signOut();
    }
  } catch { /* sin conexión: queda la pantalla de acceso */ }
}
boot();
})();

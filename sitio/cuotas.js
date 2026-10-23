/* Fechas civiles: sin conversiones UTC ni desplazamientos por zona horaria. */
(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const valida = s => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const [y,m,d] = s.split('-').map(Number);
    return y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(y,m,0).getDate();
  };
  const inscripcion = c => valida(c.inscripcion) ? c.inscripcion : `${c.inicio}-01`;
  const fechaPago = c => valida(c.fecha_pago) ? c.fecha_pago : inscripcion(c);
  const vence = (c, periodo) => {
    const [y,m] = periodo.split('-').map(Number);
    const dia = Math.min(Number(fechaPago(c).slice(8)), new Date(y,m,0).getDate());
    return `${y}-${pad(m)}-${pad(dia)}`;
  };
  const siguiente = p => {
    const [y,m] = p.split('-').map(Number);
    return m === 12 ? `${y+1}-01` : `${y}-${pad(m+1)}`;
  };
  const estado = (c,hoy) => {
    const adeuda = [];
    for (let p = fechaPago(c).slice(0,7), i=0; p <= hoy.slice(0,7) && i<1200; p=siguiente(p),i++) {
      if (vence(c,p) <= hoy && !c.pagos?.[p]) adeuda.push(p);
    }
    return {retraso:adeuda.length,adeuda};
  };
  const coincide = (c,nombre,ci) => {
    const normal = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    return normal(c.nombre).includes(normal(nombre)) && String(c.ci).includes(ci.replace(/\D/g,''));
  };
  const api = {valida,inscripcion,fechaPago,vence,estado,coincide};
  if (typeof module === 'object') module.exports = api;
  else root.Cuotas = api;
})(typeof window === 'object' ? window : globalThis);

/* Enlaces de WhatsApp: no envía mensajes ni usa una API de pago. */
(function(root){
  'use strict';
  function telefono(valor) {
    const raw=String(valor||'').trim();
    if(!/^\+?[\d\s().-]+$/.test(raw))return '';
    let n=raw.replace(/[^\d]/g,'');
    if(raw.startsWith('+'))return /^[1-9]\d{7,14}$/.test(n)?n:'';
    if(n.startsWith('00'))n=n.slice(2);
    else if(/^09\d{8}$/.test(n))n='595'+n.slice(1);
    else if(/^9\d{8}$/.test(n))n='595'+n;
    return /^[1-9]\d{7,14}$/.test(n)?n:'';
  }
  function mensaje({nombre,filas,socio,hoy,verificado,gimnasio},Cuotas) {
    const meses=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const periodos=[...new Set(filas.map(p=>p.periodo))].sort();
    const etiquetas=periodos.map(p=>`${meses[Number(p.slice(5))-1]}(${p.slice(0,4)})`);
    const fechas=[...new Set(filas.map(p=>p.fecha))].sort().map(f=>`${f.slice(8)}/${f.slice(5,7)}/${f.slice(0,4)}`);
    const total=filas.reduce((t,p)=>t+Number(p.monto),0);
    let estado='Pago registrado. Estado de cuotas pendiente de verificar.';
    if(verificado && socio) {
      const pendientes=Cuotas.estado(socio,hoy).retraso;
      estado=pendientes?`Pago registrado. Quedan ${pendientes} ${pendientes===1?'cuota pendiente':'cuotas pendientes'}.`: 'Al día 🏋️';
      if(socio.activo===false)estado='Pago registrado. Socio de baja.';
    }
    // Evitar que nombres escritos por usuarios alteren el formato del recibo.
    const limpio=v=>String(v||'').replace(/[\r\n*_~`]/g,' ').replace(/\s+/g,' ').trim();
    return ['✅ *REGISTRO DE PAGO EXITOSO*',`*Socio/a:* ${limpio(nombre)}`,'*Concepto:* Cuota mensual',
      `*${periodos.length===1?'Mes abonado':'Meses abonados'}:* ${etiquetas.join(', ')}`,
      `*Monto total:* Gs. ${String(total).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}`,
      `*Fecha de pago:* ${fechas.join(', ')}`,`*Estado:* ${estado}`,'',
      '¡Gracias por tu pago! Que tengas un excelente entrenamiento.',limpio(gimnasio)].filter((v,i,a)=>v!==''||i<a.length-1).join('\n');
  }
  function enlace(numero,texto){const n=telefono(numero);return n?'https://wa.me/'+n+'?text='+encodeURIComponent(texto):'';}
  const api={telefono,mensaje,enlace};
  if(typeof module==='object')module.exports=api;else root.ConfirmacionWhatsApp=api;
})(typeof window==='object'?window:globalThis);

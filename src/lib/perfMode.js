/**
 * Modo Rendimiento: preferencia por navegador (localStorage) que apaga
 * animaciones, transiciones y efectos costosos para que la información se
 * pinte lo antes posible en equipos o conexiones lentas.
 *
 * Cómo se aplica (todo cuelga del atributo `data-perf="1"` en <html>):
 *  - PERF_MODE_BOOT_SCRIPT corre en el <head>, antes del primer pintado: pone
 *    el atributo y hace que `matchMedia('(prefers-reduced-motion: reduce)')`
 *    responda `true`, así TODO el código que ya respetaba esa preferencia
 *    (GSAP de roles/tablero, carruseles, etc.) se apaga sin tocarlo.
 *  - globals.css tiene las reglas `html[data-perf]` (sin animaciones CSS,
 *    transiciones ni desenfoques).
 *  - PerfModeProvider acelera GSAP y desactiva las animaciones de motion/react.
 * Cambiar el modo recarga la página: es la forma segura de que todo lo ya
 * montado arranque en el modo nuevo.
 */
export const PERF_MODE_KEY = 'scp_modo_rendimiento';

export const PERF_MODE_BOOT_SCRIPT = `(function(){try{
if(localStorage.getItem('${PERF_MODE_KEY}')!=='1')return;
document.documentElement.setAttribute('data-perf','1');
var mm=window.matchMedia;
if(mm){window.matchMedia=function(q){var r=mm.call(window,q);
if(/prefers-reduced-motion:\\s*reduce/.test(String(q))){
return{matches:true,media:r.media,onchange:null,addListener:function(){},removeListener:function(){},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return false}};}
return r;};}
}catch(e){}})();`;

export function isPerfMode() {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-perf') === '1';
}

export function setPerfMode(activo) {
    try {
        if (activo) window.localStorage.setItem(PERF_MODE_KEY, '1');
        else window.localStorage.removeItem(PERF_MODE_KEY);
    } catch {
        // Sin localStorage (modo privado estricto) no hay dónde recordarlo.
    }
    window.location.reload();
}

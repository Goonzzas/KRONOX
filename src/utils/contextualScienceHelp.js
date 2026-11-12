/** Deterministic, offline educational help; no external LLM or fabricated detection. */
export function resolveScienceHelp(q,{scienceContext:raw=null,missionOpen=false}={},target={}){
 if(/en que fechas|que fechas|bandas hay|compar.*epoca/.test(q))return null;
 const relevant=raw?.targetKey===target.key?raw:null,ctx=missionOpen?relevant:null;
 const scientific=/banda|infrarroj|este eje|eje x|eje y|pico|espectr|incertid|puedo concluir|que estoy viendo|pantalla actual|absorcion|continuo|molecul|unidades|ruido|artefacto/.test(q);
 if(!scientific)return null;
 let reply;
 if(/banda|infrarroj/.test(q))reply='Una banda infrarroja es un intervalo de longitudes de onda. En SPHEREx, el filtro variable lineal hace que el centro del intervalo cambie de un píxel a otro. El detector D1–D6 no representa una única longitud de onda. Los colores RGB son elecciones de visualización.';
 else if(!missionOpen)reply='Ahora estás en la escena 3D ilustrativa. Abre la observación del destino para consultar ejes, unidades y medidas reales; no tengo un espectro activo en esta pantalla.';
 else if(ctx?.activeTool==='synthetic-chemistry')reply='Esta sección es una simulación educativa de continuo y absorción, en brillo relativo. No es un espectro observado de SPHEREx. Compara la curva con la referencia de otro observatorio; una coincidencia visual no identifica por sí sola una molécula.';
 else if(!ctx?.hasSpectrum)reply=`Estamos en ${target.name||'el observatorio'}, pero no hay un espectro cargado en esta pantalla. Carga un FITS válido y pulsa «Cargar muestras disponibles». Una lista de productos o un estado de catálogo no aporta todavía una medición.`;
 else if(/eje|unidades/.test(q))reply=`El eje horizontal es la longitud de onda en micrómetros (μm). El vertical es el brillo superficial en ${ctx.unit||'unidades no disponibles'}, no la luminosidad total del objeto. Las barras verticales son incertidumbres estadísticas conservadoras; las horizontales indican ancho del filtro. No se unen los huecos como si fueran mediciones.`;
 else if(/pico|concluir|molecul|absorcion/.test(q)){
  const m=ctx.selected;if(!m)reply='Selecciona «Inspeccionar» en una fila. Un punto alto o un color no demuestra una línea, una molécula ni variabilidad. Necesitamos longitud de onda, incertidumbre, continuo, calidad y respuesta instrumental.';
  else if(m.flux===null)reply=`La muestra seleccionada no contiene una medición válida: ${m.reason||'faltan píxeles de calidad'}. Puedes concluir «Evidencia insuficiente» y explicar el motivo; no conviertas la ausencia en flujo cero.`;
  else reply=`La selección da ${m.flux.toPrecision(4)} ± ${m.sigma.toPrecision(3)} ${m.unit} a ${m.wave.toFixed(4)} μm, con ${m.valid}/${m.total} píxeles válidos. Ese punto es brillo superficial en una apertura de ${m.radiusArcsec} segundos de arco. La PSF no está homogeneizada y faltan sistemáticos. No puedo declarar una detección molecular o un pico espectral solo con este valor.`;
 }else reply=`Observas ${target.name}; ${ctx.measurements.length} muestras discretas, banda activa ${ctx.band||'no especificada'}, unidades ${ctx.unit||'no disponibles'}. Producto activo ${ctx.productId||'sin identificador'}. Las observaciones reales están separadas de la representación 3D y del ejercicio sintético.`;
 return {reply,action:null,role:'KRONOX IA · ayuda contextual local',avatarState:'EXPLAINING',pointDirection:'left',epistemicCategory:'Explicación local basada en el contexto cargado; no es inferencia automática'};
}

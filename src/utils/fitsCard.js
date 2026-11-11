/** FITS slash denotes a comment only outside a quoted value. */
export function parseFitsCardValue(card){
 const source=card.slice(10).trim();
 if(source.startsWith("'")){let result='';for(let i=1;i<source.length;i++){if(source[i]==="'"){if(source[i+1]==="'"){result+="'";i++;}else break;}else result+=source[i];}return result.trim();}
 return source.split('/')[0].trim();
}

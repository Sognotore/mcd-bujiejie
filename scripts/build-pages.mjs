import {mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('dist/',root);
// The public bundle contains only this allowlist. No server code or credentials.
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['styles.css','app.mjs','art.mjs','state.mjs'])await copyFile(new URL(`web/${name}`,root),new URL(name,out));
await copyFile(new URL('src/domain/engine.mjs',root),new URL('engine.mjs',out));
await copyFile(new URL('src/providers/demo.mjs',root),new URL('demo-data.mjs',out));
const html=(await readFile(new URL('web/index.html',root),'utf8')).replace('<html lang="zh-CN">','<html lang="zh-CN" data-runtime="public-demo">');
await writeFile(new URL('index.html',out),html);await writeFile(new URL('.nojekyll',out),'');
console.log('Public demo built: dist/ (8 allowlisted files, no backend required)');

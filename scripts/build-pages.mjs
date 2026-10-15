import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,copyFile,rm,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('dist/',root);
// The public bundle contains only this allowlist. No server code or credentials.
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['styles.css','app.mjs','art.mjs','state.mjs'])await copyFile(new URL(`web/${name}`,root),new URL(name,out));
await copyFile(new URL('src/domain/engine.mjs',root),new URL('engine.mjs',out));
await copyFile(new URL('src/providers/demo.mjs',root),new URL('demo-data.mjs',out));
let html=(await readFile(new URL('web/index.html',root),'utf8')).replace('<html lang="zh-CN">','<html lang="zh-CN" data-runtime="public-demo">');
await mkdir(new URL('assets/',out),{recursive:true});
for(const name of await readdir(new URL('web/assets/',root)))if(/^(meal-hero|food-[a-z]+)\.webp$/.test(name))await copyFile(new URL(`web/assets/${name}`,root),new URL(`assets/${name}`,out));
const version=createHash('sha256').update(html+await readFile(new URL('app.mjs',out),'utf8')+await readFile(new URL('styles.css',out),'utf8')).digest('hex').slice(0,12);
html=html.replace('./styles.css',`./styles.css?v=${version}`).replace('./app.mjs',`./app.mjs?v=${version}`);
await writeFile(new URL('index.html',out),html);await writeFile(new URL('.nojekyll',out),'');
console.log('Public demo built: dist/ (allowlisted static files, no backend required)');

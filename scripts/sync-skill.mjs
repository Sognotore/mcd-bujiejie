import {mkdir,copyFile} from 'node:fs/promises';
const directory=new URL('../skills/mcd-bujiejie/scripts/lib/',import.meta.url);await mkdir(directory,{recursive:true});
for(const file of ['engine.mjs','identity.mjs','nutrition.mjs','nutrition-data.mjs'])await copyFile(new URL('../src/domain/'+file,import.meta.url),new URL(file,directory));
console.log('Skill engine, identity and nutrition reference synchronized');

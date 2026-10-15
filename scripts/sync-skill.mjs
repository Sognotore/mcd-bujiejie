import {mkdir,copyFile} from 'node:fs/promises';
const directory=new URL('../skills/mcd-bujiejie/scripts/lib/',import.meta.url);await mkdir(directory,{recursive:true});await copyFile(new URL('../src/domain/engine.mjs',import.meta.url),new URL('engine.mjs',directory));console.log('Skill engine synchronized');

import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {ToolListChangedNotificationSchema} from '@modelcontextprotocol/sdk/types.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import Ajv from 'ajv';import Ajv2020 from 'ajv/dist/2020.js';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';
import {MealError} from '../domain/engine.mjs';
export const ALLOWED_TOOLS=['query-nearby-stores','query-meals','query-meal-detail','query-store-coupons','calculate-price'];
const orderPinned=JSON.parse(readFileSync(new URL('./order-tool-schemas.json',import.meta.url),'utf8'));
const pinned=JSON.parse(readFileSync(new URL('./tool-schemas.json',import.meta.url),'utf8'));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>!['description','title'].includes(k)).sort().map(k=>[k,canonical(v[k])])):v;
export const schemaFingerprint=(tools,allowedTools=ALLOWED_TOOLS)=>createHash('sha256').update(JSON.stringify(canonical(tools.filter(x=>allowedTools.includes(x.name)).map(({name,inputSchema})=>({name,inputSchema})).sort((a,b)=>a.name.localeCompare(b.name))))).digest('hex');
export const EXPECTED_SCHEMA_HASH=schemaFingerprint(pinned);
export function mcpError(e){
 if(e instanceof MealError)return e;
 const status=e?.status??e?.code;
 const signal=String(e?.message??'');
 if(status===401||/\b401\b/.test(signal))return new MealError('AUTH_EXPIRED','实时连接凭证无效或已过期，请重新配置。',503);
 if(status===429||/\b429\b/.test(signal))return new MealError('RATE_LIMITED','查询过于频繁，请稍后重试。',429);
 if(status===-32001||e?.name==='TimeoutError'||/timed?\s?out/i.test(signal))return new MealError('MCP_TIMEOUT','官方查询暂时超时，请重试。',504);
 return new MealError('MCP_UNAVAILABLE','暂时无法连接官方菜单，请稍后重试。',502);
}
export function unpack(result){
 const data=result?.structuredContent;
 if(result?.isError) throw mcpError({status:data?.code});
 if(!data||typeof data!=='object'||data.success!==true){
  if(data?.code===401||data?.code===429)throw mcpError({status:data.code});
  throw new MealError('MCD_REJECTED','官方未能完成这次查询，请重试或更换门店。',502);
 }
 if(!Object.hasOwn(data,'data'))throw new MealError('INVALID_RESPONSE','官方响应结构已变化，请更新连接。',502);
 return data.data;
}
export class McpGateway{
 constructor({token=process.env.MCD_MCP_TOKEN,client,expectedHash,ordering=false,log=()=>{},schemaTtlMs=5000,now=Date.now}={}){this.token=token;this.client=client;this.injected=Boolean(client);this.allowedTools=ordering?[...ALLOWED_TOOLS,'create-order','query-order']:ALLOWED_TOOLS;this.expectedHash=expectedHash??schemaFingerprint(ordering?[...pinned,...orderPinned]:pinned,this.allowedTools);this.log=log;this.validators=new Map();this.schemaTtlMs=schemaTtlMs;this.now=now;this.schemaCheckedAt=0;this.schemaDirty=true;this.schemaEpoch=0}
 async connect(){
  if(!this.token)throw new MealError('NOT_CONNECTED','尚未配置实时连接，请先体验演示。',503);
  if(this.connecting)return this.connecting;
  this.connecting=this.initialize().catch(async e=>{this.connecting=null;if(!this.injected){await this.client?.close().catch(()=>{});this.client=null}throw mcpError(e)});
  return this.connecting;
 }
 async initialize(){
  if(!this.client){this.client=new Client({name:'mcd-bujiejie',version:'0.1.0'},{capabilities:{}});await this.client.connect(new StreamableHTTPClientTransport(new URL('https://mcp.mcd.cn'),{requestInit:{headers:{Authorization:`Bearer ${this.token}`}}}),{timeout:15000})}
  this.client.setNotificationHandler?.(ToolListChangedNotificationSchema,()=>{this.schemaEpoch++;this.schemaDirty=true;this.validators.clear()});
  return this.refreshSchemas();
 }
 async refreshSchemas(){
  if(this.schemaChecking)return this.schemaChecking;
  this.schemaChecking=this.readSchemas().finally(()=>{this.schemaChecking=null});return this.schemaChecking;
 }
 async readSchemas(){
  const epoch=this.schemaEpoch;const tools=[];let cursor;let pages=0;
  do{if(++pages>20)throw new MealError('INVALID_SCHEMA','工具清单无法识别。',502);const result=await this.client.listTools(cursor?{cursor}:undefined,{timeout:15000});tools.push(...result.tools);cursor=result.nextCursor}while(cursor);
  const selected=tools.filter(x=>this.allowedTools.includes(x.name));
  if(selected.length!==this.allowedTools.length||schemaFingerprint(selected,this.allowedTools)!==this.expectedHash){this.validators.clear();this.schemaDirty=true;this.schemaEpoch++;throw new MealError('SCHEMA_CHANGED','官方接口定义已变化，请核验并更新连接。',502)}
  const validators=new Map();
  for(const tool of selected){const C=String(tool.inputSchema.$schema??'').includes('2020')?Ajv2020:Ajv;const ajv=new C({strict:false,validateFormats:false});validators.set(tool.name,ajv.compile(tool.inputSchema))}
  this.validators=validators;this.schemaCheckedAt=this.now();this.schemaDirty=epoch!==this.schemaEpoch;this.tools=selected;return selected;
 }
 async verifySchemas({force=false}={}){
  await this.connect();let passes=0;
  while(force||this.schemaDirty||this.now()-this.schemaCheckedAt>=this.schemaTtlMs){
   if(++passes>3)throw new MealError('SCHEMA_CHANGED','官方接口正在变化，请稍后重试。',502);
   try{await this.refreshSchemas()}catch(e){this.validators.clear();this.schemaDirty=true;throw mcpError(e)}
   force=false;
  }
 }
 async call(name,args){
  if(!this.allowedTools.includes(name))throw new MealError('TOOL_DENIED','此功能不支持该操作。',403);
  await this.verifySchemas();
  if(!this.validators.get(name)?.(args))throw new MealError('INVALID_TOOL_ARGUMENTS','查询条件与官方接口不兼容。',400);
  const started=Date.now();const epoch=this.schemaEpoch;
  try{const result=await this.client.callTool({name,arguments:args},undefined,{timeout:20000});if(epoch!==this.schemaEpoch)await this.verifySchemas({force:true});const data=unpack(result);this.log({tool:name,success:true,elapsedMs:Date.now()-started,at:new Date().toISOString()});return data}
  catch(e){const safe=mcpError(e);this.log({tool:name,success:false,code:safe.code,elapsedMs:Date.now()-started,at:new Date().toISOString()});throw safe}
 }
 async close(){await this.client?.close().catch(()=>{});this.connecting=null;this.client=null;this.validators.clear();this.schemaDirty=true;this.schemaCheckedAt=0}
}

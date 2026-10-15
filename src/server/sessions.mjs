import {randomBytes} from 'node:crypto';
import {MealError} from '../domain/engine.mjs';
import {McpGateway} from '../providers/mcp.mjs';
import {McdProvider} from '../providers/mcd-adapter.mjs';
import {CheckoutService} from './checkout.mjs';
const cookieName='__Host-mcd-session';
export class Sessions{
 constructor({providerFactory=token=>new McdProvider({gateway:new McpGateway({token,ordering:true}),cacheDirectory:null}),now=Date.now,ttl=30*60000}={}){this.providerFactory=providerFactory;this.now=now;this.ttl=ttl;this.entries=new Map();this.attempts=new Map();this.pending=0;}
 sweep(){for(const [id,s] of this.entries)if(s.expires<this.now()){this.entries.delete(id);void s.provider.close();}for(const [ip,a] of this.attempts)if(a.at+60000<this.now())this.attempts.delete(ip);}
 get(req){this.sweep();const id=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);return this.entries.get(id)??null;}
 async connect(req,res,token){
  this.sweep();const ip=req.headers['cf-connecting-ip']??req.socket.remoteAddress;const attempt=this.attempts.get(ip)??{at:this.now(),count:0};if(++attempt.count>6)throw new MealError('RATE_LIMITED','连接尝试过于频繁，请稍后重试。',429);this.attempts.set(ip,attempt);
  if(typeof token!=='string'||!/^[A-Za-z0-9._~+/=-]{16,512}$/.test(token))throw new MealError('INVALID_TOKEN','请粘贴从麦当劳官方平台获取的个人 MCP Token。');
  if(this.entries.size+this.pending>=16)throw new MealError('SESSION_LIMIT','体验连接已满，请稍后再试。',503);
  this.pending++;let provider;
  try{provider=this.providerFactory(token);await provider.gateway.connect();}catch(e){await provider?.close();throw e;}finally{this.pending--;}
  this.disconnect(req,res);const id=randomBytes(32).toString('base64url');const expires=this.now()+this.ttl;
  const session={provider,checkout:new CheckoutService(provider),expires};this.entries.set(id,session);
  res.setHeader('set-cookie',`${cookieName}=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(this.ttl/1000)}`);
  return {configured:true,authorizationRequired:true,ordering:true,expiresAt:expires};
 }
 disconnect(req,res){const old=this.get(req);if(old){for(const [id,s] of this.entries)if(s===old)this.entries.delete(id);void old.provider.close();}res.setHeader('set-cookie',`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);}
 async close(){await Promise.allSettled([...this.entries.values()].map(s=>s.provider.close()));this.entries.clear();}
}

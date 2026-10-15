import {createApp} from './app.mjs';import {Sessions} from './sessions.mjs';
// Intentionally never loads .env or constructs a provider from the author's token.
const publicOrigin=process.env.MCD_PUBLIC_ORIGIN;
if(!publicOrigin)throw new Error('Set MCD_PUBLIC_ORIGIN to the HTTPS origin');
const port=Number(process.env.PORT||3190);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
const sessions=new Sessions();const app=createApp({liveProvider:null,publicOrigin,sessions});
const timer=setInterval(()=>sessions.sweep(),30000);timer.unref();
app.listen(port,'127.0.0.1',()=>console.log('Personal-account checkout preview ready on port '+port));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(timer);app.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();});

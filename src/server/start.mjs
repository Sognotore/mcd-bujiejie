import {createApp} from './app.mjs';import {McdProvider} from '../providers/mcd-adapter.mjs';import {McpGateway} from '../providers/mcp.mjs';import {appendFileSync,mkdirSync} from 'node:fs';
mkdirSync('.local',{recursive:true});
const log=record=>{try{appendFileSync('.local/calls.jsonl',JSON.stringify(record)+'\n',{mode:0o600})}catch{}};
const gateway=new McpGateway({log,ordering:true});const provider=new McdProvider({gateway});const app=createApp({liveProvider:provider});
const port=Number(process.env.PORT||3187);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT must be an integer from 1024 to 65535');
app.listen(port,'127.0.0.1',()=>console.log(`麦麦不纠结 http://127.0.0.1:${port} · ${gateway.token?'实时连接已配置':'演示可用'}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{app.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref()});

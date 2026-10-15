import {McpGateway,schemaFingerprint} from '../src/providers/mcp.mjs';import {mkdir,writeFile} from 'node:fs/promises';
const gateway=new McpGateway();
try{const tools=await gateway.connect();await mkdir('.local',{recursive:true});await writeFile('.local/mcp-tools.json',JSON.stringify(tools,null,2),{mode:0o600});console.log(JSON.stringify({connected:true,tools:tools.map(x=>x.name),schemaHash:schemaFingerprint(tools)},null,2))}
catch(e){console.error(e.code??'MCP_UNAVAILABLE',e.message);process.exitCode=1}finally{await gateway.close()}

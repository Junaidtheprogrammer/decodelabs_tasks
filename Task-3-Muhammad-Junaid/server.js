'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openStore } = require('./database');
const statuses = ['queued','in-progress','completed'];
const priorities = ['low','medium','high'];
const fields = ['title','owner','status','priority','category'];
const fail = (status,message) => Object.assign(new Error(message),{status});
function validate(body, previous) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400,'Send a JSON object.');
  if (!Object.keys(body).length) throw fail(400,'Provide at least one field.');
  if (Object.keys(body).some(key => !fields.includes(key))) throw fail(400,'Unknown field in request.');
  const data = {...(previous ? Object.fromEntries(fields.map(key => [key,previous[key]])) : {status:'queued',priority:'medium',category:'General'}),...body};
  for (const [key,min,max] of [['title',3,80],['owner',2,50],['category',2,30]]) {
    if (typeof data[key] !== 'string' || data[key].trim().length < min || data[key].trim().length > max) throw fail(400,`${key} must contain ${min}-${max} characters.`);
    data[key] = data[key].trim();
  }
  if (!statuses.includes(data.status) || !priorities.includes(data.priority)) throw fail(400,'Invalid status or priority.');
  return data;
}
async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw fail(415,'Use application/json.');
  return new Promise((resolve,reject) => {
    const chunks=[]; let size=0; let oversized=false;
    req.on('data', chunk => { size+=chunk.length; if(size>32768) { oversized=true; chunks.length=0; } else if(!oversized) chunks.push(chunk); });
    req.on('end', () => { if(oversized) return reject(fail(413,'Request exceeds 32 KB.')); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(fail(400,'Malformed JSON.')); } });
    req.on('error',reject);
  });
}
function createApp(filename = process.env.DB_PATH || path.join(__dirname,'data','synapse.sqlite')) {
  const store = openStore(filename);
  const server = http.createServer(async (req,res) => {
    const send = (status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(status===204 ? undefined : JSON.stringify(data)); };
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'");
    try {
      const url = new URL(req.url,'http://localhost');
      const route = decodeURIComponent(url.pathname);
      if (route === '/api/health' && req.method==='GET') {
        store.db.prepare('SELECT 1').get();
        return send(200,{status:'healthy',database:'SQLite',schemaVersion:1,persistent:filename!==':memory:'});
      }
      if (route === '/api/stats' && req.method==='GET') return send(200,{data:store.stats()});
      if (route === '/api/activity' && req.method==='GET') return send(200,{data:store.activity()});
      if (route === '/api' && req.method==='GET') return send(200,{name:'Synapse Database / Project 3',storage:'SQLite',routes:['GET /api/health','GET /api/stats','GET /api/activity','GET /api/tasks','GET /api/tasks/:id','POST /api/tasks','PUT /api/tasks/:id','PATCH /api/tasks/:id','DELETE /api/tasks/:id']});
      if (route === '/api/tasks') {
        if(req.method==='GET') {
          const query=Object.fromEntries(url.searchParams);
          if ((query.status && !statuses.includes(query.status)) || (query.priority && !priorities.includes(query.priority))) throw fail(400,'Invalid filter.');
          const data=store.list(query); return send(200,{data,meta:{count:data.length}});
        }
        if(req.method==='POST') { const task=store.create(validate(await readBody(req))); res.setHeader('Location','/api/tasks/'+task.id); return send(201,{data:task}); }
        res.setHeader('Allow','GET, POST'); throw fail(405,'Method not allowed.');
      }
      const match=route.match(/^\/api\/tasks\/([^/]+)$/);
      if(match) {
        const task=store.get(match[1]); if(!task) throw fail(404,'Signal not found.');
        if(req.method==='GET') return send(200,{data:task});
        if(req.method==='PATCH' || req.method==='PUT') return send(200,{data:store.update(task.id,validate(await readBody(req),req.method==='PATCH'?task:undefined))});
        if(req.method==='DELETE') { store.remove(task.id); return send(204); }
        res.setHeader('Allow','GET, PUT, PATCH, DELETE'); throw fail(405,'Method not allowed.');
      }
      const assets={'/':['index.html','text/html'],'/styles.css':['styles.css','text/css'],'/app.js':['app.js','text/javascript']};
      if(assets[route] && req.method==='GET') { const [file,type]=assets[route]; res.writeHead(200,{'Content-Type':type+'; charset=utf-8'}); return res.end(fs.readFileSync(path.join(__dirname,'public',file))); }
      throw fail(404,'Route not found.');
    } catch(error) { if(!res.headersSent) send(error.status||500,{error:{message:error.status?error.message:'Database request failed. Please try again.'}}); }
  });
  return {server,store};
}
if(require.main===module) {
  const {server,store}=createApp();
  const port=Number(process.env.PORT)||4400;
  server.listen(port,'127.0.0.1',()=>console.log(`Synapse Database running at http://127.0.0.1:${port}`));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
}
module.exports={createApp};

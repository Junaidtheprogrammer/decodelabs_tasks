const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('../server');
const sample={title:'Verify durable storage',owner:'Test Developer',category:'Database',priority:'high',status:'queued'};
async function start(file) {
  const app=createApp(file);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  app.url='http://127.0.0.1:'+app.server.address().port;
  app.stop=async()=>{await new Promise(resolve=>app.server.close(resolve));app.store.close();};
  app.request=async(route,method='GET',body)=>{
    const res=await fetch(app.url+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:res.status,body:res.status===204?null:await res.json()};
  };
  return app;
}
test('CRUD and audit history survive a fresh server/database connection',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synapse-p3-'));
  const file=path.join(dir,'test.sqlite');
  let app=await start(file);
  try {
    const created=await app.request('/api/tasks','POST',sample);
    assert.equal(created.status,201);
    const route='/api/tasks/'+created.body.data.id;
    assert.equal((await app.request(route,'PATCH',{status:'in-progress'})).body.data.status,'in-progress');
    await app.stop(); app=await start(file);
    assert.equal((await app.request(route)).body.data.status,'in-progress');
    assert.equal((await app.request('/api/tasks?search=durable')).body.data.length,1);
    assert.equal((await app.request(route,'PUT',{...sample,title:'Replacement title',status:'completed'})).body.data.title,'Replacement title');
    assert.equal((await app.request(route,'DELETE')).status,204);
    await app.stop(); app=await start(file);
    assert.equal((await app.request(route)).status,404);
    assert.deepEqual((await app.request('/api/activity')).body.data.map(x=>x.action),['deleted','updated','updated','created']);
    assert.equal((await app.request('/api/stats')).body.data.total,0);
  } finally {await app.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
test('validation, malformed JSON, body size and method handling',async()=>{
  const app=await start(':memory:');
  try {
    for(const body of [null,[],{},42,{...sample,title:'x'},{...sample,status:'bad'},{...sample,owner:null},{...sample,id:'override'}]) assert.equal((await app.request('/api/tasks','POST',body)).status,400);
    const raw=(body,type='application/json')=>fetch(app.url+'/api/tasks',{method:'POST',headers:{'Content-Type':type},body});
    assert.equal((await raw('{')).status,400);
    assert.equal((await raw('{}','text/plain')).status,415);
    assert.equal((await raw(JSON.stringify({...sample,title:'x'.repeat(40000)}))).status,413);
    assert.equal((await app.request('/api/tasks','DELETE')).status,405);
    assert.equal((await app.request('/api/tasks?status=bad')).status,400);
    assert.equal((await app.request('/api/tasks')).body.data.length,0);
  } finally {await app.stop();}
});
test('SQL injection is stored as text; constraints, foreign keys and atomic audit writes enforced',async()=>{
  const app=await start(':memory:');
  try {
    const title="Robert'); DROP TABLE tasks; --";
    const created=await app.request('/api/tasks','POST',{...sample,title});
    assert.equal(created.status,201);
    assert.equal((await app.request('/api/tasks?search='+encodeURIComponent(title))).body.data[0].title,title);
    assert.equal((await app.request('/api/tasks?search=%25')).body.data.length,0);
    const db=app.store.db;
    assert.throws(()=>db.prepare('UPDATE tasks SET owner_id=999 WHERE id=?').run(created.body.data.id),/FOREIGN KEY/);
    assert.throws(()=>db.prepare("UPDATE tasks SET status='invalid'").run(),/CHECK/);
    assert.throws(()=>db.prepare('INSERT INTO owners(name) VALUES (?)').run(sample.owner.toLowerCase()),/UNIQUE/);
    db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'test rollback'); END");
    assert.equal((await app.request('/api/tasks','POST',{...sample,owner:'Rollback Owner'})).status,500);
    assert.equal((await app.request('/api/tasks')).body.data.length,1);
    assert.equal(db.prepare("SELECT count(*) n FROM owners WHERE name='Rollback Owner'").get().n,0);
  } finally {await app.stop();}
});

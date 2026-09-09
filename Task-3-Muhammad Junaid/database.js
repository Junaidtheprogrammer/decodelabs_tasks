'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function openStore(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const select = `SELECT t.id,t.title,o.name AS owner,t.status,t.priority,t.category,
    t.created_at AS createdAt,t.updated_at AS updatedAt FROM tasks t JOIN owners o ON o.id=t.owner_id`;
  const get = id => db.prepare(select + ' WHERE t.id=?').get(id);
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function ownerId(name) {
    db.prepare('INSERT OR IGNORE INTO owners(name) VALUES (?)').run(name);
    return db.prepare('SELECT id FROM owners WHERE name=? COLLATE NOCASE').get(name).id;
  }
  function log(id, action, title) {
    db.prepare('INSERT INTO activity(task_id,action,title,created_at) VALUES (?,?,?,?)').run(id, action, title, new Date().toISOString());
  }
  return {
    db, close: () => db.close(), get,
    list({status='', priority='', search=''} = {}) {
      const pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%';
      return db.prepare(select + ` WHERE (?='' OR t.status=?) AND (?='' OR t.priority=?)
        AND (t.title LIKE ? ESCAPE '\\' OR o.name LIKE ? ESCAPE '\\' OR t.category LIKE ? ESCAPE '\\')
        ORDER BY t.created_at DESC,t.id`).all(status,status,priority,priority,pattern,pattern,pattern);
    },
    create(input) {
      return transaction(() => {
        const id = 'sig-' + randomUUID();
        const now = new Date().toISOString();
        db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?)').run(id,input.title,ownerId(input.owner),input.status,input.priority,input.category,now,now);
        log(id,'created',input.title);
        return get(id);
      });
    },
    update(id, input) {
      return transaction(() => {
        if (!get(id)) return undefined;
        db.prepare('UPDATE tasks SET title=?,owner_id=?,status=?,priority=?,category=?,updated_at=? WHERE id=?').run(input.title,ownerId(input.owner),input.status,input.priority,input.category,new Date().toISOString(),id);
        log(id,'updated',input.title);
        return get(id);
      });
    },
    remove(id) {
      return transaction(() => {
        const task = get(id);
        if (!task) return false;
        db.prepare('DELETE FROM tasks WHERE id=?').run(id);
        log(id,'deleted',task.title);
        return true;
      });
    },
    activity: () => db.prepare('SELECT id,task_id AS taskId,action,title,created_at AS createdAt FROM activity ORDER BY id DESC LIMIT 20').all(),
    stats() {
      const row = db.prepare("SELECT count(*) total, coalesce(sum(status='completed'),0) completed, coalesce(sum(status='in-progress'),0) active FROM tasks").get();
      return {...row, completionRate: row.total ? Math.round(row.completed/row.total*100) : 0,
        owners: db.prepare('SELECT count(*) count FROM owners').get().count,
        writes: db.prepare('SELECT count(*) count FROM activity').get().count};
    }
  };
}
module.exports = { openStore };

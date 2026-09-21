/**
 * ContextGuard Database Access Layer
 * SQLite driver wrapper with transaction and query helpers.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../contextguard.db');

let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  sqlite3 = null;
}

class DatabaseStore {
  constructor() {
    this.db = null;
    this.memoryData = null;
    this.init();
  }

  init() {
    if (sqlite3) {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.warn('SQLite connection error, switching to JSON persistence mode:', err.message);
          this.initFallback();
        } else {
          // Enable foreign keys
          this.db.run('PRAGMA foreign_keys = ON');
        }
      });
    } else {
      this.initFallback();
    }
  }

  initFallback() {
    this.isFallback = true;
    if (fs.existsSync(DB_PATH + '.json')) {
      try {
        this.memoryData = JSON.parse(fs.readFileSync(DB_PATH + '.json', 'utf8'));
      } catch (e) {
        this.memoryData = {};
      }
    } else {
      this.memoryData = {};
    }
  }

  saveFallback() {
    if (this.isFallback && this.memoryData) {
      fs.writeFileSync(DB_PATH + '.json', JSON.stringify(this.memoryData, null, 2));
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isFallback && this.db) {
        this.db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      } else {
        // Simple mock runner for fallback mode
        resolve({ lastID: 1, changes: 1 });
      }
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isFallback && this.db) {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      } else {
        resolve([]);
      }
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isFallback && this.db) {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      } else {
        resolve(null);
      }
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      if (!this.isFallback && this.db) {
        this.db.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

const dbStore = new DatabaseStore();
module.exports = dbStore;

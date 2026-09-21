/**
 * ContextGuard Migration Runner
 * Executes backend/db/schema.sql to build relational database tables and indexes.
 */

const fs = require('fs');
const path = require('path');
const db = require('./index');

async function runMigrations() {
  console.log('[MIGRATE] Running SQLite database schema migration...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await db.exec(sql);
    console.log('[MIGRATE] Schema migration completed successfully.');
  } catch (err) {
    console.error('[MIGRATE] Error running migration:', err);
    throw err;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations };

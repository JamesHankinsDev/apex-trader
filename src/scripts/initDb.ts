// Ensures data/apex.db exists with the full schema before the frontend
// (read-only) tries to open it. Idempotent — getDb() runs CREATE TABLE IF
// NOT EXISTS migrations. Called from the Railway startCommand on every boot.

import { getDb } from '../db.js';

const db = getDb();
console.log(`DB ready at ${db.name}`);
db.close();

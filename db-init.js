const db = require("./db");

async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      coins BIGINT NOT NULL DEFAULT 0,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      completed_tasks JSONB NOT NULL DEFAULT '[]',
      rewards JSONB NOT NULL DEFAULT '[]',
      last_bonus DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_bonus DATE
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS coin_history (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT,
      amount BIGINT NOT NULL,
      old_coins BIGINT,
      new_coins BIGINT,
      type TEXT,
      task_id TEXT,
      referred_user TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("DATABASE TABLES READY");
}

initDatabase()
  .catch(err => {
    console.error("DATABASE INIT ERROR:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.end();
  });

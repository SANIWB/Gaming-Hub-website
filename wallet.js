const db = require("./db");

async function addDailyBonus(email) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (!result.rows.length) {
    return { ok: false, message: "User not found." };
  }

  const user = result.rows[0];
  const today = new Date().toISOString().slice(0, 10);

  if (user.last_bonus && String(user.last_bonus).slice(0, 10) === today) {
    return {
      ok: false,
      message: "Daily bonus already claimed today.",
      coins: Number(user.coins)
    };
  }

  const oldCoins = Number(user.coins || 0);
  const newCoins = oldCoins + 50;

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE users
       SET coins = $1, last_bonus = $2
       WHERE email = $3`,
      [newCoins, today, email]
    );

    await client.query(
      `INSERT INTO coin_history
       (email, username, amount, old_coins, new_coins, type)
       VALUES ($1, $2, 50, $3, $4, 'daily-bonus')`,
      [user.email, user.username, oldCoins, newCoins]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      message: "🎁 Daily bonus claimed! +50 coins",
      coins: newCoins
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Daily bonus error:", error);

    return {
      ok: false,
      message: "Server error."
    };
  } finally {
    client.release();
  }
}

async function getWallet(email) {
  const result = await db.query(
    `SELECT username, email, coins, last_bonus
     FROM users
     WHERE email = $1`,
    [email]
  );

  if (!result.rows.length) return null;

  const user = result.rows[0];

  return {
    username: user.username,
    email: user.email,
    coins: Number(user.coins || 0),
    lastBonus: user.last_bonus
      ? String(user.last_bonus).slice(0, 10)
      : null
  };
}

module.exports = {
  addDailyBonus,
  getWallet
};

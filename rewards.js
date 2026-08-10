const db = require("./db");

const rewards = [
  { id: "bronze", name: "🥉 Bronze Reward", cost: 500 },
  { id: "silver", name: "🥈 Silver Reward", cost: 1000 },
  { id: "gold", name: "🥇 Gold Reward", cost: 2500 }
];

function getRewards() {
  return rewards;
}

async function redeemReward(email, rewardId) {
  const reward = rewards.find(r => r.id === rewardId);

  if (!reward) {
    return { ok: false, message: "Reward not found." };
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      "SELECT * FROM users WHERE email = $1 FOR UPDATE",
      [email]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, message: "User not found." };
    }

    const user = result.rows[0];
    const coins = Number(user.coins || 0);

    if (coins < reward.cost) {
      await client.query("ROLLBACK");

      return {
        ok: false,
        message: "Not enough coins.",
        coins
      };
    }

    const oldCoins = coins;
    const newCoins = coins - reward.cost;

    const userRewards = Array.isArray(user.rewards)
      ? user.rewards
      : [];

    userRewards.push({
      id: reward.id,
      name: reward.name,
      redeemedAt: new Date().toISOString()
    });

    await client.query(
      `UPDATE users
       SET coins = $1,
           rewards = $2
       WHERE email = $3`,
      [newCoins, JSON.stringify(userRewards), email]
    );

    await client.query(
      `INSERT INTO coin_history
       (email, username, amount, old_coins, new_coins, type)
       VALUES ($1, $2, $3, $4, $5, 'reward-redemption')`,
      [
        user.email,
        user.username,
        -reward.cost,
        oldCoins,
        newCoins
      ]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      message: `${reward.name} redeemed successfully!`,
      coins: newCoins
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reward redemption error:", error);

    return {
      ok: false,
      message: "Server error."
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getRewards,
  redeemReward
};

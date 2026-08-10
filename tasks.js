const db = require("./db");

const tasks = [
  {
    id: "daily-play",
    name: "🎮 Play Gaming Hub",
    description: "Visit the Gaming Hub today.",
    reward: 100
  },
  {
    id: "daily-reward",
    name: "🏆 Check Rewards",
    description: "Open the Rewards Shop.",
    reward: 100
  },
  {
    id: "daily-profile",
    name: "👤 Check Profile",
    description: "Check your Gaming Hub profile.",
    reward: 100
  },
  {
    id: "daily-login",
    name: "🔑 Daily Login",
    description: "Log in to Gaming Hub today.",
    reward: 50
  }
];

function getTasks() {
  return tasks;
}

async function completeTask(email, taskId) {
  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return { ok: false, message: "Task not found." };
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
    const completedTasks = Array.isArray(user.completed_tasks)
      ? user.completed_tasks
      : [];

    if (completedTasks.includes(task.id)) {
      await client.query("ROLLBACK");

      return {
        ok: false,
        message: "Task already completed today.",
        coins: Number(user.coins || 0)
      };
    }

    const oldCoins = Number(user.coins || 0);
    const newCoins = oldCoins + task.reward;

    completedTasks.push(task.id);

    await client.query(
      `UPDATE users
       SET coins = $1,
           completed_tasks = $2
       WHERE email = $3`,
      [newCoins, JSON.stringify(completedTasks), email]
    );

    await client.query(
      `INSERT INTO coin_history
       (email, username, amount, old_coins, new_coins, type, task_id)
       VALUES ($1, $2, $3, $4, $5, 'task-completion', $6)`,
      [
        user.email,
        user.username,
        task.reward,
        oldCoins,
        newCoins,
        task.id
      ]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      message: `Task completed! +${task.reward} coins`,
      coins: newCoins
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Task completion error:", error);

    return {
      ok: false,
      message: "Server error."
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getTasks,
  completeTask
};

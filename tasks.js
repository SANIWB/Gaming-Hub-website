const fs = require("fs");

const FILE = "./users.json";

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

function getUsers() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

function getTasks() {
  return tasks;
}

function completeTask(email, taskId) {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  const task = tasks.find(t => t.id === taskId);

  if (!user) return { ok: false, message: "User not found." };
  if (!task) return { ok: false, message: "Task not found." };

  if (!user.coins) user.coins = 100;
  if (!user.completedTasks) user.completedTasks = [];

  if (user.completedTasks.includes(task.id)) {
    return {
      ok: false,
      message: "Task already completed today.",
      coins: user.coins
    };
  }

  user.coins += task.reward;
  user.completedTasks.push(task.id);

  saveUsers(users);

  return {
    ok: true,
    message: `Task completed! +${task.reward} coins`,
    coins: user.coins
  };
}

module.exports = { getTasks, completeTask };

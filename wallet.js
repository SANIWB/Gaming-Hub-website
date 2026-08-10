const fs = require("fs");

const FILE = "./users.json";

function getUsers() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

function addDailyBonus(email) {
  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return { ok: false, message: "User not found." };
  }

  if (!user.coins) user.coins = 100;

  const today = new Date().toISOString().slice(0, 10);

  if (user.lastBonus === today) {
    return {
      ok: false,
      message: "Daily bonus already claimed today.",
      coins: user.coins
    };
  }

  const oldCoins = user.coins;
  user.coins += 50;
  user.lastBonus = today;

  const historyFile = "./coin-history.json";
  let history = [];
  if (fs.existsSync(historyFile)) { try { history = JSON.parse(fs.readFileSync(historyFile, "utf8")); } catch(e) { history = []; } }
  history.push({email:user.email,username:user.username,amount:50,oldCoins,newCoins:user.coins,type:"daily-bonus",time:new Date().toISOString()});
  fs.writeFileSync(historyFile, JSON.stringify(history,null,2));

  saveUsers(users);

  return {
    ok: true,
    message: "🎁 Daily bonus claimed! +50 coins",
    coins: user.coins
  };
}

function getWallet(email) {
  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) return null;

  if (!user.coins) user.coins = 100;

  saveUsers(users);

  return {
    username: user.username,
    email: user.email,
    coins: user.coins,
    lastBonus: user.lastBonus || null
  };
}

module.exports = { addDailyBonus, getWallet };

const fs = require("fs");

const FILE = "./users.json";

const rewards = [
  { id: "bronze", name: "🥉 Bronze Reward", cost: 500 },
  { id: "silver", name: "🥈 Silver Reward", cost: 1000 },
  { id: "gold", name: "🥇 Gold Reward", cost: 2500 }
];

function getUsers() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

function getRewards() {
  return rewards;
}

function redeemReward(email, rewardId) {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  const reward = rewards.find(r => r.id === rewardId);

  if (!user) {
    return { ok: false, message: "User not found." };
  }

  if (!reward) {
    return { ok: false, message: "Reward not found." };
  }

  if (!user.coins) user.coins = 100;

  if (user.coins < reward.cost) {
    return {
      ok: false,
      message: "Not enough coins.",
      coins: user.coins
    };
  }

  const oldCoins = user.coins;
  user.coins -= reward.cost;

  if (!user.rewards) user.rewards = [];

  const historyFile = "./coin-history.json";
  let history = [];
  if (fs.existsSync(historyFile)) { try { history = JSON.parse(fs.readFileSync(historyFile, "utf8")); } catch(e) { history = []; } }
  history.push({email:user.email,username:user.username,amount:-reward.cost,oldCoins,newCoins:user.coins,type:"reward-redemption",rewardId:reward.id,rewardName:reward.name,time:new Date().toISOString()});
  fs.writeFileSync(historyFile, JSON.stringify(history,null,2));

  user.rewards.push({
    id: reward.id,
    name: reward.name,
    redeemedAt: new Date().toISOString()
  });

  saveUsers(users);

  return {
    ok: true,
    message: `${reward.name} redeemed successfully!`,
    coins: user.coins
  };
}

module.exports = { getRewards, redeemReward };

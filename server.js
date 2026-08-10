const fs = require("fs");
const express = require("express");
const db = require("./db");
const { getTasks, completeTask } = require("./tasks");
const { getRewards, redeemReward } = require("./rewards");
const { addDailyBonus, getWallet } = require("./wallet");
const { signup, login, generateOTP, verifyOTP } = require("./auth");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/profile", (req, res) => {
  res.sendFile(__dirname + "/public/profile.html");
});
app.post("/api/send-otp",async(req,res)=>{try{const result=await generateOTP(req.body.email);res.status(result.ok?200:400).json(result);}catch(e){console.error(e);res.status(500).json({ok:false,message:"Email sending failed."});}});
app.post("/api/verify-otp",(req,res)=>{try{const result=verifyOTP(req.body.email,req.body.otp);res.status(result.ok?200:400).json(result);}catch(e){res.status(500).json({ok:false,message:"Server error."});}});
app.get("/tasks", (req, res) => {
  res.sendFile(__dirname + "/public/tasks.html");
});
app.get("/my-rewards", (req, res) => {
  res.sendFile(__dirname + "/public/my-rewards.html");
});
app.get("/rewards", (req, res) => {
  res.sendFile(__dirname + "/public/rewards.html");
});
app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.get("/signup", (req, res) => {
  res.sendFile(__dirname + "/public/signup.html");
});

app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        ok: false,
        message: "All fields are required."
      });
    }

    const result = await signup(username, email, password, referralCode);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Server error."
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Email and password are required."
      });
    }

    const result = await login(email, password);
    res.status(result.ok ? 200 : 401).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Server error."
    });
  }
});

app.get("/api/wallet/:email", async (req, res) => {
  try {
    const wallet = await getWallet(req.params.email);
    if (!wallet) return res.status(404).json({ ok: false, message: "User not found." });
    res.json({ ok: true, wallet });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});
app.get("/api/coin-history/:email", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, username, amount, old_coins, new_coins, type, task_id, referred_user, created_at
       FROM coin_history
       WHERE email = $1
       ORDER BY created_at DESC`,
      [req.params.email]
    );

    res.json({ ok: true, history: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/history", (req, res) => {
  res.sendFile(__dirname + "/public/history.html");
});

app.get("/api/my-rewards/:email", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT rewards FROM users WHERE email = $1",
      [req.params.email]
    );

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, message: "User not found." });
    }

    res.json({
      ok: true,
      rewards: result.rows[0].rewards || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/profile/:email", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT username, email, coins, referral_code, referred_by,
              completed_tasks, rewards
       FROM users
       WHERE email = $1`,
      [req.params.email]
    );

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, message: "User not found." });
    }

    const user = result.rows[0];

    res.json({
      ok: true,
      user: {
        username: user.username,
        email: user.email,
        coins: Number(user.coins || 0),
        referralCode: user.referral_code || null,
        referredBy: user.referred_by || null,
        completedTasks: Array.isArray(user.completed_tasks)
          ? user.completed_tasks.length
          : 0,
        redeemedRewards: Array.isArray(user.rewards)
          ? user.rewards.length
          : 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/tasks", (req, res) => {
  res.json({ ok: true, tasks: getTasks() });
});

app.post("/api/complete-task", async (req, res) => {
  try {
    const result = await completeTask(req.body.email, req.body.taskId);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/rewards", (req, res) => {
  res.json({ ok: true, rewards: getRewards() });
});

app.post("/api/redeem", async (req, res) => {
  try {
    const result = await redeemReward(req.body.email, req.body.rewardId);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

const crypto = require("crypto");
const ADMIN_TOKEN = crypto.randomBytes(32).toString("hex");

app.post("/api/admin/login", (req, res) => {
  if (req.body.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      message: "Wrong admin password."
    });
  }

  res.json({ ok: true, token: ADMIN_TOKEN });
});

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({
      ok: false,
      message: "Admin login required."
    });
  }

  next();
}

app.post("/api/admin/coins", requireAdmin, async (req, res) => {
  const email = req.body.email;
  const amount = Number(req.body.amount);

  if (!email || !Number.isInteger(amount) || amount === 0) {
    return res.status(400).json({
      ok: false,
      message: "Invalid email or amount."
    });
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
      return res.status(404).json({
        ok: false,
        message: "User not found."
      });
    }

    const user = result.rows[0];
    const oldCoins = Number(user.coins || 0);
    const newCoins = Math.max(0, oldCoins + amount);

    await client.query(
      "UPDATE users SET coins = $1 WHERE email = $2",
      [newCoins, email]
    );

    await client.query(
      `INSERT INTO coin_history
       (email, username, amount, old_coins, new_coins, type)
       VALUES ($1, $2, $3, $4, $5, 'admin-adjustment')`,
      [user.email, user.username, newCoins - oldCoins, oldCoins, newCoins]
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      coins: newCoins,
      message: amount > 0 ? "Coins added." : "Coins removed."
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Server error."
    });
  } finally {
    client.release();
  }
});

app.get("/api/admin/coin-history", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, username, amount, old_coins, new_coins,
              type, task_id, referred_user, created_at
       FROM coin_history
       ORDER BY created_at DESC`
    );

    res.json({ ok: true, logs: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/admin/summary", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COALESCE(SUM(coins), 0) FROM users) AS total_coins,
        (SELECT COALESCE(SUM(amount), 0)
           FROM coin_history
          WHERE amount > 0
            AND created_at::date = CURRENT_DATE) AS added_today,
        (SELECT COALESCE(SUM(ABS(amount)), 0)
           FROM coin_history
          WHERE amount < 0
            AND created_at::date = CURRENT_DATE) AS removed_today,
        (SELECT COUNT(*) FROM coin_history) AS total_changes`
    );

    const row = result.rows[0];

    res.json({
      ok: true,
      totalUsers: Number(row.total_users),
      totalCoins: Number(row.total_coins),
      addedToday: Number(row.added_today),
      removedToday: Number(row.removed_today),
      totalChanges: Number(row.total_changes)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT username, email, coins FROM users ORDER BY created_at DESC"
    );

    res.json({
      ok: true,
      users: result.rows.map(user => ({
        username: user.username,
        email: user.email,
        coins: Number(user.coins || 0)
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/public/admin.html");
});

app.get("/admin-login", (req, res) => {
  res.sendFile(__dirname + "/public/admin-login.html");
});

app.get("/coin-history", (req, res) => {
  res.sendFile(__dirname + "/public/coin-history.html");
});

app.get("/api/admin/user-details", requireAdmin, async (req, res) => {
  const email = req.query.email;

  if (!email) {
    return res.status(400).json({
      ok: false,
      message: "Email required."
    });
  }

  try {
    const userResult = await db.query(
      `SELECT username, email, coins, completed_tasks, rewards
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({
        ok: false,
        message: "User not found."
      });
    }

    const user = userResult.rows[0];

    const historyResult = await db.query(
      `SELECT id, email, username, amount, old_coins, new_coins,
              type, task_id, referred_user, created_at
       FROM coin_history
       WHERE email = $1
       ORDER BY created_at DESC`,
      [email]
    );

    res.json({
      ok: true,
      user: {
        username: user.username,
        email: user.email,
        coins: Number(user.coins || 0),
        completedTasks: user.completed_tasks || [],
        rewards: user.rewards || [],
        coinHistory: historyResult.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      message: "Server error."
    });
  }
});

app.get("/user-details",(req,res)=>{res.sendFile(__dirname+"/public/user-details.html");});
app.listen(PORT,"0.0.0.0",()=>{console.log("Gaming website running on port 3000");});

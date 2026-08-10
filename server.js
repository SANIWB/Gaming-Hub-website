const fs = require("fs");
const express = require("express");
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

app.get("/api/wallet/:email", (req, res) => {
  const wallet = getWallet(req.params.email);
  if (!wallet) return res.status(404).json({ ok: false, message: "User not found." });
  res.json({ ok: true, wallet });
});
app.get("/api/coin-history/:email",(req,res)=>{const email=req.params.email;const f="./coin-history.json";const logs=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):[];res.json({ok:true,history:logs.filter(x=>x.email===email).reverse()});});
app.get("/history",(req,res)=>{res.sendFile(__dirname+"/public/history.html");});

app.post("/api/daily-bonus", (req, res) => {
  const result = addDailyBonus(req.body.email);
  res.status(result.ok ? 200 : 400).json(result);
});

app.get("/api/my-rewards/:email", (req, res) => {
  const users = JSON.parse(require("fs").readFileSync("./users.json", "utf8"));
  const user = users.find(u => u.email === req.params.email);
  if (!user) return res.status(404).json({ ok: false, message: "User not found." });
  res.json({ ok: true, rewards: user.rewards || [] });
});

app.get("/api/profile/:email", (req, res) => {
  const fs = require("fs");
  const users = JSON.parse(fs.readFileSync("./users.json", "utf8"));
  const user = users.find(u => u.email === req.params.email);
  if (!user) return res.status(404).json({ ok: false, message: "User not found." });
  res.json({
    ok: true,
    user: {
      username: user.username,
      email: user.email,
      coins: user.coins || 0,
      referralCode: user.referralCode || null,
      referredBy: user.referredBy || null,
      completedTasks: (user.completedTasks || []).length,
      redeemedRewards: (user.rewards || []).length
    }
  });
});

app.get("/api/tasks", (req, res) => {
  res.json({ ok: true, tasks: getTasks() });
});

app.post("/api/complete-task", (req, res) => {
  const result = completeTask(req.body.email, req.body.taskId);
  res.status(result.ok ? 200 : 400).json(result);
});

app.get("/api/rewards", (req, res) => {
  res.json({ ok: true, rewards: getRewards() });
});

app.post("/api/redeem", (req, res) => {
  const result = redeemReward(req.body.email, req.body.rewardId);
  res.status(result.ok ? 200 : 400).json(result);
});

const crypto = require("crypto");
const ADMIN_TOKEN = crypto.randomBytes(32).toString("hex");

app.post("/api/admin/login",(req,res)=>{
  if(req.body.password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ok:false,message:"Wrong admin password."});
  res.json({ok:true,token:ADMIN_TOKEN});
});

function requireAdmin(req,res,next){
  const token=req.headers["x-admin-token"];
  if(token !== ADMIN_TOKEN)
    return res.status(401).json({ok:false,message:"Admin login required."});
  next();
}

app.post("/api/admin/coins",requireAdmin,(req,res)=>{const email=req.body.email;const amount=Number(req.body.amount);if(!email||!Number.isInteger(amount)||amount===0)return res.status(400).json({ok:false,message:"Invalid email or amount."});const users=JSON.parse(fs.readFileSync("./users.json","utf8"));const user=users.find(u=>u.email===email);if(!user)return res.status(404).json({ok:false,message:"User not found."});const oldCoins=user.coins||0;user.coins=Math.max(0,oldCoins+amount);fs.writeFileSync("./users.json",JSON.stringify(users,null,2));const logFile="./coin-history.json";let logs=[];if(fs.existsSync(logFile)){try{logs=JSON.parse(fs.readFileSync(logFile,"utf8"));}catch(e){logs=[];}}logs.push({email:user.email,username:user.username,amount,oldCoins,newCoins:user.coins,time:new Date().toISOString()});fs.writeFileSync(logFile,JSON.stringify(logs,null,2));res.json({ok:true,coins:user.coins,message:amount>0?"Coins added.":"Coins removed."});});

app.get("/api/admin/coin-history",requireAdmin,(req,res)=>{const f="./coin-history.json";const logs=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):[];res.json({ok:true,logs:logs.slice().reverse()});});

app.get("/api/admin/summary",requireAdmin,(req,res)=>{const users=JSON.parse(fs.readFileSync("./users.json","utf8"));const f="./coin-history.json";const logs=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):[];const today=new Date().toISOString().slice(0,10);const todayLogs=logs.filter(x=>x.time&&x.time.slice(0,10)===today);const added=todayLogs.filter(x=>x.amount>0).reduce((a,x)=>a+x.amount,0);const removed=todayLogs.filter(x=>x.amount<0).reduce((a,x)=>a+Math.abs(x.amount),0);res.json({ok:true,totalUsers:users.length,totalCoins:users.reduce((a,u)=>a+(u.coins||0),0),addedToday:added,removedToday:removed,totalChanges:logs.length});});

app.get("/api/admin/users", requireAdmin,(req,res)=>{const users=JSON.parse(fs.readFileSync("./users.json","utf8"));res.json({ok:true,users:users.map(u=>({username:u.username,email:u.email,coins:u.coins||0}))});});

app.get("/admin",(req,res)=>{res.sendFile(__dirname+"/public/admin.html");});
app.get("/admin-login",(req,res)=>{res.sendFile(__dirname+"/public/admin-login.html");});
app.get("/coin-history",(req,res)=>{res.sendFile(__dirname+"/public/coin-history.html");});
app.get("/api/admin/user-details",requireAdmin,(req,res)=>{const email=req.query.email;if(!email)return res.status(400).json({ok:false,message:"Email required."});const users=JSON.parse(fs.readFileSync("./users.json","utf8"));const user=users.find(u=>u.email===email);if(!user)return res.status(404).json({ok:false,message:"User not found."});const f="./coin-history.json";const logs=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):[];res.json({ok:true,user:{username:user.username,email:user.email,coins:user.coins||0,completedTasks:user.completedTasks||[],rewards:user.rewards||[],coinHistory:logs.filter(x=>x.email===email).reverse()}});});

app.get("/user-details",(req,res)=>{res.sendFile(__dirname+"/public/user-details.html");});
app.post("/api/tasks/complete",async(req,res)=>{try{const email=req.body.email;const taskId=req.body.taskId;if(!email||!taskId)return res.status(400).json({ok:false,message:"Missing task information."});const users=JSON.parse(fs.readFileSync("./users.json","utf8"));const user=users.find(u=>u.email===email);if(!user)return res.status(404).json({ok:false,message:"User not found."});if(!user.completedTasks)user.completedTasks=[];if(user.completedTasks.includes(taskId))return res.status(400).json({ok:false,message:"Task already completed."});const rewards={"daily-gaming":10,"daily-bonus":5};const reward=rewards[taskId];if(!reward)return res.status(400).json({ok:false,message:"Invalid task."});const oldCoins=user.coins||0;user.coins=oldCoins+reward;user.completedTasks.push(taskId);fs.writeFileSync("./users.json",JSON.stringify(users,null,2));const historyFile="./coin-history.json";let history=[];if(fs.existsSync(historyFile)){try{history=JSON.parse(fs.readFileSync(historyFile,"utf8"));}catch(e){history=[];}}history.push({email:user.email,username:user.username,amount:reward,oldCoins,newCoins:user.coins,type:"task-completion",taskId,time:new Date().toISOString()});fs.writeFileSync(historyFile,JSON.stringify(history,null,2));res.json({ok:true,coins:user.coins,reward});}catch(e){res.status(500).json({ok:false,message:"Server error."});}});
app.listen(PORT,"0.0.0.0",()=>{console.log("Gaming website running on port 3000");});

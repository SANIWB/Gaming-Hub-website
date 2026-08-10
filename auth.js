const nodemailer = require("nodemailer");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const FILE = "./users.json";

function getUsers() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

async function signup(username, email, password, referralCode="") {
  const users = getUsers();

  if (users.some(u => u.email === email)) {
    return { ok: false, message: "Email already registered." };
  }

  let referrer = null;

  if (referralCode && referralCode.trim()) {
    referrer = users.find(
      u => u.referralCode &&
      u.referralCode.toUpperCase() === referralCode.trim().toUpperCase()
    );

    if (!referrer) {
      return { ok:false, message:"Invalid referral code." };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newId = Date.now();
  const ownReferralCode = "GH" + newId.toString(36).toUpperCase();

  const newUser = {
    id: newId,
    username,
    email,
    passwordHash,
    coins: 0,
    referralCode: ownReferralCode,
    referredBy: referrer ? referrer.email : null,
    completedTasks: [],
    rewards: []
  };

  users.push(newUser);

  if (referrer) {
    const oldCoins = referrer.coins || 0;
    referrer.coins = oldCoins + 50;

    const historyFile = "./coin-history.json";
    let history = [];

    if (fs.existsSync(historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
      } catch(e) {
        history = [];
      }
    }

    history.push({
      email: referrer.email,
      username: referrer.username,
      amount: 50,
      oldCoins,
      newCoins: referrer.coins,
      type: "referral-bonus",
      referredUser: email,
      time: new Date().toISOString()
    });

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  }

  saveUsers(users);

  return {
    ok: true,
    message: referrer
      ? "Account created successfully. Referral bonus +50 coins added."
      : "Account created successfully.",
    referralCode: ownReferralCode
  };
}
async function login(email, password) {
  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return { ok: false, message: "Invalid email or password." };
  }

  const match = await bcrypt.compare(password, user.passwordHash);

  if (!match) {
    return { ok: false, message: "Invalid email or password." };
  }

  return {
    ok: true,
    message: "Login successful.",
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  };
}

const otpStore = new Map();

async function generateOTP(email) {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  if (!user) return { ok:false, message:"Email not registered." };

  const otp = String(Math.floor(100000 + Math.random()*900000));
  otpStore.set(email, { otp, expires: Date.now()+5*60*1000 });

  const transporter = nodemailer.createTransport({service:"gmail",auth:{user:process.env.OTP_EMAIL,pass:process.env.OTP_APP_PASSWORD}}); await transporter.sendMail({from:process.env.OTP_EMAIL,to:email,subject:"Gaming Hub OTP",text:"Your Gaming Hub OTP is: "+otp+"\n\nThis OTP expires in 5 minutes."});
  return { ok:true, message:"OTP generated successfully." };
}

function verifyOTP(email, otp) {
  const data = otpStore.get(email);
  if (!data) return { ok:false, message:"OTP not found or expired." };
  if (Date.now() > data.expires) {
    otpStore.delete(email);
    return { ok:false, message:"OTP expired." };
  }
  if (String(otp) !== data.otp) return { ok:false, message:"Invalid OTP." };

  otpStore.delete(email);
  const user = getUsers().find(u => u.email === email);

  return {
    ok:true,
    message:"OTP verified successfully.",
    user:{id:user.id,username:user.username,email:user.email}
  };
}

module.exports = { signup, login, generateOTP, verifyOTP };

const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const db = require("./db");

async function signup(username, email, password, referralCode = "") {
  const existing = await db.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length) {
    return { ok: false, message: "Email already registered." };
  }

  let referrer = null;

  if (referralCode && referralCode.trim()) {
    const result = await db.query(
      "SELECT * FROM users WHERE UPPER(referral_code) = UPPER($1)",
      [referralCode.trim()]
    );

    if (!result.rows.length) {
      return { ok: false, message: "Invalid referral code." };
    }

    referrer = result.rows[0];
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newId = Date.now();
  const ownReferralCode =
    "GH" + newId.toString(36).toUpperCase();

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO users
      (id, username, email, password_hash, coins, referral_code,
       referred_by, completed_tasks, rewards)
      VALUES ($1,$2,$3,$4,0,$5,$6,'[]'::jsonb,'[]'::jsonb)`,
      [
        newId,
        username,
        email,
        passwordHash,
        ownReferralCode,
        referrer ? referrer.email : null
      ]
    );

    if (referrer) {
      const oldCoins = Number(referrer.coins || 0);
      const newCoins = oldCoins + 50;

      await client.query(
        "UPDATE users SET coins = $1 WHERE id = $2",
        [newCoins, referrer.id]
      );

      await client.query(
        `INSERT INTO coin_history
        (email, username, amount, old_coins, new_coins,
         type, referred_user)
        VALUES ($1,$2,50,$3,$4,'referral-bonus',$5)`,
        [
          referrer.email,
          referrer.username,
          oldCoins,
          newCoins,
          email
        ]
      );
    }

    await client.query("COMMIT");

    return {
      ok: true,
      message: referrer
        ? "Account created successfully. Referral bonus +50 coins added."
        : "Account created successfully.",
      referralCode: ownReferralCode
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Signup error:", error);
    return { ok: false, message: "Server error." };
  } finally {
    client.release();
  }
}

async function login(email, password) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (!result.rows.length) {
    return { ok: false, message: "Invalid email or password." };
  }

  const user = result.rows[0];

  const match = await bcrypt.compare(
    password,
    user.password_hash
  );

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
  const result = await db.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (!result.rows.length) {
    return { ok: false, message: "Email not registered." };
  }

  const otp = String(
    Math.floor(100000 + Math.random() * 900000)
  );

  otpStore.set(email, {
    otp,
    expires: Date.now() + 5 * 60 * 1000
  });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.OTP_EMAIL,
      pass: process.env.OTP_APP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: process.env.OTP_EMAIL,
    to: email,
    subject: "Gaming Hub OTP",
    text:
      "Your Gaming Hub OTP is: " +
      otp +
      "\n\nThis OTP expires in 5 minutes."
  });

  return {
    ok: true,
    message: "OTP generated successfully."
  };
}

async function verifyOTP(email, otp) {
  const data = otpStore.get(email);

  if (!data) {
    return {
      ok: false,
      message: "OTP not found or expired."
    };
  }

  if (Date.now() > data.expires) {
    otpStore.delete(email);
    return {
      ok: false,
      message: "OTP expired."
    };
  }

  if (String(otp) !== data.otp) {
    return {
      ok: false,
      message: "Invalid OTP."
    };
  }

  otpStore.delete(email);

  const result = await db.query(
    "SELECT id, username, email FROM users WHERE email = $1",
    [email]
  );

  if (!result.rows.length) {
    return {
      ok: false,
      message: "User not found."
    };
  }

  const user = result.rows[0];

  return {
    ok: true,
    message: "OTP verified successfully.",
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  };
}

module.exports = {
  signup,
  login,
  generateOTP,
  verifyOTP
};

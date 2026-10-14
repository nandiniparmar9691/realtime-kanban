import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { TOKEN_COOKIE } from "../middleware/authMiddleware.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/",
  };
}

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export const register = async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    if (name.length > 80) {
      return res.status(400).json({ message: "Name is too long" });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }

    // Role is always assigned on the server and never taken from the client.
    const user = await User.create({ name, email, password, role: "user" });

    const token = signToken(user);
    res.cookie(TOKEN_COOKIE, token, cookieOptions());

    return res.status(201).json({ user: user.toPublicJSON() });
  } catch (error) {
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);
    res.cookie(TOKEN_COOKIE, token, cookieOptions());

    return res.json({ user: user.toPublicJSON() });
  } catch (error) {
    return next(error);
  }
};

export const me = async (req, res) => {
  return res.json({ user: req.user.toPublicJSON() });
};

export const logout = async (req, res) => {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(TOKEN_COOKIE, options);
  return res.json({ message: "Logged out successfully" });
};

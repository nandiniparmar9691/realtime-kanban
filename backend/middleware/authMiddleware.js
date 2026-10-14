import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const TOKEN_COOKIE = "token";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[TOKEN_COOKIE];

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      res.clearCookie(TOKEN_COOKIE, { path: "/" });
      return res.status(401).json({ message: "Session expired, please log in again" });
    }

    const user = await User.findById(payload.sub);

    if (!user) {
      res.clearCookie(TOKEN_COOKIE, { path: "/" });
      return res.status(401).json({ message: "Authentication required" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

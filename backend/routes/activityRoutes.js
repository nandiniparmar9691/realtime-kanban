import express from "express";
import { getRecentActivity } from "../controllers/activityController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.get("/recent", getRecentActivity);

export default router;

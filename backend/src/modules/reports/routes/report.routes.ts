import { Router } from "express";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { getReportHandler } from "../controllers/report.controller.js";

const router = Router();

router.get("/", authenticate, getReportHandler);

export default router;

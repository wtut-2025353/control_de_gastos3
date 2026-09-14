import { Router } from "express";
import { authenticate } from "../../../middleware/auth.middleware.js";
import {
  createIncomeHandler,
  getIncomesHandler,
  getTotalIncomeHandler,
  getMonthlyIncomeHandler,
  deleteIncomeHandler,
  updateIncomeHandler
} from "../controllers/income.controller.js";

const router = Router();

router.post("/", authenticate, createIncomeHandler);
router.get("/", authenticate, getIncomesHandler);
router.get("/total", authenticate, getTotalIncomeHandler);
router.get("/monthly", authenticate, getMonthlyIncomeHandler);
router.put("/:id", authenticate, updateIncomeHandler);
router.delete("/:id", authenticate, deleteIncomeHandler);

export default router;

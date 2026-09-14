import type { Request, Response } from "express";
import {
  createOrUpdateBudget,
  getBudgetsByUserAndPeriod,
  getTotalBudgetByUserAndPeriod
} from "../services/budget.service.js";

export async function createBudgetHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const budget = await createOrUpdateBudget(req.user.id, req.body);
    res.status(201).json(budget);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear presupuesto";
    res.status(400).json({ message });
  }
}

export async function getBudgetsHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const budgets = await getBudgetsByUserAndPeriod(req.user.id, month, year);
  res.json(budgets);
}

export async function getTotalBudgetHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const total = await getTotalBudgetByUserAndPeriod(req.user.id, month, year);
  res.json({ total });
}

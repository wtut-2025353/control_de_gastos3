import type { Request, Response } from "express";
import {
  createIncome,
  getIncomesByUser,
  getTotalIncomeByUser,
  getMonthlyIncomeTotals,
  deleteIncome,
  updateIncome
} from "../services/income.service.js";

export async function createIncomeHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const income = await createIncome(req.user.id, req.body);
    res.status(201).json(income);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear ingreso";
    res.status(400).json({ message });
  }
}

export async function getIncomesHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  const incomes = await getIncomesByUser(req.user.id);
  res.json(incomes);
}

export async function getTotalIncomeHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  const total = await getTotalIncomeByUser(req.user.id);
  res.json({ total });
}

export async function getMonthlyIncomeHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  const months = Number(req.query.months) || 6;
  const totals = await getMonthlyIncomeTotals(req.user.id, months);
  res.json(totals);
}

export async function deleteIncomeHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const deleted = await deleteIncome(req.user.id, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ message: "Ingreso no encontrado" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar ingreso";
    res.status(400).json({ message });
  }
}

export async function updateIncomeHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const updated = await updateIncome(req.user.id, String(req.params.id), req.body);
    if (!updated) {
      res.status(404).json({ message: "Ingreso no encontrado" });
      return;
    }
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar ingreso";
    res.status(400).json({ message });
  }
}

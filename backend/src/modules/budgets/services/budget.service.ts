import { Types } from "mongoose";
import { Budget } from "../models/budget.model.js";
import { validateAmount } from "../../expenses/services/expense.service.js";

export interface CreateBudgetData {
  category: string;
  amount: number;
  month: number;
  year: number;
}

function validateBudgetMonth(month: number, year: number): void {
  if (!Number.isFinite(month) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("El mes debe ser un número entero entre 1 y 12");
  }
  if (!Number.isFinite(year) || !Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new Error("El año debe ser un número entero válido");
  }
}

export async function createOrUpdateBudget(userId: string, data: CreateBudgetData) {
  validateAmount(data.amount);
  validateBudgetMonth(data.month, data.year);
  return Budget.findOneAndUpdate(
    { user: new Types.ObjectId(userId), category: data.category as any, month: data.month, year: data.year },
    { amount: data.amount },
    { upsert: true, new: true }
  );
}

export async function getBudgetsByUserAndPeriod(userId: string, month: number, year: number) {
  return Budget.find({ user: new Types.ObjectId(userId), month, year }).lean();
}

export async function getTotalBudgetByUserAndPeriod(userId: string, month: number, year: number) {
  const result = await Budget.aggregate([
    { $match: { user: new Types.ObjectId(userId), month, year } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  return result[0]?.total ?? 0;
}

import { Types } from "mongoose";
import { Income } from "../models/income.model.js";
import { validateAmount, validateDate } from "../../expenses/services/expense.service.js";

function round15(n: number): number {
  return Math.round(n * 1e15) / 1e15;
}

export interface CreateIncomeData {
  description: string;
  amount: number;
  category: string;
  date?: Date | string;
}

export async function createIncome(userId: string, data: CreateIncomeData) {
  validateAmount(data.amount);
  const date = validateDate(data.date);
  return Income.create({ user: new Types.ObjectId(userId), ...data, date, category: data.category as any });
}

export async function getIncomesByUser(userId: string) {
  return Income.find({ user: new Types.ObjectId(userId) }).sort({ date: -1 }).lean();
}

export async function getTotalIncomeByUser(userId: string) {
  const result = await Income.aggregate([
    { $match: { user: new Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  return round15(result[0]?.total ?? 0);
}

export async function deleteIncome(userId: string, incomeId: string) {
  return Income.findOneAndDelete({ _id: incomeId, user: new Types.ObjectId(userId) });
}

export async function getMonthlyIncomeTotals(userId: string, months: number) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setHours(0, 0, 0, 0);

  const result = await Income.aggregate([
    { $match: { user: new Types.ObjectId(userId), date: { $gte: startDate } } },
    {
      $group: {
        _id: { month: { $month: "$date" }, year: { $year: "$date" } },
        total: { $sum: "$amount" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  return result.map((r) => ({
    month: r._id.month,
    year: r._id.year,
    total: round15(r.total)
  }));
}

export async function updateIncome(userId: string, incomeId: string, data: Partial<CreateIncomeData>) {
  if (data.amount !== undefined) validateAmount(data.amount);
  if (data.date !== undefined) validateDate(data.date);
  return Income.findOneAndUpdate(
    { _id: incomeId, user: new Types.ObjectId(userId) },
    { ...data, category: data.category as any },
    { new: true, runValidators: true }
  );
}

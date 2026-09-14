import { Types } from "mongoose";
import { Expense } from "../models/expense.model.js";
import { Income } from "../../incomes/models/income.model.js";

export interface CreateExpenseData {
  description: string;
  amount: number;
  category: string;
  date?: Date | string;
}

function round15(n: number): number {
  return Math.round(n * 1e15) / 1e15;
}

const MAX_AMOUNT = 999999999.999999999999999;

async function getAvailableBalance(userId: string): Promise<number> {
  const [incomeResult, expenseResult] = await Promise.all([
    Income.aggregate([
      { $match: { user: new Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: { user: new Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);
  const totalIncome = round15(incomeResult[0]?.total ?? 0);
  const totalExpenses = round15(expenseResult[0]?.total ?? 0);
  return round15(totalIncome - totalExpenses);
}

async function checkBalanceForExpense(userId: string, amount: number, excludeExpenseId?: string): Promise<void> {
  const [incomeResult, expenseResult] = await Promise.all([
    Income.aggregate([
      { $match: { user: new Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: { user: new Types.ObjectId(userId), ...(excludeExpenseId ? { _id: { $ne: new Types.ObjectId(excludeExpenseId) } } : {}) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);
  const totalIncome = round15(incomeResult[0]?.total ?? 0);
  const totalExpenses = round15(expenseResult[0]?.total ?? 0);
  const available = round15(totalIncome - totalExpenses);
  if (round15(available - amount) < 0) {
    throw new Error(`Saldo insuficiente. Disponible: Q${available.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 15 })}, gasto: Q${amount.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 15 })}`);
  }
}

export function validateAmount(amount: unknown): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error("El monto debe ser un número válido");
  }
  if (amount <= 0) {
    throw new Error("El monto debe ser un número positivo");
  }
  if (amount > MAX_AMOUNT) {
    throw new Error(`El monto no puede exceder Q${MAX_AMOUNT.toLocaleString("es-GT")}`);
  }
  const rounded = round15(amount);
  if (rounded !== amount) {
    throw new Error("El monto no puede tener más de 15 decimales");
  }
  return rounded;
}

function startOfLocalDay(date?: Date): Date {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function validateDate(date: Date | string | undefined): Date {
  let d: Date;
  if (date === undefined || date === null || date === "") {
    d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (typeof date === "string") {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new Error("La fecha proporcionada no es válida");
    }
    d = parsed;
  } else {
    d = new Date(date);
  }
  const todayStart = startOfLocalDay();
  const dateStart = startOfLocalDay(d);
  if (dateStart.getTime() > todayStart.getTime()) {
    throw new Error("La fecha no puede ser futura");
  }
  return dateStart;
}

export async function createExpense(userId: string, data: CreateExpenseData) {
  const amount = validateAmount(data.amount);
  const date = validateDate(data.date);
  await checkBalanceForExpense(userId, amount);
  return Expense.create({ user: new Types.ObjectId(userId), ...data, date, category: data.category as any });
}

export async function getExpensesByUser(userId: string) {
  return Expense.find({ user: new Types.ObjectId(userId) }).sort({ date: -1 }).lean();
}

export async function getTotalExpenseByUser(userId: string) {
  const result = await Expense.aggregate([
    { $match: { user: new Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  return round15(result[0]?.total ?? 0);
}

export async function getMonthlyExpenseTotals(userId: string, months: number) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setHours(0, 0, 0, 0);

  const result = await Expense.aggregate([
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

export async function getExpensesByCategory(userId: string) {
  const result = await Expense.aggregate([
    { $match: { user: new Types.ObjectId(userId) } },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$amount" }
      }
    },
    { $sort: { total: -1 } }
  ]);

  const grandTotal = result.reduce((sum, r) => sum + r.total, 0);

  return result.map((r) => ({
    category: r._id,
    total: round15(r.total),
    percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0
  }));
}

export async function deleteExpense(userId: string, expenseId: string) {
  return Expense.findOneAndDelete({ _id: expenseId, user: new Types.ObjectId(userId) });
}

export async function updateExpense(userId: string, expenseId: string, data: Partial<CreateExpenseData>) {
  if (data.amount !== undefined) validateAmount(data.amount);
  if (data.date !== undefined) validateDate(data.date);
  const newAmount = data.amount !== undefined ? validateAmount(data.amount) : undefined;
  if (newAmount !== undefined) {
    await checkBalanceForExpense(userId, newAmount, expenseId);
  }
  return Expense.findOneAndUpdate(
    { _id: expenseId, user: new Types.ObjectId(userId) },
    { ...data, category: data.category as any },
    { new: true, runValidators: true }
  );
}

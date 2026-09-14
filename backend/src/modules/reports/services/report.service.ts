import { Types } from "mongoose";
import { Income } from "../../incomes/models/income.model.js";
import { Expense } from "../../expenses/models/expense.model.js";

export interface ReportFilters {
  from?: string;
  to?: string;
  type?: string;
  category?: string;
  search?: string;
}

export interface ReportMovement {
  _id: string;
  type: "ingreso" | "gasto";
  description: string;
  amount: number;
  category: string;
  date: Date;
}

function round15(n: number): number {
  return Math.round(n * 1e15) / 1e15;
}

function buildDateRange(from?: string, to?: string) {
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      range.$gte = d;
    }
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      range.$lte = d;
    }
  }
  return range;
}

export async function getReport(userId: string, filters: ReportFilters) {
  const userObjectId = new Types.ObjectId(userId);
  const type = (filters.type ?? "todos").toLowerCase();
  const includeIncomes = type === "todos" || type === "ingreso" || type === "ingresos";
  const includeExpenses = type === "todos" || type === "gasto" || type === "gastos" || type === "egreso" || type === "egresos";

  const dateRange = buildDateRange(filters.from, filters.to);
  const hasDate = Object.keys(dateRange).length > 0;
  const search = filters.search?.trim();
  const category = filters.category?.trim();

  const incomeQuery: Record<string, unknown> = { user: userObjectId };
  const expenseQuery: Record<string, unknown> = { user: userObjectId };

  if (hasDate) {
    incomeQuery.date = dateRange;
    expenseQuery.date = dateRange;
  }
  if (search) {
    const regex = { $regex: search, $options: "i" };
    incomeQuery.description = regex;
    expenseQuery.description = regex;
  }
  if (category && category !== "todas") {
    incomeQuery.category = category;
    expenseQuery.category = category;
  }

  const [incomes, expenses] = await Promise.all([
    includeIncomes ? Income.find(incomeQuery).sort({ date: -1 }).lean() : Promise.resolve([]),
    includeExpenses ? Expense.find(expenseQuery).sort({ date: -1 }).lean() : Promise.resolve([])
  ]);

  const movements: ReportMovement[] = [
    ...incomes.map((i: any) => ({
      _id: String(i._id),
      type: "ingreso" as const,
      description: i.description,
      amount: round15(Number(i.amount)),
      category: i.category,
      date: i.date
    })),
    ...expenses.map((e: any) => ({
      _id: String(e._id),
      type: "gasto" as const,
      description: e.description,
      amount: round15(Number(e.amount)),
      category: e.category,
      date: e.date
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalIncome = round15(incomes.reduce((acc: number, i: any) => acc + Number(i.amount), 0));
  const totalExpenses = round15(expenses.reduce((acc: number, e: any) => acc + Number(e.amount), 0));

  // Agrupado mensual combinado
  const monthlyMap = new Map<string, { month: number; year: number; income: number; expense: number }>();
  for (const m of movements) {
    const d = new Date(m.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const entry = monthlyMap.get(key) ?? { month: d.getMonth() + 1, year: d.getFullYear(), income: 0, expense: 0 };
    if (m.type === "ingreso") entry.income += m.amount;
    else entry.expense += m.amount;
    monthlyMap.set(key, entry);
  }
  const monthly = Array.from(monthlyMap.values())
    .map((m) => ({ ...m, income: round15(m.income), expense: round15(m.expense) }))
    .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);

  // Por categoría separado
  function groupByCategory(list: Array<{ category: string; amount: number }>) {
    const map = new Map<string, number>();
    for (const item of list) {
      map.set(item.category, (map.get(item.category) ?? 0) + Number(item.amount));
    }
    const grand = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([categoryName, total]) => ({
        category: categoryName,
        total: round15(total),
        percentage: grand > 0 ? Math.round((total / grand) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }

  return {
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      balance: round15(totalIncome - totalExpenses),
      count: movements.length
    },
    monthly,
    incomeByCategory: groupByCategory(incomes.map((i: any) => ({ category: i.category, amount: Number(i.amount) }))),
    expenseByCategory: groupByCategory(expenses.map((e: any) => ({ category: e.category, amount: Number(e.amount) }))),
    movements: movements.slice(0, 500)
  };
}

import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/routes/auth.routes.js";
import userRoutes from "./modules/users/routes/user.routes.js";
import incomeRoutes from "./modules/incomes/routes/income.routes.js";
import expenseRoutes from "./modules/expenses/routes/expense.routes.js";
import budgetRoutes from "./modules/budgets/routes/budget.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import reportRoutes from "./modules/reports/routes/report.routes.js";
import { env } from "./config/env.js";

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req, res) => {
    res.json({ message: "API control_de_gastos funcionando" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/incomes", incomeRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reports", reportRoutes);

  app.use((_req, res) => {
    res.status(404).json({ message: "Ruta no encontrada" });
  });

  return app;
}
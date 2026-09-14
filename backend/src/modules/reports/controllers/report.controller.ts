import type { Request, Response } from "express";
import { getReport } from "../services/report.service.js";

export async function getReportHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const data = await getReport(req.user.id, {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      type: typeof req.query.type === "string" ? req.query.type : "todos",
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined
    });
    res.json(data);
  } catch {
    res.status(400).json({ message: "Error al generar reporte" });
  }
}

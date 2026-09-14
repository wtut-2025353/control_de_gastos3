import type { NextFunction, Request, Response } from "express";

export function authorizeAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ message: "Se requiere rol de administrador" });
    return;
  }
  next();
}

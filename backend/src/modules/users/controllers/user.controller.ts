import type { Request, Response } from "express";
import { findUserById, listUsers, updateUserProfile, changeUserPassword, changeUserRole } from "../services/user.service.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  const user = await findUserById(req.user.id);
  if (!user) {
    res.status(404).json({ message: "Usuario no encontrado" });
    return;
  }
  res.json(user);
}

export async function getAllUsers(req: Request, res: Response): Promise<void> {
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await listUsers({ search, page, limit });
  res.json(result);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const updated = await updateUserProfile(req.user.id, {
      name: typeof req.body?.name === "string" ? req.body.name : undefined,
      avatar: req.body?.avatar !== undefined ? req.body.avatar : undefined
    });
    if (!updated) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar perfil";
    res.status(400).json({ message });
  }
}

export async function changeMyPassword(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  const result = await changeUserPassword(
    req.user.id,
    String(req.body?.currentPassword ?? ""),
    String(req.body?.newPassword ?? "")
  );
  if (!result.ok) {
    res.status(400).json({ message: result.message });
    return;
  }
  res.json({ message: result.message });
}

export async function changeRole(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const result = await changeUserRole(req.user.id, String(req.params.id), String(req.body?.role ?? ""));
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.json({ message: result.message, user: result.user });
  } catch {
    res.status(400).json({ message: "Error al cambiar rol" });
  }
}
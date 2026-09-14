import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  googleId?: string | null;
}

function toPublic(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  googleId?: string | null;
}): PublicUser {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, avatar: user.avatar, googleId: user.googleId ?? null };
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const user = await User.findById(id);
  return user ? toPublic(user) : null;
}

export async function listUsers(filters?: { search?: string; page?: number; limit?: number }): Promise<{ users: PublicUser[]; total: number; page: number; limit: number; totalPages: number }> {
  const search = filters?.search?.trim() ?? "";
  const page = Math.max(1, filters?.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters?.limit ?? 10));
  const query: Record<string, unknown> = {};
  if (search) {
    const regex = { $regex: search, $options: "i" };
    query.$or = [{ name: regex }, { email: regex }];
  }
  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(query)
  ]);
  return {
    users: users.map(toPublic),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

export async function updateUserProfile(id: string, data: { name?: string; avatar?: string | null }): Promise<PublicUser | null> {
  const existing = await User.findById(id);
  if (!existing) return null;
  const update: Record<string, unknown> = {};
  if (typeof data.name === "string" && data.name.trim().length >= 2) {
    update.name = data.name.trim();
  }
  if (data.avatar !== undefined) {
    if (existing.googleId) {
      throw new Error("No puedes cambiar la foto de perfil de una cuenta de Google");
    }
    if (data.avatar === null || data.avatar === "") {
      update.avatar = null;
    } else if (typeof data.avatar === "string") {
      const v = data.avatar.trim();
      const isDataUrl = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(v);
      const isHttpUrl = /^https?:\/\/.+/i.test(v);
      if (!isDataUrl && !isHttpUrl) {
        throw new Error("Formato de imagen no válido");
      }
      if (v.length > 500000) {
        throw new Error("La imagen es muy pesada (máx ~350KB). Usa una más pequeña");
      }
      update.avatar = v;
    }
  }
  const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  return user ? toPublic(user) : null;
}

export async function changeUserPassword(id: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, message: "La nueva contraseña debe tener al menos 6 caracteres" };
  }
  const user = await User.findById(id).select("+password");
  if (!user) return { ok: false, message: "Usuario no encontrado" };
  if (user.password) {
    const valid = await bcrypt.compare(currentPassword ?? "", user.password);
    if (!valid) return { ok: false, message: "La contraseña actual es incorrecta" };
  }
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  return { ok: true, message: "Contraseña actualizada correctamente" };
}

export async function changeUserRole(
  adminId: string,
  targetId: string,
  newRole: string
): Promise<{ ok: boolean; status: number; message: string; user?: PublicUser }> {
  const role = String(newRole ?? "").trim().toLowerCase();
  if (role !== "admin" && role !== "user") {
    return { ok: false, status: 400, message: "Rol inválido. Use admin o user" };
  }
  if (!targetId || !/^[a-fA-F0-9]{24}$/.test(targetId)) {
    return { ok: false, status: 400, message: "ID de usuario inválido" };
  }
  if (adminId === targetId) {
    return { ok: false, status: 400, message: "No puedes cambiar tu propio rol" };
  }
  const target = await User.findById(targetId);
  if (!target) {
    return { ok: false, status: 404, message: "Usuario no encontrado" };
  }
  if (target.role === role) {
    return { ok: true, status: 200, message: `El usuario ya tiene rol ${role}`, user: toPublic(target) };
  }
  // Evitar dejar el sistema sin administradores
  if (target.role === "admin" && role === "user") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return { ok: false, status: 400, message: "No se puede quitar al último administrador" };
    }
  }
  target.role = role as "admin" | "user";
  await target.save();
  return { ok: true, status: 200, message: `Rol actualizado a ${role}. Se aplicará cuando el usuario vuelva a iniciar sesión`, user: toPublic(target) };
}
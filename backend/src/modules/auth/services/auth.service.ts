import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User } from "../../users/models/user.model.js";
import { env } from "../../../config/env.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  googleId?: string | null;
}

export interface AuthResult {
  token: string;
  user: AuthUserPayload;
}

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function signToken(user: AuthUserPayload): string {
  return jwt.sign(
    { id: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

function toPayload(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  googleId?: string | null;
}): AuthUserPayload {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, avatar: user.avatar ?? null, googleId: user.googleId ?? null };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
  if (!user) {
    throw new AuthError("Credenciales inválidas", 401);
  }
  const valid = await bcrypt.compare(password, user.password ?? "");
  if (!valid) {
    throw new AuthError("Credenciales inválidas", 401);
  }
  const payload = toPayload(user);
  return { token: signToken(payload), user: payload };
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResult> {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedName.length < 2) {
    throw new AuthError("El nombre debe tener al menos 2 caracteres");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new AuthError("El correo no es válido");
  }
  if (!password || password.length < 6) {
    throw new AuthError("La contraseña debe tener al menos 6 caracteres");
  }
  const exists = await User.findOne({ email: trimmedEmail });
  if (exists) {
    throw new AuthError("Ya existe una cuenta con ese correo");
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: trimmedName,
    email: trimmedEmail,
    password: hashed,
    role: "user"
  });
  const payload = toPayload(user);
  return { token: signToken(payload), user: payload };
}

export async function loginWithGoogle(credential: string): Promise<AuthResult> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AuthError("El login con Google no está configurado en el servidor", 500);
  }
  let payload: { sub?: string; email?: string; name?: string; picture?: string };
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID
    });
    payload = ticket.getPayload() ?? {};
  } catch {
    throw new AuthError("Token de Google inválido", 401);
  }

  const email = payload.email?.toLowerCase();
  if (!email) {
    throw new AuthError("El token de Google no incluye un correo válido", 401);
  }

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: payload.name ?? "Usuario de Google",
      email,
      googleId: payload.sub,
      avatar: payload.picture,
      role: "user"
    });
  } else {
    let changed = false;
    if (!user.googleId && payload.sub) {
      user.googleId = payload.sub;
      changed = true;
    }
    // Sincronizar siempre la foto de Google para que el perfil la muestre actualizada
    if (payload.picture && user.avatar !== payload.picture) {
      user.avatar = payload.picture;
      changed = true;
    }
    if (changed) await user.save();
  }

  const result = toPayload(user);
  return { token: signToken(result), user: result };
}

export async function refresh_token(userId: string): Promise<AuthResult> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AuthError("Usuario no encontrado", 404);
  }
  const payload = toPayload(user);
  return { token: signToken(payload), user: payload };
}
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  googleId?: string | null;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = '/api/auth';
  private readonly tokenKey = 'token';
  private readonly userKey = 'user';

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${this.api}/login`, { email, password });
  }

  register(name: string, email: string, password: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${this.api}/register`, { name, email, password });
  }

  loginWithGoogle(credential: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${this.api}/google`, { credential });
  }

  saveSession(result: AuthResult): void {
    localStorage.setItem(this.tokenKey, result.token);
    localStorage.setItem(this.userKey, JSON.stringify(result.user));
  }

  getStoredUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.userKey);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  refreshToken(): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${this.api}/refresh`, {});
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getExpiryMs(token: string): number {
    const exp = this.getExp(token);
    if (exp === null) return 0;
    const remaining = exp * 1000 - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  isExpired(token: string): boolean {
    return this.getExpiryMs(token) <= 0;
  }

  private getExp(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(atob(normalized));
      return typeof json.exp === 'number' ? json.exp : null;
    } catch {
      return null;
    }
  }
}
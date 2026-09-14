import { Injectable, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 30 * 1000;

@Injectable({ providedIn: 'root' })
export class IdleService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private isRunning = false;

  private readonly events = [
    'mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'
  ];

  private handleActivity = (): void => {
    this.resetIdleTimer();
  };

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.events.forEach((event) =>
      document.addEventListener(event, this.handleActivity, { passive: true })
    );
    this.scheduleRefresh();
    this.resetIdleTimer();
  }

  stop(): void {
    this.isRunning = false;
    this.events.forEach((event) =>
      document.removeEventListener(event, this.handleActivity)
    );
    this.clearTimers();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.onIdle(), IDLE_TIMEOUT_MS);
  }

  private onIdle(): void {
    this.stop();
    this.authService.logout();
    const existing = document.getElementById('session-expired-modal');
    if (!existing) {
      const overlay = document.createElement('div');
      overlay.id = 'session-expired-modal';
      overlay.innerHTML = `
        <div style="
          position:fixed;inset:0;background:rgba(0,0,0,0.45);
          display:flex;align-items:center;justify-content:center;z-index:9999;
          font-family:'Inter',system-ui,-apple-system,sans-serif;
          animation: fadeIn 0.2s ease;
        ">
          <div style="
            background:#ffffff;border-radius:12px;padding:2.25rem 2rem 1.75rem;
            max-width:380px;width:90%;text-align:center;
            box-shadow:0 8px 32px rgba(0,0,0,0.18);
            animation: slideUp 0.25s ease;
          ">
            <div style="
              width:56px;height:56px;border-radius:50%;
              background:#fef3f3;display:flex;align-items:center;justify-content:center;
              margin:0 auto 1.25rem;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                fill="none" stroke="#b00020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 style="
              font-size:1.1rem;font-weight:700;color:#1c2b3a;margin:0 0 0.5rem;
            ">Sesion expirada</h3>
            <p style="
              font-size:0.88rem;color:#7b8a8d;margin:0 0 1.5rem;line-height:1.5;
            ">Su tiempo de sesion ha finalizado. Por favor, vuelva a iniciar sesion para continuar.</p>
            <button id="session-expired-btn" style="
              width:100%;padding:0.75rem;font-size:0.95rem;font-weight:600;
              font-family:inherit;color:#ffffff;background:#345852;border:none;
              border-radius:8px;cursor:pointer;transition:opacity 0.15s ease;
            ">Entendido</button>
          </div>
        </div>
      `;
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        #session-expired-btn:hover { opacity: 0.88; }
      `;
      document.head.appendChild(style);
      document.body.appendChild(overlay);
      document.getElementById('session-expired-btn')?.addEventListener('click', () => {
        overlay.remove();
        style.remove();
        this.router.navigate(['/']);
      });
    } else {
      this.router.navigate(['/']);
    }
  }

  private scheduleRefresh(): void {
    this.refreshTimer = setInterval(() => this.tryRefresh(), REFRESH_THRESHOLD_MS);
  }

  private async tryRefresh(): Promise<void> {
    const token = this.authService.getToken();
    if (!token) return;

    const remaining = this.authService.getExpiryMs(token);
    if (remaining <= REFRESH_THRESHOLD_MS) {
      this.authService.refreshToken().subscribe({
        next: (result) => this.authService.saveSession(result),
        error: () => {
          this.stop();
          this.authService.logout();
          this.onIdle();
        }
      });
    }
  }

  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}

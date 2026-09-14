import {
  Component,
  ElementRef,
  type AfterViewInit,
  type OnInit,
  type OnDestroy,
  viewChild,
  inject,
  signal,
  effect
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, type AuthResult } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface GoogleAccounts {
  accounts?: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      }) => void;
      renderButton: (container: HTMLElement, options: object) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  email = '';
  password = '';
  showPassword = signal(false);
  loading = signal(false);
  errorMessage = signal('');
  loggedIn = signal(false);
  role = signal('');
  googleReady = signal(false);

  readonly hasGoogle = !!environment.googleClientId;

  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly googleButton = viewChild<ElementRef<HTMLDivElement>>('googleButton');
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly googleEffect = effect(() => {
    const showForm = !this.loggedIn();
    const container = this.googleButton();
    const ready = this.googleReady();
    if (showForm && ready && container) {
      this.renderGoogleButton();
    }
  });

  ngOnDestroy(): void {
    this.clearExpiry();
  }

  ngOnInit(): void {
    const expired = localStorage.getItem('session_expired');
    if (expired) {
      localStorage.removeItem('session_expired');
      this.errorMessage.set('Su sesion ha expirado. Vuelva a iniciar sesion.');
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    if (this.authService.isExpired(token)) {
      this.onSessionExpired();
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  ngAfterViewInit(): void {
    if (environment.googleClientId) {
      this.loadGoogleScript()
        .then(() => this.googleReady.set(true))
        .catch(() => {
          this.errorMessage.set('No se pudo cargar el botón de Google');
        });
    }
  }

  private setSession(result: AuthResult): void {
    this.authService.saveSession(result);
    this.loading.set(false);
    this.router.navigate(['/dashboard']);
  }

  handleLogin(): void {
    this.errorMessage.set('');
    if (!this.email.trim() || !this.password) {
      this.errorMessage.set('Ingrese su correo y contrasena');
      return;
    }
    this.loading.set(true);
    this.authService.login(this.email.trim(), this.password).subscribe({
      next: (result) => this.setSession(result),
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(error?.error?.message ?? 'Error al iniciar sesión');
      }
    });
  }

  handleLogout(): void {
    this.clearExpiry();
    this.authService.logout();
    this.loggedIn.set(false);
    this.loading.set(false);
    this.password = '';
  }

  goRegister(): void {
    this.router.navigate(['/register']);
  }

  private readonly handleGoogleResponse = (response: { credential?: string }): void => {
    if (!response.credential) {
      this.errorMessage.set('No se recibió la credencial de Google');
      return;
    }
    this.loading.set(true);
    this.authService.loginWithGoogle(response.credential).subscribe({
      next: (result) => this.setSession(result),
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(error?.error?.message ?? 'Error al iniciar sesión con Google');
      }
    });
  };

  private scheduleExpiry(token: string): void {
    this.clearExpiry();
    const ms = this.authService.getExpiryMs(token);
    if (ms <= 0) {
      this.onSessionExpired();
      return;
    }
    this.expiryTimer = setTimeout(() => this.onSessionExpired(), ms);
  }

  private clearExpiry(): void {
    if (this.expiryTimer !== undefined) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
  }

  private onSessionExpired(): void {
    this.clearExpiry();
    this.authService.logout();
    this.loggedIn.set(false);
    this.loading.set(false);
    this.errorMessage.set('Su sesion ha expirado. Vuelva a iniciar sesion.');
  }

  private renderGoogleButton(): void {
    const container = this.googleButton()?.nativeElement;
    const google = window.google;
    if (!container || !google?.accounts) {
      return;
    }
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: this.handleGoogleResponse
    });
    container.innerHTML = '';
    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      text: 'signin',
      shape: 'rectangular',
      width: 400
    });
  }

  private loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) {
        resolve();
        return;
      }
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-google-gis="true"]'
      );
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error('Error al cargar el script de Google'))
        );
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset['googleGis'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Error al cargar el script de Google'));
      document.head.appendChild(script);
    });
  }
}
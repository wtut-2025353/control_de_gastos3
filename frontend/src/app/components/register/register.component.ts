import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, type AuthResult } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = signal(false);
  loading = signal(false);
  errorMessage = signal('');

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    const token = localStorage.getItem('token');
    if (token && !this.authService.isExpired(token)) {
      this.router.navigate(['/dashboard']);
    }
  }

  handleRegister(): void {
    this.errorMessage.set('');
    if (!this.name.trim() || this.name.trim().length < 2) {
      this.errorMessage.set('El nombre debe tener al menos 2 caracteres');
      return;
    }
    if (!this.email.trim()) {
      this.errorMessage.set('Ingrese su correo electronico');
      return;
    }
    if (!this.password || this.password.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }
    this.loading.set(true);
    this.authService.register(this.name.trim(), this.email.trim(), this.password).subscribe({
      next: (result) => {
        this.authService.saveSession(result);
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(error?.error?.message ?? 'Error al crear la cuenta');
      }
    });
  }
}

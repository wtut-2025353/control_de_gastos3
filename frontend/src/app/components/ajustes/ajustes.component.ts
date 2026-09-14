import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService, type AuthUser } from '../../services/auth.service';
import { IdleService } from '../../services/idle.service';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.css'
})
export class AjustesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly idleService = inject(IdleService);

  mobileMenuOpen = signal(false);
  loadingProfile = signal(false);
  loadingPassword = signal(false);
  profileSuccess = signal('');
  profileError = signal('');
  passwordSuccess = signal('');
  passwordError = signal('');

  user = signal<AuthUser | null>(null);
  isGoogleUser = computed(() => !!this.user()?.googleId);
  name = '';
  sessionInfo = signal('');
  avatarPreview = signal<string | null>(null);
  savingAvatar = signal(false);
  private pendingAvatar: string | null | undefined = undefined;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  // ---- Panel admin ----
  showAdmin = signal(false);
  isAdmin = computed(() => this.user()?.role === 'admin');
  adminSearch = '';
  adminUsers = signal<AdminUser[]>([]);
  adminTotal = signal(0);
  adminPage = signal(1);
  adminTotalPages = signal(1);
  readonly adminLimit = 10;
  adminLoading = signal(false);
  adminError = signal('');
  adminSuccess = signal('');
  changingRoleId = signal<string | null>(null);

  ngOnInit(): void {
    const stored = this.authService.getStoredUser();
    if (stored) {
      this.user.set(stored);
      this.name = stored.name;
      if (stored.role === 'admin') this.loadAdminUsers();
    }
    this.loadMe();
    const token = this.authService.getToken();
    if (token) {
      const ms = this.authService.getExpiryMs(token);
      const min = Math.max(0, Math.round(ms / 60000));
      this.sessionInfo.set(min > 0 ? `Tu sesión vence en aproximadamente ${min} minutos.` : 'Tu sesión está por vencer.');
    }
    this.idleService.start();
  }

  ngOnDestroy(): void {
    this.idleService.stop();
  }

  loadMe(): void {
    this.http.get<AuthUser>('/api/users/me').subscribe({
      next: (me) => {
        this.user.set(me);
        this.name = me.name;
        const stored = this.authService.getStoredUser();
        if (stored) {
          localStorage.setItem('user', JSON.stringify({ ...stored, name: me.name, avatar: me.avatar, role: me.role }));
        }
        if (me.role === 'admin' && this.adminUsers().length === 0) this.loadAdminUsers();
      },
      error: () => {}
    });
  }

  saveProfile(): void {
    this.profileError.set('');
    this.profileSuccess.set('');
    if (!this.name.trim() || this.name.trim().length < 2) {
      this.profileError.set('El nombre debe tener al menos 2 caracteres');
      return;
    }
    this.loadingProfile.set(true);
    this.http.put<AuthUser>('/api/users/me', { name: this.name.trim() }).subscribe({
      next: (updated) => {
        this.user.set(updated);
        const stored = this.authService.getStoredUser();
        if (stored) {
          localStorage.setItem('user', JSON.stringify({ ...stored, name: updated.name, avatar: updated.avatar }));
        }
        this.profileSuccess.set('Perfil actualizado correctamente');
        this.loadingProfile.set(false);
        setTimeout(() => this.profileSuccess.set(''), 3000);
      },
      error: (error) => {
        this.loadingProfile.set(false);
        this.profileError.set(error?.error?.message ?? 'Error al actualizar perfil');
      }
    });
  }

  changePassword(): void {
    this.passwordError.set('');
    this.passwordSuccess.set('');
    if (!this.newPassword || this.newPassword.length < 6) {
      this.passwordError.set('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError.set('La confirmación no coincide');
      return;
    }
    this.loadingPassword.set(true);
    this.http.put<{ message: string }>('/api/users/me/password', {
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: (res) => {
        this.passwordSuccess.set(res.message ?? 'Contraseña actualizada correctamente');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.loadingPassword.set(false);
        setTimeout(() => this.passwordSuccess.set(''), 3000);
      },
      error: (error) => {
        this.loadingPassword.set(false);
        this.passwordError.set(error?.error?.message ?? 'Error al cambiar contraseña');
      }
    });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.idleService.stop();
    this.authService.logout();
    this.router.navigate(['/']);
  }

  goDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goIngresos(): void {
    this.router.navigate(['/ingresos']);
  }

  goGastos(): void {
    this.router.navigate(['/gastos']);
  }

  goReportes(): void {
    this.router.navigate(['/reportes']);
  }

  getInitial(): string {
    return (this.user()?.name ?? 'U').charAt(0).toUpperCase();
  }

  onAvatarFile(event: Event): void {
    this.profileError.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.profileError.set('El archivo debe ser una imagen');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.profileError.set('La imagen no debe pesar más de 5MB');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        this.pendingAvatar = dataUrl;
        this.avatarPreview.set(dataUrl);
      };
      img.onerror = () => this.profileError.set('No se pudo leer la imagen');
      img.src = String(reader.result);
    };
    reader.onerror = () => this.profileError.set('No se pudo leer el archivo');
    reader.readAsDataURL(file);
    input.value = '';
  }

  cancelAvatarPreview(): void {
    this.pendingAvatar = undefined;
    this.avatarPreview.set(null);
  }

  saveAvatar(): void {
    if (this.pendingAvatar === undefined) return;
    this.profileError.set('');
    this.profileSuccess.set('');
    this.savingAvatar.set(true);
    this.http.put<AuthUser>('/api/users/me', { avatar: this.pendingAvatar }).subscribe({
      next: (updated) => {
        this.user.set(updated);
        const stored = this.authService.getStoredUser();
        if (stored) {
          localStorage.setItem('user', JSON.stringify({ ...stored, avatar: updated.avatar }));
        }
        this.pendingAvatar = undefined;
        this.avatarPreview.set(null);
        this.profileSuccess.set('Foto de perfil actualizada');
        this.savingAvatar.set(false);
        setTimeout(() => this.profileSuccess.set(''), 3000);
      },
      error: (error) => {
        this.savingAvatar.set(false);
        this.profileError.set(error?.error?.message ?? 'Error al guardar la foto');
      }
    });
  }

  removeAvatar(): void {
    this.profileError.set('');
    this.profileSuccess.set('');
    this.savingAvatar.set(true);
    this.http.put<AuthUser>('/api/users/me', { avatar: null }).subscribe({
      next: (updated) => {
        this.user.set(updated);
        const stored = this.authService.getStoredUser();
        if (stored) {
          localStorage.setItem('user', JSON.stringify({ ...stored, avatar: null }));
        }
        this.pendingAvatar = undefined;
        this.avatarPreview.set(null);
        this.profileSuccess.set('Foto eliminada, ahora se muestra tu inicial');
        this.savingAvatar.set(false);
        setTimeout(() => this.profileSuccess.set(''), 3000);
      },
      error: (error) => {
        this.savingAvatar.set(false);
        this.profileError.set(error?.error?.message ?? 'Error al quitar la foto');
      }
    });
  }

  toggleAdmin(): void {
    this.showAdmin.update((v) => !v);
  }

  onAdminSearch(): void {
    this.adminPage.set(1);
    this.loadAdminUsers();
  }

  loadAdminUsers(): void {
    if (this.user()?.role !== 'admin' && !this.isAdmin()) return;
    this.adminLoading.set(true);
    this.adminError.set('');
    let params = new HttpParams()
      .set('page', String(this.adminPage()))
      .set('limit', String(this.adminLimit));
    if (this.adminSearch.trim()) params = params.set('search', this.adminSearch.trim());
    this.http.get<UsersResponse>('/api/users', { params }).subscribe({
      next: (res) => {
        this.adminUsers.set(res.users);
        this.adminTotal.set(res.total);
        this.adminPage.set(res.page);
        this.adminTotalPages.set(res.totalPages);
        this.adminLoading.set(false);
      },
      error: (error) => {
        this.adminLoading.set(false);
        this.adminError.set(error?.error?.message ?? 'No se pudo cargar usuarios (se requiere admin)');
      }
    });
  }

  adminPrev(): void {
    this.adminPage.update((p) => Math.max(1, p - 1));
    this.loadAdminUsers();
  }

  adminNext(): void {
    this.adminPage.update((p) => Math.min(this.adminTotalPages(), p + 1));
    this.loadAdminUsers();
  }

  changeRole(target: AdminUser, newRole: string): void {
    this.adminError.set('');
    this.adminSuccess.set('');
    const me = this.user();
    if (me && target.id === me.id) {
      this.adminError.set('No puedes cambiar tu propio rol');
      return;
    }
    if (target.role === newRole) return;
    const action = newRole === 'admin' ? 'dar admin a' : 'quitar admin a';
    if (!confirm(`¿Confirmas ${action} ${target.email}?`)) return;
    this.changingRoleId.set(target.id);
    this.http.put<{ message: string; user: AdminUser }>(`/api/users/${target.id}/role`, { role: newRole }).subscribe({
      next: (res) => {
        this.adminUsers.update((list) => list.map((u) => (u.id === target.id ? res.user : u)));
        this.adminSuccess.set(res.message);
        this.changingRoleId.set(null);
        setTimeout(() => this.adminSuccess.set(''), 4000);
      },
      error: (error) => {
        this.changingRoleId.set(null);
        this.adminError.set(error?.error?.message ?? 'Error al cambiar rol');
      }
    });
  }

  exportUsersExcel(): void {
    const rows = this.adminUsers().map((u) => ({ Nombre: u.name, Correo: u.email, Rol: u.role }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nombre: 'Sin usuarios', Correo: '', Rol: '' }]);
    ws['!cols'] = [{ wch: 24 }, { wch: 32 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, `usuarios-pag${this.adminPage()}.xlsx`);
  }

  exportUsersPDF(): void {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Usuarios registrados', 14, 16);
    doc.setFontSize(10);
    doc.text(`Total: ${this.adminTotal()}  |  Página ${this.adminPage()} de ${this.adminTotalPages()}`, 14, 23);
    autoTable(doc, {
      startY: 28,
      head: [['Nombre', 'Correo', 'Rol']],
      body: this.adminUsers().map((u) => [u.name, u.email, u.role]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [52, 88, 82] }
    });
    doc.save(`usuarios-pag${this.adminPage()}.pdf`);
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { IdleService } from '../../services/idle.service';

interface Income {
  _id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  salario: 'Salario',
  freelance: 'Freelance',
  inversiones: 'Inversiones',
  regalos: 'Regalos',
  otros: 'Otros'
};

@Component({
  selector: 'app-ingresos',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ingresos.component.html',
  styleUrl: './ingresos.component.css'
})
export class IngresosComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly idleService = inject(IdleService);

  userName = signal('');
  mobileMenuOpen = signal(false);
  loading = signal(false);
  loadingList = signal(true);
  successMessage = signal('');
  errorMessage = signal('');
  incomes = signal<Income[]>([]);

  description = '';
  amount: number | null = null;
  category = 'otros';
  date = '';
  editingId: string | null = null;
  total = signal(0);
  searchText = '';
  currentPage = signal(1);
  readonly pageSize = 10;

  categories = Object.entries(CATEGORY_LABELS);

  ngOnInit(): void {
    const user = this.authService.getStoredUser();
    if (user) {
      this.userName.set(user.name.split(' ')[0]);
    }
    const today = new Date();
    this.date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.loadIncomes();
    this.idleService.start();
  }

  ngOnDestroy(): void {
    this.idleService.stop();
  }

  loadIncomes(): void {
    this.loadingList.set(true);
    this.http.get<Income[]>('/api/incomes').subscribe({
      next: (data) => {
        this.incomes.set(data);
        this.updateTotal();
        this.loadingList.set(false);
      },
      error: () => {
        this.loadingList.set(false);
      }
    });
  }

  updateTotal(): void {
    const sum = this.incomes().reduce((acc, i) => acc + Number(i.amount), 0);
    this.total.set(sum);
  }

  filteredIncomes(): Income[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.incomes();
    return this.incomes().filter((i) =>
      i.description.toLowerCase().includes(q) ||
      this.getCategoryLabel(i.category).toLowerCase().includes(q)
    );
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredIncomes().length / this.pageSize));
  }

  pagedIncomes(): Income[] {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredIncomes().slice(start, start + this.pageSize);
  }

  onSearchChange(): void {
    this.currentPage.set(1);
  }

  prevPage(): void {
    this.currentPage.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.currentPage.update((p) => Math.min(this.totalPages(), p + 1));
  }

  startEdit(income: Income): void {
    this.editingId = income._id;
    this.description = income.description;
    this.amount = income.amount;
    this.category = income.category;
    this.date = income.date.split('T')[0];
    this.errorMessage.set('');
    this.successMessage.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.description = '';
    this.amount = null;
    this.category = 'otros';
    const today = new Date();
    this.date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  deleteIncome(id: string): void {
    if (!confirm('¿Eliminar este ingreso?')) return;
    this.http.delete(`/api/incomes/${id}`).subscribe({
      next: () => {
        this.incomes.update((list) => list.filter((i) => i._id !== id));
        this.updateTotal();
        this.successMessage.set('Ingreso eliminado correctamente');
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message ?? 'Error al eliminar el ingreso');
      }
    });
  }

  submit(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.description.trim()) {
      this.errorMessage.set('Ingrese una descripcion');
      return;
    }
    if (!this.amount || this.amount <= 0) {
      this.errorMessage.set('Ingrese un monto valido');
      return;
    }

    this.loading.set(true);
    const body = {
      description: this.description.trim(),
      amount: this.amount,
      category: this.category,
      date: this.date
    };

    if (this.editingId) {
      this.http.put<Income>(`/api/incomes/${this.editingId}`, body).subscribe({
        next: (updated) => {
          this.incomes.update((list) => list.map((i) => (i._id === updated._id ? updated : i)));
          this.updateTotal();
          this.successMessage.set('Ingreso actualizado correctamente');
          this.cancelEdit();
          this.loading.set(false);
          setTimeout(() => this.successMessage.set(''), 3000);
        },
        error: (error) => {
          this.loading.set(false);
          this.errorMessage.set(error?.error?.message ?? 'Error al actualizar el ingreso');
        }
      });
      return;
    }

    this.http.post<Income>('/api/incomes', body).subscribe({
      next: (created) => {
        this.incomes.update((list) => [created, ...list]);
        this.updateTotal();
        this.successMessage.set('Ingreso registrado correctamente');
        this.description = '';
        this.amount = null;
        this.category = 'otros';
        const today = new Date();
        this.date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        this.loading.set(false);
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(error?.error?.message ?? 'Error al guardar el ingreso');
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

  goGastos(): void {
    this.router.navigate(['/gastos']);
  }

  goReportes(): void {
    this.router.navigate(['/reportes']);
  }

  goAjustes(): void {
    this.router.navigate(['/ajustes']);
  }

  formatMoney(value: number): string {
    return `Q${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getCategoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }
}

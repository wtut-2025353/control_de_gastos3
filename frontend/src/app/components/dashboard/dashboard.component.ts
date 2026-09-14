import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed
} from '@angular/core';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { AuthService } from '../../services/auth.service';
import { DashboardService, type DashboardSummary } from '../../services/dashboard.service';
import { IdleService } from '../../services/idle.service';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const CATEGORY_LABELS: Record<string, string> = {
  alimentos: 'Alimentos',
  transporte: 'Transporte',
  hogar: 'Hogar',
  entretenimiento: 'Entretenimiento',
  salud: 'Salud',
  educacion: 'Educacion',
  otros: 'Otros'
};

const CATEGORY_COLORS: Record<string, string> = {
  alimentos: '#345852',
  transporte: '#4b706b',
  hogar: '#8fa6a4',
  entretenimiento: '#a3c4bc',
  salud: '#5e9389',
  educacion: '#6fa398',
  otros: '#ced3d4'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly idleService = inject(IdleService);

  userName = signal('');
  loading = signal(true);
  error = signal('');
  summary = signal<DashboardSummary | null>(null);
  period = signal(6);
  mobileMenuOpen = signal(false);
  showBudgetOptions = signal(false);

  balance = computed(() => this.summary()?.balance ?? 0);
  totalIncome = computed(() => this.summary()?.totalIncome ?? 0);
  totalExpenses = computed(() => this.summary()?.totalExpenses ?? 0);
  savings = computed(() => this.summary()?.savings ?? 0);
  balanceVariation = computed(() => this.summary()?.balanceVariation ?? 0);
  incomeVariation = computed(() => this.summary()?.incomeVariation ?? 0);
  expenseVariation = computed(() => this.summary()?.expenseVariation ?? 0);
  savingsVariation = computed(() => this.summary()?.savingsVariation ?? 0);
  budgetPercentage = computed(() => this.summary()?.budgetPercentage ?? 0);
  budgetSpent = computed(() => this.summary()?.budgetSpent ?? 0);
  totalBudget = computed(() => this.summary()?.totalBudget ?? 0);
  budgetRemaining = computed(() => Math.max(0, this.totalBudget() - this.budgetSpent()));
  categoryBreakdown = computed(() => this.summary()?.categoryBreakdown ?? []);

  hasData = computed(() => {
    const s = this.summary();
    if (!s) return false;
    return s.totalIncome > 0 || s.totalExpenses > 0;
  });

  lineChartData: ChartData<'line'> = { labels: [], datasets: [] };
  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c2b3a',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#ced3d4',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: Q${(ctx.parsed.y ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#7b8a8d', font: { size: 12 } }
      },
      y: {
        grid: { color: '#f0f2f3' },
        ticks: {
          color: '#7b8a8d',
          font: { size: 12 },
          callback: (value) => `Q${Number(value).toLocaleString()}`
        }
      }
    }
  };

  donutChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  donutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c2b3a',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        cornerRadius: 8,
        padding: 10,
        callbacks: {
          label: (ctx) => `${ctx.label}: Q${ctx.parsed.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}`
        }
      }
    }
  };

  ngOnInit(): void {
    const user = this.authService.getStoredUser();
    if (user) {
      this.userName.set(user.name.split(' ')[0]);
    }
    this.loadData();
    this.idleService.start();
  }

  ngOnDestroy(): void {
    this.idleService.stop();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set('');
    this.dashboardService.getSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.updateCharts(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar su informacion financiera');
        this.loading.set(false);
      }
    });
  }

  private updateCharts(data: DashboardSummary): void {
    const allMonths = new Map<string, { income: number; expense: number }>();

    for (const inc of data.monthlyIncomes) {
      const key = `${inc.year}-${inc.month}`;
      const existing = allMonths.get(key) ?? { income: 0, expense: 0 };
      existing.income = inc.total;
      allMonths.set(key, existing);
    }

    for (const exp of data.monthlyExpenses) {
      const key = `${exp.year}-${exp.month}`;
      const existing = allMonths.get(key) ?? { income: 0, expense: 0 };
      existing.expense = exp.total;
      allMonths.set(key, existing);
    }

    const sorted = Array.from(allMonths.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const sliced = sorted.slice(-this.period());

    const labels = sliced.map(([key]) => {
      const [year, month] = key.split('-');
      return `${MONTH_NAMES[parseInt(month) - 1]} ${year.slice(2)}`;
    });

    this.lineChartData = {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: sliced.map(([, v]) => v.income),
          borderColor: '#345852',
          backgroundColor: 'rgba(52, 88, 82, 0.08)',
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#345852',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        },
        {
          label: 'Gastos',
          data: sliced.map(([, v]) => v.expense),
          borderColor: '#8fa6a4',
          backgroundColor: 'rgba(143, 166, 164, 0.08)',
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#8fa6a4',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    };

    const categoryData = data.categoryBreakdown;
    this.donutChartData = {
      labels: categoryData.map((c) => CATEGORY_LABELS[c.category] ?? c.category),
      datasets: [
        {
          data: categoryData.map((c) => c.total),
          backgroundColor: categoryData.map((c) => CATEGORY_COLORS[c.category] ?? '#ced3d4'),
          borderColor: '#ffffff',
          borderWidth: 2
        }
      ]
    };
  }

  setPeriod(months: number): void {
    this.period.set(months);
    const s = this.summary();
    if (s) this.updateCharts(s);
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

  goIngresos(): void {
    this.router.navigate(['/ingresos']);
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

  toggleBudgetOptions(): void {
    this.showBudgetOptions.update((v) => !v);
  }

  formatMoney(value: number): string {
    return `Q${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}`;
  }

  formatVariation(value: number): string {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value}%`;
  }

  getCategoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }

  getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] ?? '#ced3d4';
  }
}

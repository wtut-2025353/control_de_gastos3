import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService } from '../../services/auth.service';
import { IdleService } from '../../services/idle.service';

interface ReportMovement {
  _id: string;
  type: 'ingreso' | 'gasto';
  description: string;
  amount: number;
  category: string;
  date: string;
}

interface CategoryTotal {
  category: string;
  total: number;
  percentage: number;
}

interface MonthlyRow {
  month: number;
  year: number;
  income: number;
  expense: number;
}

interface ReportResponse {
  totals: { income: number; expenses: number; balance: number; count: number };
  monthly: MonthlyRow[];
  incomeByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
  movements: ReportMovement[];
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const INCOME_LABELS: Record<string, string> = {
  salario: 'Salario', freelance: 'Freelance', inversiones: 'Inversiones', regalos: 'Regalos', otros: 'Otros'
};

const EXPENSE_LABELS: Record<string, string> = {
  alimentos: 'Alimentos', transporte: 'Transporte', hogar: 'Hogar',
  entretenimiento: 'Entretenimiento', salud: 'Salud', educacion: 'Educación', otros: 'Otros'
};

const ALL_LABELS: Record<string, string> = { ...INCOME_LABELS, ...EXPENSE_LABELS };

const PALETTE = ['#345852', '#4b706b', '#5e9389', '#6fa398', '#8fa6a4', '#a3c4bc', '#ced3d4', '#2b4a45'];

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [FormsModule, BaseChartDirective],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.css'
})
export class ReportesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly idleService = inject(IdleService);

  mobileMenuOpen = signal(false);
  loading = signal(true);
  errorMessage = signal('');

  from = '';
  to = '';
  type = 'todos';
  category = 'todas';
  search = '';

  // Filtro por fechas + paginación de la tabla de movimientos (10 en 10)
  movFrom = '';
  movTo = '';
  movPage = signal(1);
  readonly movPageSize = 10;

  report = signal<ReportResponse | null>(null);

  categories = computed(() => {
    if (this.type === 'ingreso') return Object.entries(INCOME_LABELS);
    if (this.type === 'gasto') return Object.entries(EXPENSE_LABELS);
    const merged = new Map<string, string>([...Object.entries(INCOME_LABELS), ...Object.entries(EXPENSE_LABELS)]);
    return Array.from(merged.entries());
  });

  barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, color: '#345852' } },
      tooltip: {
        backgroundColor: '#1c2b3a', titleColor: '#fff', bodyColor: '#fff',
        cornerRadius: 8, padding: 10,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: Q${Number(ctx.parsed.y).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}` }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#7b8a8d', font: { size: 11 } } },
      y: { grid: { color: '#f0f2f3' }, ticks: { color: '#7b8a8d', callback: (v) => `Q${Number(v).toLocaleString()}` } }
    }
  };

  donutExpenseData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  donutIncomeData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  donutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, color: '#345852', font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#1c2b3a', titleColor: '#fff', bodyColor: '#fff', cornerRadius: 8, padding: 10,
        callbacks: { label: (ctx) => ` ${ctx.label}: Q${Number(ctx.parsed).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}` }
      }
    }
  };

  ngOnInit(): void {
    this.setPreset('6m');
    this.idleService.start();
  }

  ngOnDestroy(): void {
    this.idleService.stop();
  }

  setPreset(preset: string): void {
    const today = new Date();
    const end = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const start = new Date();
    if (preset === '1m') start.setMonth(start.getMonth() - 1);
    else if (preset === '3m') start.setMonth(start.getMonth() - 3);
    else if (preset === '6m') start.setMonth(start.getMonth() - 6);
    else if (preset === '12m') start.setMonth(start.getMonth() - 12);
    else if (preset === 'year') { start.setMonth(0); start.setDate(1); }
    else if (preset === 'all') { this.from = ''; this.to = ''; this.loadReport(); return; }
    this.from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    this.to = end;
    this.loadReport();
  }

  onTypeChange(): void {
    this.category = 'todas';
    this.loadReport();
  }

  loadReport(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    let params = new HttpParams();
    if (this.from) params = params.set('from', this.from);
    if (this.to) params = params.set('to', this.to);
    if (this.type) params = params.set('type', this.type);
    if (this.category && this.category !== 'todas') params = params.set('category', this.category);
    if (this.search.trim()) params = params.set('search', this.search.trim());

    this.http.get<ReportResponse>('/api/reports', { params }).subscribe({
      next: (data) => {
        this.report.set(data);
        this.updateCharts(data);
        this.movFrom = '';
        this.movTo = '';
        this.movPage.set(1);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo generar el reporte');
        this.loading.set(false);
      }
    });
  }

  movFiltered(): ReportMovement[] {
    const list = this.report()?.movements ?? [];
    const from = this.movFrom ? new Date(this.movFrom + 'T00:00:00') : null;
    const to = this.movTo ? new Date(this.movTo + 'T23:59:59') : null;
    if (from && isNaN(from.getTime())) return list;
    if (to && isNaN(to.getTime())) return list;
    return list.filter((m) => {
      const d = new Date(m.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  movTotalPages(): number {
    return Math.max(1, Math.ceil(this.movFiltered().length / this.movPageSize));
  }

  movPaged(): ReportMovement[] {
    const page = Math.min(this.movPage(), this.movTotalPages());
    const start = (page - 1) * this.movPageSize;
    return this.movFiltered().slice(start, start + this.movPageSize);
  }

  onMovDateChange(): void {
    this.movPage.set(1);
  }

  clearMovDates(): void {
    this.movFrom = '';
    this.movTo = '';
    this.movPage.set(1);
  }

  movPrev(): void {
    this.movPage.update((p) => Math.max(1, p - 1));
  }

  movNext(): void {
    this.movPage.update((p) => Math.min(this.movTotalPages(), p + 1));
  }

  clearFilters(): void {
    this.type = 'todos';
    this.category = 'todas';
    this.search = '';
    this.setPreset('6m');
  }

  private updateCharts(data: ReportResponse): void {
    const labels = data.monthly.map((m) => `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(2)}`);
    this.barChartData = {
      labels,
      datasets: [
        { label: 'Ingresos', data: data.monthly.map((m) => m.income), backgroundColor: '#345852', borderRadius: 6 },
        { label: 'Gastos', data: data.monthly.map((m) => m.expense), backgroundColor: '#8fa6a4', borderRadius: 6 }
      ]
    };
    this.donutExpenseData = {
      labels: data.expenseByCategory.map((c) => this.getCategoryLabel(c.category)),
      datasets: [{ data: data.expenseByCategory.map((c) => c.total), backgroundColor: data.expenseByCategory.map((_, i) => PALETTE[i % PALETTE.length]), borderColor: '#fff', borderWidth: 2 }]
    };
    this.donutIncomeData = {
      labels: data.incomeByCategory.map((c) => this.getCategoryLabel(c.category)),
      datasets: [{ data: data.incomeByCategory.map((c) => c.total), backgroundColor: data.incomeByCategory.map((_, i) => PALETTE[i % PALETTE.length]), borderColor: '#fff', borderWidth: 2 }]
    };
  }

  exportCSV(): void {
    const rows = this.report()?.movements ?? [];
    const header = 'Fecha,Tipo,Descripcion,Categoria,Monto';
    const lines = rows.map((m) => {
      const date = new Date(m.date).toLocaleDateString('es-GT');
      const desc = `"${m.description.replace(/"/g, '""')}"`;
      return `${date},${m.type},${desc},${this.getCategoryLabel(m.category)},${m.amount}`;
    });
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${this.from || 'inicio'}_${this.to || 'hoy'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportExcel(): void {
    const data = this.report();
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen
    const summaryRows = [
      ['Reporte de control de gastos'],
      [`Periodo: ${this.from || 'inicio'} al ${this.to || 'hoy'}`],
      [],
      ['Total ingresos', data.totals.income],
      ['Total gastos', data.totals.expenses],
      ['Balance', data.totals.balance],
      ['Movimientos', data.totals.count]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

    // Hoja 2: Movimientos
    const movementRows = data.movements.map((m) => ({
      Fecha: new Date(m.date).toLocaleDateString('es-GT'),
      Tipo: m.type === 'ingreso' ? 'Ingreso' : 'Gasto',
      Descripcion: m.description,
      Categoria: this.getCategoryLabel(m.category),
      Monto: Number(m.amount)
    }));
    const wsMov = XLSX.utils.json_to_sheet(movementRows.length ? movementRows : [{ Fecha: '', Tipo: '', Descripcion: 'Sin movimientos', Categoria: '', Monto: 0 }]);
    wsMov['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 32 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsMov, 'Movimientos');

    // Hoja 3: Por mes
    const monthlyRows = data.monthly.map((m) => ({
      Mes: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
      Ingresos: m.income,
      Gastos: m.expense,
      Balance: m.income - m.expense
    }));
    if (monthlyRows.length) {
      const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
      wsMonthly['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsMonthly, 'Por mes');
    }

    XLSX.writeFile(wb, `reporte-${this.from || 'inicio'}_${this.to || 'hoy'}.xlsx`);
  }

  exportPDF(): void {
    const data = this.report();
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Reporte de control de gastos', 14, 16);
    doc.setFontSize(10);
    doc.text(`Periodo: ${this.from || 'inicio'} al ${this.to || 'hoy'}  |  Tipo: ${this.type}  |  Categoria: ${this.category}`, 14, 23);
    doc.text(
      `Ingresos: Q${Number(data.totals.income).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}   Gastos: Q${Number(data.totals.expenses).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}   Balance: Q${Number(data.totals.balance).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}   Movimientos: ${data.totals.count}`,
      14, 29
    );
    autoTable(doc, {
      startY: 34,
      head: [['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto']],
      body: data.movements.slice(0, 500).map((m) => [
        new Date(m.date).toLocaleDateString('es-GT'),
        m.type === 'ingreso' ? 'Ingreso' : 'Gasto',
        m.description,
        this.getCategoryLabel(m.category),
        `${m.type === 'ingreso' ? '+' : '-'}Q${Number(m.amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}`
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [52, 88, 82] }
    });
    doc.save(`reporte-${this.from || 'inicio'}_${this.to || 'hoy'}.pdf`);
  }

  printReport(): void {
    window.print();
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

  goAjustes(): void {
    this.router.navigate(['/ajustes']);
  }

  formatMoney(value: number): string {
    return `Q${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 15 })}`;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getCategoryLabel(category: string): string {
    return ALL_LABELS[category] ?? category;
  }
}

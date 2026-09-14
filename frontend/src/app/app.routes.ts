import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { IngresosComponent } from './components/ingresos/ingresos.component';
import { GastosComponent } from './components/gastos/gastos.component';
import { ReportesComponent } from './components/reportes/reportes.component';
import { AjustesComponent } from './components/ajustes/ajustes.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'ingresos', component: IngresosComponent, canActivate: [authGuard] },
  { path: 'gastos', component: GastosComponent, canActivate: [authGuard] },
  { path: 'reportes', component: ReportesComponent, canActivate: [authGuard] },
  { path: 'ajustes', component: AjustesComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];

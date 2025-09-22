import { Routes } from '@angular/router';
import { BookingsComponent } from './bookings/bookings';
import { LoginComponent } from './login/login'; // Import LoginComponent
import { RegisterComponent } from './register/register'; // Import RegisterComponent

export const routes: Routes = [
  { path: '', redirectTo: '/bookings', pathMatch: 'full' },
  { path: 'bookings', component: BookingsComponent },
  { path: 'login', component: LoginComponent }, // New route
  { path: 'register', component: RegisterComponent }, // New route
];

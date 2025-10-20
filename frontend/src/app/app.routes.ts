import { Routes } from '@angular/router';
import { BookingsComponent } from './bookings/bookings';
import { LoginComponent } from './login/login'; // Import LoginComponent
import { RegisterComponent } from './register/register'; // Import RegisterComponent
import { ForgotPasswordComponent } from './forgot-password/forgot-password';
import { ResetPasswordComponent } from './reset-password/reset-password';
import { TestingDashboardComponent } from './testing-dashboard/testing-dashboard'; // For testing purpose
import { TestingCreateRideComponent } from './testing-create-ride/testing-create-ride'; // For testing purpose
import { DriverRegistrationComponent } from './driver-registration/driver-registration.component';
import { AdminDriverApprovalsComponent } from './admin-driver-approvals/admin-driver-approvals.component';
import { AdminDriverDetailsComponent } from './admin-driver-details/admin-driver-details.component';
import { DriverApplicationComponent } from './driver-application/driver-application.component';
import { DriverLoginComponent } from './driver-login/driver-login.component'; // Import DriverLoginComponent
import { DriverForgotPasswordComponent } from './driver-forgot-password/driver-forgot-password.component';
import { DriverResetPasswordComponent } from './driver-reset-password/driver-reset-password.component';
import { DriverSimulatorComponent } from './driver-simulator/driver-simulator.component';
import { DriverDashboardComponent } from './driver-dashboard/driver-dashboard.component';
import { AdminMapComponent } from './admin-map/admin-map.component'; // Import AdminMapComponent
import { AdminAnalyticsComponent } from './admin-analytics/admin-analytics.component'; // New: Import AdminAnalyticsComponent
import { RideRequestComponent } from './ride-request/ride-request.component'; // New: Import RideRequestComponent
import { ZoneManagementComponent } from './zone-management/zone-management.component'; // New: Import ZoneManagementComponent
import { TrackDriverComponent } from './track-driver/track-driver.component';

export const routes: Routes = [
  { path: '', redirectTo: '/bookings', pathMatch: 'full' },
  { path: 'bookings', component: BookingsComponent },
  { path: 'drivers', loadChildren: () => import('./drivers/drivers.module').then(m => m.DriversModule) },
  { path: 'login', component: LoginComponent }, // New route
  { path: 'register', component: RegisterComponent }, // New route
  { path: 'register-driver', component: DriverRegistrationComponent },
  { path: 'driver-application', component: DriverApplicationComponent },
  { path: 'driver-login', component: DriverLoginComponent }, // New route for driver login
  { path: 'driver-simulator', component: DriverSimulatorComponent },
  { path: 'admin/driver-approvals', component: AdminDriverApprovalsComponent },
  { path: 'admin/drivers/:id', component: AdminDriverDetailsComponent },
  { path: 'admin/map', component: AdminMapComponent }, // New route for admin map
  { path: 'admin/analytics', component: AdminAnalyticsComponent }, // New: Route for admin analytics
  { path: 'admin/zones', component: ZoneManagementComponent }, // New: Route for zone management
  { path: 'request-ride', component: RideRequestComponent }, // New: Route for ride request
  { path: 'track/:bookingId', component: TrackDriverComponent }, // New: Route for tracking ride
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'driver/forgot-password', component: DriverForgotPasswordComponent },
  { path: 'driver/reset-password', component: DriverResetPasswordComponent },
  { path: 'driver-dashboard', component: DriverDashboardComponent },
  { path: 'testing-dashboard', component: TestingDashboardComponent }, // For testing purpose
  { path: 'testing-create-ride', component: TestingCreateRideComponent }, // For testing purpose
];
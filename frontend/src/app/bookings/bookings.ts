import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking } from '../booking.model';
import { BookingService } from '../booking';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../auth';
import { environment } from '../../environments/environment'; // Import environment

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './bookings.html',
  styleUrls: ['./bookings.css']
})
export class BookingsComponent implements OnInit {
  public bookings$!: Observable<Booking[]>;
  displayedColumns: string[] = [];
  userRole: string | null = null;
  twilioPhoneNumber: string = '';

  constructor(
    private bookingService: BookingService,
    private authService: AuthService,
    private router: Router
  ) {
    this.twilioPhoneNumber = environment.twilioPhoneNumber; // Use environment variable
  }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.userRole = this.authService.getUserRole();
    this.setDisplayedColumns();
    this.refreshBookings();
  }

  setDisplayedColumns(): void {
    if (this.userRole === 'ADMIN') {
      this.displayedColumns = [
        'id',
        'pickupDateTime',
        'pickupLocation',
        'dropoffLocation',
        'passengers',
        'phoneNumber',
        'status',
      ];
    } else { // CUSTOMER
      this.displayedColumns = [
        'id',
        'pickupDateTime',
        'pickupLocation',
        'dropoffLocation',
        'passengers',
        'status',
      ];
    }
  }

  refreshBookings(): void {
    this.bookings$ = this.bookingService.getBookings();
  }

  getCallLink(): string {
    return `tel:${this.twilioPhoneNumber}`;
  }

  getMessageLink(): string {
    return `sms:${this.twilioPhoneNumber}`;
  }

  getWhatsAppLink(): string {
    const number = this.twilioPhoneNumber.replace('+', '');
    return `https://wa.me/${number}`;
  }
}

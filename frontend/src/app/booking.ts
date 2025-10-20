import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking } from './booking.model';
import { environment } from '../environments/environment'; // Import environment

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private apiUrl = environment.apiUrl + '/api/bookings'; // Use environment.apiUrl

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwt_token'); // Assuming token is stored as 'jwt_token'
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  // New: Get nearest drivers for a booking
  findNearestDrivers(bookingId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${bookingId}/nearest-drivers`, { headers: this.getHeaders() });
  }

  // New: Assign driver to a booking
  assignDriver(bookingId: number, driverId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${bookingId}/assign`, { driverId }, { headers: this.getHeaders() });
  }
}

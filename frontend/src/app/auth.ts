import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../environments/environment'; // Import environment

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl + '/api/auth'; // Use environment.apiUrl
  private tokenKey = 'jwt_token';
  private roleKey = 'user_role';
  private userIdKey = 'user_id';
  private driverIdKey = 'driver_id'; // New: for driver ID

  private _isLoggedIn = new BehaviorSubject<boolean>(this.hasToken());
  isLoggedIn$ = this._isLoggedIn.asObservable();

  constructor(private http: HttpClient) { }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  register(email: string, password: string, role: string = 'CUSTOMER', phoneNumber: string): Observable<any> { // Added phoneNumber
    return this.http.post(`${this.apiUrl}/register`, { email, password, role, phoneNumber }); // Added phoneNumber
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((response: any) => {
        localStorage.setItem(this.tokenKey, response.token);
        localStorage.setItem(this.roleKey, response.role);
        localStorage.setItem(this.userIdKey, response.userId);
        this._isLoggedIn.next(true);
      })
    );
  }

  // New: Driver specific login
  driverLogin(identifier: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/drivers/login`, { identifier, password }).pipe(
      tap((response: any) => {
        localStorage.setItem(this.tokenKey, response.token);
        localStorage.setItem(this.roleKey, response.role);
        localStorage.setItem(this.driverIdKey, response.driverId); // Store driver ID
        this._isLoggedIn.next(true);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.userIdKey);
    localStorage.removeItem(this.driverIdKey); // Clear driver ID on logout
    this._isLoggedIn.next(false);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return this.hasToken();
  }

  getUserRole(): string | null {
    return localStorage.getItem(this.roleKey);
  }

  getUserId(): string | null {
    return localStorage.getItem(this.userIdKey);
  }

  getDriverId(): string | null {
    return localStorage.getItem(this.driverIdKey);
  }

  // New: Forgot password for users
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  // New: Reset password for users
  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { token, password });
  }

  // New: Driver specific forgot password
  driverForgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/driver/forgot-password`, { email });
  }

  // New: Driver specific reset password
  driverResetPassword(email: string, otp: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/driver/reset-password`, { email, otp, password });
  }
}
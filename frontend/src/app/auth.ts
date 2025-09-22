import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs'; // Import BehaviorSubject
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  private tokenKey = 'jwt_token';
  private roleKey = 'user_role';
  private userIdKey = 'user_id';

  private _isLoggedIn = new BehaviorSubject<boolean>(this.hasToken()); // Initialize with current token status
  isLoggedIn$ = this._isLoggedIn.asObservable(); // Expose as Observable

  constructor(private http: HttpClient) { }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  register(email: string, password: string, role: string = 'CUSTOMER'): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { email, password, role });
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((response: any) => {
        localStorage.setItem(this.tokenKey, response.token);
        localStorage.setItem(this.roleKey, response.role);
        localStorage.setItem(this.userIdKey, response.userId); // Assuming backend sends userId
        this._isLoggedIn.next(true); // Emit true after successful login
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.userIdKey);
    this._isLoggedIn.next(false); // Emit false after logout
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // This method is now redundant if using isLoggedIn$ observable, but kept for compatibility
  isLoggedIn(): boolean {
    return this.hasToken();
  }

  getUserRole(): string | null {
    return localStorage.getItem(this.roleKey);
  }

  getUserId(): string | null {
    return localStorage.getItem(this.userIdKey);
  }
}

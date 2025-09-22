import { Component, signal, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav'; // Added MatSidenavModule
import { MatIconModule } from '@angular/material/icon'; // Added MatIconModule for menu icon
import { MediaMatcher } from '@angular/cdk/layout'; // Added MediaMatcher
import { ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef

import { AuthService } from './auth';

import { MatListModule } from '@angular/material/list'; // Added MatListModule

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatIconModule,
    MatListModule // Added
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy { // Implemented OnDestroy
  protected readonly title = signal('frontend');
  isLoggedIn: boolean = false;
  userRole: string | null = null;

  mobileQuery: MediaQueryList; // For responsive sidenav

  private _mobileQueryListener: () => void; // Listener for media query

  constructor(
    private authService: AuthService,
    private router: Router,
    changeDetectorRef: ChangeDetectorRef, // Injected
    media: MediaMatcher // Injected
  ) {
    this.mobileQuery = media.matchMedia('(max-width: 600px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }

  ngOnInit(): void {
    this.authService.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.userRole = this.authService.getUserRole();
    });
  }

  ngOnDestroy(): void { // Cleanup listener
    this.mobileQuery.removeListener(this._mobileQueryListener);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

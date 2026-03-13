import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-home.page.html',
})
export class AppHomePage {
  private authService = inject(AuthService);

  user = this.authService.getCurrentUser();
  onboardingData = this.authService.getOnboardingData();

  logout(): void {
    this.authService.logout();
  }
}

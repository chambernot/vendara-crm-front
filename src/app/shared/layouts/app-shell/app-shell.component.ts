import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { WorkspaceService } from '../../../core/workspace';
import { TelemetryService } from '../../../core/telemetry';
import { MessageNotificationService } from '../../services/message-notification.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <!-- Top Bar -->
      <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-purple-600">Vendara</h1>
            
            <!-- Workspace indicator -->
            @if (currentWorkspace()) {
              <button
                (click)="changeWorkspace()"
                class="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Trocar ambiente"
              >
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span class="font-medium text-gray-700">{{ currentWorkspace()!.name }}</span>
                <svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12M8 12h12M8 17h12M3 7h.01M3 12h.01M3 17h.01"/>
                </svg>
              </button>
            }
          </div>
          
          <div class="flex items-center gap-3">
            <!-- Botão Central -->
            <a
              routerLink="/app/central"
              routerLinkActive="bg-purple-100 text-purple-700"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span class="hidden sm:inline">Central</span>
            </a>

            <!-- Botão Sair -->
            <button 
              (click)="logout()"
              class="text-sm text-gray-600 hover:text-red-600 transition px-3 py-1 rounded hover:bg-red-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <!-- Content -->
      <main class="flex-1 pb-20">
        <router-outlet></router-outlet>
      </main>

      <!-- Bottom Navigation -->
      <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div class="max-w-7xl mx-auto px-2">
          <div class="flex items-center justify-around h-16">
            <a 
              routerLink="/app/dashboard" 
              routerLinkActive="text-purple-600 border-t-2 border-purple-600"
              class="flex flex-col items-center gap-1 text-gray-600 hover:text-purple-600 transition flex-1 pt-2"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span class="text-xs font-medium">Hoje</span>
            </a>

            <a 
              routerLink="/app/clientes" 
              routerLinkActive="text-purple-600 border-t-2 border-purple-600"
              class="flex flex-col items-center gap-1 text-gray-600 hover:text-purple-600 transition flex-1 pt-2"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span class="text-xs font-medium">Clientes</span>
            </a>

            <a 
              routerLink="/app/catalogo" 
              routerLinkActive="text-purple-600 border-t-2 border-purple-600"
              class="flex flex-col items-center gap-1 text-gray-600 hover:text-purple-600 transition flex-1 pt-2"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span class="text-xs font-medium">Catálogo</span>
            </a>

            <a 
              routerLink="/app/vendas" 
              routerLinkActive="text-purple-600 border-t-2 border-purple-600"
              class="flex flex-col items-center gap-1 text-gray-600 hover:text-purple-600 transition flex-1 pt-2"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span class="text-xs font-medium">Vendas</span>
            </a>

            <a 
              routerLink="/app/mensagens" 
              routerLinkActive="text-purple-600 border-t-2 border-purple-600"
              class="flex flex-col items-center gap-1 text-gray-600 hover:text-purple-600 transition flex-1 pt-2 relative"
            >
              <div class="relative">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                @if (messageNotifications.hasUnreadMessages()) {
                  <span class="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                    {{ messageNotifications.getUnreadBadgeText() }}
                  </span>
                }
              </div>
              <span class="text-xs font-medium">Mensagens</span>
            </a>
          </div>
        </div>
      </nav>
    </div>
  `,
})
export class AppShellComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private workspaceService = inject(WorkspaceService);
  private telemetryService = inject(TelemetryService);
  messageNotifications = inject(MessageNotificationService);

  currentWorkspace = signal(this.workspaceService.getActive());

  ngOnInit(): void {
    // Log telemetry on app open
    try {
      this.telemetryService.log('app_open');
      this.telemetryService.log('login'); // Also log login since user is in the app
    } catch {
      // Silent fail
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  changeWorkspace(): void {
    this.router.navigate(['/workspace/select']);
  }
}

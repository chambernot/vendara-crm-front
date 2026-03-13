import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './empty-state.component.html'
})
export class EmptyStateComponent {
  @Input() icon?: string;
  @Input() title: string = 'Nenhum item encontrado';
  @Input() description: string = 'Não há dados para exibir no momento.';
  @Input() action?: { label: string; route: string };
}

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-section-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-card.component.html'
})
export class SectionCardComponent {
  @Input() title: string = '';
  @Input() subtitle?: string;
}

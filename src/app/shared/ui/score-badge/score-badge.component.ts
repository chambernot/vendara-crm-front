import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScoreTier, ScoreLabel } from '../../../features/clients/data-access/clients.models';

@Component({
  selector: 'app-score-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './score-badge.component.html'
})
export class ScoreBadgeComponent {
  @Input() score: number = 50;              // Valor numérico 0-100
  @Input() scoreLabel?: ScoreLabel;         // "Baixa", "Média", "Alta"
  @Input() scoreTier?: ScoreTier;           // "COLD", "WARM", "HOT"

  get tier(): ScoreTier {
    return this.scoreTier || this.deriveTierFromScore(this.score);
  }

  get label(): string {
    if (this.scoreLabel) {
      return this.scoreLabel;
    }
    // Fallback: derivar do tier
    switch (this.tier) {
      case 'HOT': return 'Alta';
      case 'WARM': return 'Média';
      case 'COLD': return 'Baixa';
      default: return 'Média';
    }
  }

  get displayLabel(): string {
    // Versão mais amigável para exibição
    switch (this.tier) {
      case 'HOT': return 'Quente';
      case 'WARM': return 'Morno';
      case 'COLD': return 'Frio';
      default: return 'Morno';
    }
  }

  get colorClasses(): string {
    switch (this.tier) {
      case 'HOT':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'WARM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'COLD':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  private deriveTierFromScore(value: number): ScoreTier {
    if (value >= 70) return 'HOT';
    if (value >= 40) return 'WARM';
    return 'COLD';
  }
}

import { Component, OnInit, signal, computed, output, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagDefinition, TagCategory } from '../../../core/tags/tags.models';
import { TagsApiService } from '../../../core/tags/tags-api.service';

@Component({
  selector: 'app-tag-selector-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tag-selector-modal.component.html',
})
export class TagSelectorModalComponent implements OnInit {
  // Inputs
  isOpen = input.required<boolean>();
  appliedTags = input<string[]>([]); // slugs das tags já aplicadas

  // Outputs
  closed = output<void>();
  tagSelected = output<string>(); // emite o slug da tag selecionada

  private tagsApi = inject(TagsApiService);

  // State
  searchQuery = signal('');
  selectedCategory = signal<TagCategory | 'all'>('all');

  // Computed
  allTags = signal<TagDefinition[]>([]);

  filteredTags = computed(() => {
    let tags = this.allTags();
    const query = this.searchQuery().toLowerCase().trim();
    const category = this.selectedCategory();

    // Filtrar por categoria
    if (category !== 'all') {
      tags = tags.filter(t => t.category === category);
    }

    // Filtrar por busca
    if (query) {
      tags = tags.filter(t =>
        t.label.toLowerCase().includes(query) ||
        t.slug.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }

    return tags;
  });

  // Tags agrupadas por categoria
  groupedTags = computed(() => {
    const tags = this.filteredTags();
    const groups: Record<TagCategory, TagDefinition[]> = {
      intencao: [],
      status: [],
      comportamento: []
    };

    tags.forEach(tag => {
      groups[tag.category].push(tag);
    });

    return groups;
  });

  ngOnInit(): void {
    // Reset state quando abre
    if (this.isOpen()) {
      this.searchQuery.set('');
      this.selectedCategory.set('all');
    }
    // Carregar tags da API ao abrir
    this.tagsApi.listTagDefinitions().subscribe({
      next: (tags) => {
        this.allTags.set(tags);
      },
      error: (err) => {
        console.error('Erro ao carregar tags da API:', err);
      }
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  onSelectTag(tagSlug: string): void {
    this.tagSelected.emit(tagSlug);
  }

  isTagApplied(tagSlug: string): boolean {
    return this.appliedTags().includes(tagSlug);
  }

  getCategoryLabel(category: TagCategory): string {
    const labels: Record<string, string> = {
      intencao: 'Intenção',
      status: 'Status',
      comportamento: 'Comportamento',
      produto: 'Produto',
      outros: 'Outros'
    };
    return labels[category] || category;
  }

  getScoreImpactClass(impact: number): string {
    if (impact > 0) {
      return 'text-green-600 bg-green-50';
    } else if (impact < 0) {
      return 'text-red-600 bg-red-50';
    }
    return 'text-gray-600 bg-gray-50';
  }

  formatScoreImpact(impact: number): string {
    return impact > 0 ? `+${impact}` : `${impact}`;
  }

  setCategory(category: TagCategory | 'all'): void {
    this.selectedCategory.set(category);
  }

  updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  /**
   * Retorna as categorias disponíveis como array
   */
  getCategories(): TagCategory[] {
    return ['intencao', 'status', 'comportamento'];
  }

  /**
   * Retorna as tags de uma categoria específica
   */
  getTagsForCategory(category: string): TagDefinition[] {
    const grouped = this.groupedTags();
    return grouped[category as TagCategory] || [];
  }
}

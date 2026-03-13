import { Component, OnInit, signal, computed, output, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagsApiService, TagDefinition, AddTagDto } from '../../../core/tags/tags-api.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-tag-manager-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tag-manager-modal.component.html',
})
export class TagManagerModalComponent implements OnInit {
  // Filtered tags based on search and selected category
  public filteredTags = computed(() => {
    const tags = this.allTags();
    if (!Array.isArray(tags)) return [];
    const query = this.searchQuery().toLowerCase();
    const category = this.selectedCategory();
    return tags.filter(tag => {
      const matchesCategory = category === 'all' || tag.category === category;
      const matchesQuery = !query || tag.label.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  });

  // Apply tag to client
  public onApplyTag(tagSlug: string): void {
    const clientId = this.clientId();
    if (!clientId) {
      this.toastService.showError('Cliente ainda não foi salvo. Salve o cliente antes de aplicar tags.');
      return;
    }
    const currentTags = this.allTags();
    const tag = Array.isArray(currentTags) ? currentTags.find(t => t && t.slug === tagSlug) : null;
    const tagLabel = tag?.label || tagSlug;
    if (!tag) {
      this.toastService.showError('Erro: Tag não encontrada');
      return;
    }
    if (this.isTagApplied(tagSlug)) {
      return;
    }
    this.processingTag.set(tagSlug);
    const dto: AddTagDto = { clientId, tagId: tag.id };
    this.tagsApi.addTagToClient(dto).subscribe({
      next: () => {
        this.processingTag.set(null);
        this.tagApplied.emit(tagSlug);
        this.toastService.showSuccess(`Tag "${tagLabel}" aplicada com sucesso!`);
      },
      error: (err) => {
        this.processingTag.set(null);
        this.toastService.showError('Erro ao aplicar tag. Tente novamente.');
      }
    });
  }

  // Angular lifecycle
  public ngOnInit(): void {
    this.loadingTags.set(true);
    this.tagsApi.listTagDefinitions().subscribe({
      next: (tags: TagDefinition[]) => {
        this.allTags.set(tags);
        this.loadingTags.set(false);
      },
      error: () => {
        this.loadingTags.set(false);
        this.toastService.showError('Erro ao carregar tags.');
      }
    });
  }
  // Track which tag is being processed (applied/removed)
  public processingTag = signal<string | null>(null);

  // Group tags by category for display
  public groupedTags = computed(() => {
    const tags = this.allTags();
    if (!Array.isArray(tags)) return {};
    return tags.reduce((acc, tag) => {
      if (!acc[tag.category]) acc[tag.category] = [];
      acc[tag.category].push(tag);
      return acc;
    }, {} as Record<string, TagDefinition[]>);
  });
  // Inputs
  isOpen = input.required<boolean>();
  clientId = input.required<string>();
  appliedTags = input<string[]>([]); // slugs das tags já aplicadas

  // Outputs
  closed = output<void>();
  tagApplied = output<string>(); // emite o slug da tag aplicada
  tagRemoved = output<string>(); // emite o slug da tag removida

  private tagsApi = inject(TagsApiService);
  private toastService = inject(ToastService);

  // State
  public searchQuery = signal('');
  public selectedCategory = signal<'all' | 'intencao' | 'status' | 'produto' | 'outros'>('all');
  public allTags = signal<TagDefinition[]>([]);
  public loadingTags = signal(true);
  

  // Apply/Remove tag state
  public onRemoveTag(tagSlug: string): void {
    if (!this.isTagApplied(tagSlug)) {
      return;
    }
    const currentTags = this.allTags();
    const tag = Array.isArray(currentTags) ? currentTags.find(t => t && t.slug === tagSlug) : null;
    const tagLabel = tag?.label || tagSlug;
    if (!tag) {
      console.error('❌ Tag não encontrada:', tagSlug);
      this.toastService.showError('Erro: Tag não encontrada');
      return;
    }
    if (!confirm(`Deseja remover a tag "${tagLabel}"?`)) {
      return;
    }
    this.processingTag.set(tagSlug);
    this.tagsApi.removeTagFromClient(this.clientId(), tag.id).subscribe({
      next: () => {
        this.processingTag.set(null);
        this.tagRemoved.emit(tagSlug);
        this.toastService.showSuccess(`Tag "${tagLabel}" removida com sucesso!`);
      },
      error: (err) => {
        console.error('❌ Erro ao remover tag:', err);
        this.processingTag.set(null);
        this.toastService.showError('Erro ao remover tag. Tente novamente.');
      }
    });
  }

  public isTagApplied(tagSlug: string): boolean {
    // appliedTags agora contém IDs, não slugs
    // Precisamos buscar a tag pelo slug e verificar se o ID está na lista
    const currentTags = this.allTags();
    const appliedTagIds = this.appliedTags();
    const tag = Array.isArray(currentTags) ? currentTags.find(t => t && t.slug === tagSlug) : null;
    
    console.log('🔍 [isTagApplied] Verificando tag:', tagSlug);
    console.log('🔍 [isTagApplied] Tag encontrada:', tag);
    console.log('🔍 [isTagApplied] Applied IDs:', appliedTagIds);
    console.log('🔍 [isTagApplied] Tag ID:', tag?.id);
    console.log('🔍 [isTagApplied] Inclui?', appliedTagIds.includes(tag?.id || ''));
    
    if (!tag) return false;
    
    return appliedTagIds.includes(tag.id);
  }

  public isTagProcessing(tagSlug: string): boolean {
    return this.processingTag() === tagSlug;
  }

  public getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      intencao: 'Intenção',
      status: 'Status',
      produto: 'Produto',
      outros: 'Outros'
    };
    return labels[category] || category;
  }

  public getScoreImpactClass(impact: number): string {
    if (impact > 0) {
      return 'text-green-600 bg-green-50';
    } else if (impact < 0) {
      return 'text-red-600 bg-red-50';
    }
    return 'text-gray-600 bg-gray-50';
  }

  public formatScoreImpact(impact: number): string {
    return impact > 0 ? `+${impact}` : `${impact}`;
  }

  public setCategory(category: 'all' | 'intencao' | 'status' | 'produto' | 'outros'): void {
    this.selectedCategory.set(category);
  }

  public updateSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  /**
   * Retorna as categorias disponíveis como array
   */
  public getCategories(): string[] {
    return ['intencao', 'status', 'produto', 'outros'];
  }

  /**
   * Retorna as tags de uma categoria específica
   */
  public getTagsForCategory(category: string): TagDefinition[] {
    const grouped = this.groupedTags();
    return grouped[category] || [];
  }

// --- END: All tag creation/editing logic removed for 'Aplicar Tags' modal ---
}

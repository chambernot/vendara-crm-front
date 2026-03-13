import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TemplateStore } from '../../data-access/template.store';
import { MessageTemplate, CreateTemplateDto, UpdateTemplateDto } from '../../data-access/template.models';
import { FOLLOWUP_REASON_LABELS } from '../../data-access/central.models';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, EmptyStateComponent],
  templateUrl: './templates.page.html',
})
export class TemplatesPage {
  private templateStore = inject(TemplateStore);

  searchTerm = signal('');
  filterTag = signal<string | 'all'>('all');
  isEditorOpen = signal(false);
  editingTemplate = signal<MessageTemplate | null>(null);
  editorTitle = signal('');
  editorBody = signal('');
  editorTags = signal<string[]>([]);
  editorIsActive = signal(true);
  editorError = signal('');
  previewClientName = signal('Maria Silva');

  allTemplates = this.templateStore.allTemplates;
  isLoading = this.templateStore.loading;
  
  filteredTemplates = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const tag = this.filterTag();
    let templates = this.allTemplates();
    if (tag !== 'all') {
      templates = templates.filter(t => (t.backendTags ?? []).includes(tag));
    }
    if (term) {
      templates = templates.filter(t => 
        t.title.toLowerCase().includes(term) || 
        t.body.toLowerCase().includes(term)
      );
    }
    return templates;
  });

  reasonLabels = FOLLOWUP_REASON_LABELS;

  /**
   * Tags reais do backend, derivadas dos templates carregados.
   * Evita mostrar opções que não existem no banco.
   */
  allTags = computed(() => {
    const set = new Set<string>();
    for (const t of this.allTemplates()) {
      for (const tag of (t.backendTags ?? [])) {
        if (tag && tag.trim()) set.add(tag);
      }
    }
    return Array.from(set).sort();
  });

  previewText = computed(() => {
    const body = this.editorBody();
    const clientName = this.previewClientName();
    const firstName = clientName.split(' ')[0];
    let text = body;
    // Double-curly format (frontend seed)
    text = text.replace(/\{\{primeiro_nome\}\}/g, firstName);
    text = text.replace(/\{\{nome_completo\}\}/g, clientName);
    text = text.replace(/\{\{nome\}\}/g, clientName);
    text = text.replace(/\{\{produto\}\}/g, 'Colar Coração');
    text = text.replace(/\{\{preco\}\}/g, 'R$ 450,00');
    // Single-curly format (backend API)
    text = text.replace(/\{NomeCliente\}/gi, firstName);
    text = text.replace(/\{PrimeiroNome\}/gi, firstName);
    text = text.replace(/\{NomeCompleto\}/gi, clientName);
    text = text.replace(/\{Nome\}/gi, clientName);
    text = text.replace(/\{Produto\}/gi, 'Colar Coração');
    text = text.replace(/\{Preco\}/gi, 'R$ 450,00');
    return text;
  });

  openCreateModal(): void {
    this.editingTemplate.set(null);
    this.editorTitle.set('');
    this.editorBody.set('');
    this.editorTags.set([]);
    this.editorIsActive.set(true);
    this.editorError.set('');
    this.isEditorOpen.set(true);
  }

  openEditModal(template: MessageTemplate): void {
    this.editingTemplate.set(template);
    this.editorTitle.set(template.title);
    this.editorBody.set(template.body);
    this.editorTags.set([...(template.backendTags ?? [])]);
    this.editorIsActive.set(template.isActive);
    this.editorError.set('');
    this.isEditorOpen.set(true);
  }

  closeEditor(): void {
    this.isEditorOpen.set(false);
    this.editingTemplate.set(null);
  }

  toggleTag(tag: string): void {
    const tags = this.editorTags();
    if (tags.includes(tag)) {
      this.editorTags.set(tags.filter(t => t !== tag));
    } else {
      this.editorTags.set([...tags, tag]);
    }
  }

  saveTemplate(): void {
    const title = this.editorTitle().trim();
    const body = this.editorBody().trim();
    const tags = this.editorTags();
    if (!title) { this.editorError.set('Título é obrigatório'); return; }
    if (!body) { this.editorError.set('Mensagem é obrigatória'); return; }
    if (tags.length === 0) { this.editorError.set('Selecione pelo menos uma tag'); return; }
    const editing = this.editingTemplate();
    if (editing) {
      this.templateStore.update(editing.id, { title, body, tags, isActive: this.editorIsActive() });
    } else {
      this.templateStore.create({ title, body, tags, isActive: this.editorIsActive() });
    }
    this.closeEditor();
  }

  toggleActive(template: MessageTemplate): void {
    this.templateStore.toggleActive(template.id);
  }

  duplicate(template: MessageTemplate): void {
    this.templateStore.duplicate(template.id);
  }

  deleteTemplate(template: MessageTemplate): void {
    if (template.isDefault) {
      alert('Templates padrão não podem ser removidos. Desative-o se necessário.');
      return;
    }
    if (confirm(`Tem certeza que deseja remover "${template.title}"?`)) {
      this.templateStore.delete(template.id);
    }
  }

  getTagsLabel(tags: string[]): string {
    return tags.map(t => this.getTagLabel(t)).join(', ');
  }

  /**
   * Returns a human-readable label for any tag, even unknown ones.
   */
  getTagLabel(tag: string): string {
    const upper = tag.toUpperCase().trim();

    // Labels para tags do backend
    const backendLabels: Record<string, string> = {
      NEEDS_REPLY: 'Pediu preço',
      NO_RESPONSE_48H: 'Sumiu',
      POST_SALE: 'Pós-venda',
      PECA_PARADA: 'Peça parada',
      GENERAL: 'Geral',
      PORTFOLIO: 'Novidades',
      RESPOSTA_PADRAO: 'Resposta padrão',
      REENGAJAR_LEVE: 'Reengajar leve',
      PROMOCAO: 'Promoção',
      COBRANCA_LEVE: 'Cobrança leve',
      PRESENTE: 'Presente',
    };
    if (backendLabels[upper]) return backendLabels[upper];

    // Fallback: capitalize and replace underscores
    return tag
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

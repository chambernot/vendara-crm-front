import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TemplatesApiService } from '../../data-access/templates-api.service';
import { MetaTemplatesApiService } from '../../data-access/meta-templates-api.service';
import { MessageTemplate, MetaTemplateStatus } from '../../data-access/template.models';

@Component({
  selector: 'app-whatsapp-templates',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './whatsapp-templates.page.html',
})
export class WhatsAppTemplatesPage implements OnInit {
  private templatesApi = inject(TemplatesApiService);
  private metaTemplatesApi = inject(MetaTemplatesApiService);

  templates = signal<MessageTemplate[]>([]);
  loading = signal(true);
  syncing = signal(false);
  publishingId = signal<string | null>(null);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  showRejectionModal = signal(false);
  selectedRejectionReason = signal<string>('');

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.error.set(null);
    
    this.templatesApi.list().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading templates:', err);
        this.error.set('Erro ao carregar templates. Tente novamente.');
        this.loading.set(false);
      },
    });
  }

  getMetaStatus(template: MessageTemplate): MetaTemplateStatus {
    return template.meta?.status ?? 'NONE';
  }

  getMetaName(template: MessageTemplate): string {
    return template.meta?.name ?? '-';
  }

  canPublish(template: MessageTemplate): boolean {
    const status = this.getMetaStatus(template);
    return status === 'NONE' && !this.publishingId();
  }

  isPending(template: MessageTemplate): boolean {
    return this.getMetaStatus(template) === 'PENDING';
  }

  isApproved(template: MessageTemplate): boolean {
    return this.getMetaStatus(template) === 'APPROVED';
  }

  isRejected(template: MessageTemplate): boolean {
    return this.getMetaStatus(template) === 'REJECTED';
  }

  hasRejectionReason(template: MessageTemplate): boolean {
    return !!template.meta?.rejectionReason;
  }

  getVariables(template: MessageTemplate): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches: string[] = [];
    let match;
    
    while ((match = regex.exec(template.body)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }

  publishToMeta(templateId: string): void {
    if (!confirm('Deseja publicar este template no Meta para aprovação?')) {
      return;
    }

    this.publishingId.set(templateId);
    this.error.set(null);
    this.success.set(null);

    this.metaTemplatesApi.publish(templateId).subscribe({
      next: (updatedTemplate) => {
        // Update the template in the list
        this.templates.update((templates) =>
          templates.map((t) => (t.id === templateId ? updatedTemplate : t))
        );
        this.success.set('Template enviado para aprovação do Meta com sucesso!');
        this.publishingId.set(null);
      },
      error: (err) => {
        console.error('Error publishing template:', err);
        this.error.set(
          err.error?.message ?? 'Erro ao publicar template. Tente novamente.'
        );
        this.publishingId.set(null);
      },
    });
  }

  syncAllTemplates(): void {
    this.syncing.set(true);
    this.error.set(null);
    this.success.set(null);

    this.metaTemplatesApi.syncAll().subscribe({
      next: (updatedTemplates) => {
        // Update templates with synced data
        this.templates.update((templates) => {
          const updatedMap = new Map(updatedTemplates.map((t) => [t.id, t]));
          return templates.map((t) => updatedMap.get(t.id) ?? t);
        });
        this.success.set('Status dos templates sincronizado com sucesso!');
        this.syncing.set(false);
      },
      error: (err) => {
        console.error('Error syncing templates:', err);
        this.error.set('Erro ao sincronizar templates. Tente novamente.');
        this.syncing.set(false);
      },
    });
  }

  showRejectionReasonModal(template: MessageTemplate): void {
    if (template.meta?.rejectionReason) {
      this.selectedRejectionReason.set(template.meta.rejectionReason);
      this.showRejectionModal.set(true);
    }
  }

  closeRejectionModal(): void {
    this.showRejectionModal.set(false);
    this.selectedRejectionReason.set('');
  }

  getStatusBadgeClass(status: MetaTemplateStatus): string {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'PAUSED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  }

  getStatusLabel(status: MetaTemplateStatus): string {
    switch (status) {
      case 'APPROVED':
        return 'Aprovado ✅';
      case 'PENDING':
        return 'Em análise ⏳';
      case 'REJECTED':
        return 'Rejeitado ❌';
      case 'PAUSED':
        return 'Pausado';
      default:
        return 'Não publicado';
    }
  }
}

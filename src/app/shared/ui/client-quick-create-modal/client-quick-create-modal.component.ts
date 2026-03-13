import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientsStore } from '../../../features/clients/data-access';

@Component({
  selector: 'app-client-quick-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './client-quick-create-modal.component.html',
})
export class ClientQuickCreateModalComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<{ clientId: string; clientName: string }>();

  private fb = inject(FormBuilder);
  private clientsStore = inject(ClientsStore);

  form: FormGroup;
  tagInput = signal('');
  tags = signal<string[]>([]);
  saving = signal(false);
  errorMessage = signal('');

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      whatsapp: ['', [this.whatsappValidator]],
      notes: [''],
    });
  }

  /**
   * Validador customizado para WhatsApp
   * Aceita vazio ou mínimo 10 dígitos se preenchido
   */
  private whatsappValidator(control: any) {
    if (!control.value) return null;
    
    const digits = control.value.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 10) {
      return { minLength: true };
    }
    
    return null;
  }

  /**
   * Adiciona tag ao array
   */
  addTag(): void {
    const tag = this.tagInput().trim().toLowerCase();
    if (!tag) return;
    
    const currentTags = this.tags();
    if (!currentTags.includes(tag)) {
      this.tags.set([...currentTags, tag]);
    }
    
    this.tagInput.set('');
  }

  /**
   * Remove tag do array
   */
  removeTag(tag: string): void {
    this.tags.set(this.tags().filter(t => t !== tag));
  }

  /**
   * Handler do Enter no input de tag
   */
  onTagInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTag();
    }
  }

  /**
   * Salva novo cliente e emite evento
   */
  save(): void {
    if (this.form.invalid || this.saving()) {
      // Marcar todos os campos como touched para mostrar erros
      Object.keys(this.form.controls).forEach(key => {
        this.form.controls[key].markAsTouched();
      });
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    const formValue = this.form.value;
    
    this.clientsStore.createClient({
      name: formValue.name,
      whatsapp: formValue.whatsapp || undefined,
      tags: this.tags(),
      notes: formValue.notes || undefined,
    }).subscribe({
      next: (client) => {
        this.saving.set(false);
        this.created.emit({ 
          clientId: client.id,
          clientName: client.name 
        });
        this.resetForm();
        this.closed.emit();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set('Erro ao criar cliente. Tente novamente.');
        console.error('Error creating client:', error);
      }
    });
  }

  /**
   * Cancela e fecha modal
   */
  cancel(): void {
    this.resetForm();
    this.closed.emit();
  }

  /**
   * Reseta formulário para estado inicial
   */
  private resetForm(): void {
    this.form.reset();
    this.tags.set([]);
    this.tagInput.set('');
    this.errorMessage.set('');
  }

  /**
   * Previne propagação do clique no conteúdo do modal
   */
  onModalContentClick(event: Event): void {
    event.stopPropagation();
  }
}

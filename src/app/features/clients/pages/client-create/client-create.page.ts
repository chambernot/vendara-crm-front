import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ClientsStore } from '../../data-access/clients.store';
import { TagsApiService, TagDefinition } from '../../../../core/tags/tags-api.service';

@Component({
  selector: 'app-client-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './client-create.page.html',
  styleUrl: './client-create.page.css'
})
export class ClientCreatePage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private clientsStore = inject(ClientsStore);
  private tagsApi = inject(TagsApiService);

  private returnTo: string | null = null;
  
  // Estado
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  // Tags do sistema
  allTags = signal<TagDefinition[]>([]);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    whatsapp: ['', [Validators.required]],  // Obrigatório conforme API
    notes: [''],
    lastContactAt: [new Date().toISOString().split('T')[0]]
  });

  selectedTags: TagDefinition[] = [];
  tagInput = '';

  constructor() {
    // Capturar query param returnTo
    this.route.queryParams.subscribe(params => {
      this.returnTo = params['returnTo'] || null;
    });

    // Carregar tags do sistema para seleção por ID/slug
    this.tagsApi.listTagDefinitions().subscribe({
      next: (tags) => this.allTags.set(tags || []),
      error: (err) => {
        console.error('❌ [ClientCreate] Erro ao carregar tags:', err);
        this.allTags.set([]);
      },
    });
  }

  addTag(): void {
    const raw = this.tagInput.trim();
    if (!raw) return;

    const term = raw.toLowerCase();
    const tags = this.allTags();
    const found = tags.find(t => (t.slug || '').toLowerCase() === term)
      ?? tags.find(t => (t.label || '').toLowerCase() === term);

    if (!found) {
      this.errorMessage.set('Tag não encontrada. Selecione uma tag existente.');
      return;
    }

    if (!this.selectedTags.some(t => t.id === found.id)) {
      this.selectedTags.push(found);
    }
    this.tagInput = '';
  }

  removeTag(tag: string): void {
    this.selectedTags = this.selectedTags.filter(t => t.slug !== tag);
  }

  cancel(): void {
    if (this.returnTo) {
      this.router.navigateByUrl(this.returnTo);
    } else {
      this.router.navigate(['/app/clientes']);
    }
  }

  save(): void {
    this.errorMessage.set(null);
    
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      this.errorMessage.set('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const formValue = this.form.value;
    
    // Validação adicional: nome não pode estar vazio
    if (!formValue.name || formValue.name.trim().length < 2) {
      this.errorMessage.set('Nome deve ter pelo menos 2 caracteres.');
      return;
    }

    this.saving.set(true);

    const selectedTagIds = this.selectedTags.map(t => t.id).filter(Boolean);

    // Criar cliente primeiro (sem depender de dto.tags), depois aplicar tags por ID
    this.clientsStore.createClient({
      name: formValue.name.trim(),
      whatsapp: formValue.whatsapp?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
      lastContactAt: formValue.lastContactAt 
        ? new Date(formValue.lastContactAt).toISOString() 
        : new Date().toISOString()
    }).subscribe({
      next: (client) => {
        // Aplicar tags via API (Mongo) usando IDs
        this.tagsApi.addTagsToClient(client.id, selectedTagIds).subscribe({
          next: () => {
            this.saving.set(false);
            if (this.returnTo) {
              this.router.navigate([this.returnTo], {
                queryParams: { createdClientId: client.id }
              });
            } else {
              this.router.navigate(['/app/clientes', client.id]);
            }
          },
          error: (err) => {
            this.saving.set(false);
            console.error('❌ ERROR ao aplicar tags no cliente:', err);
            this.errorMessage.set('Cliente criado, mas não foi possível aplicar as tags. Tente novamente.');
          },
        });
      },
      error: (err) => {
        this.saving.set(false);
        console.error('❌ ERROR ao criar cliente:', err);
        console.error('❌ Error details:', err.error);
        console.error('❌ Error errors:', err.error?.errors);
        
        // Tentar extrair mensagem de erro da resposta
        let errorMsg = 'Erro ao criar cliente. Tente novamente.';
        
        if (err?.error?.errors) {
          // Erros de validação da API (pode ser objeto ou array)
          const errorsObj = err.error.errors;
          if (Array.isArray(errorsObj)) {
            errorMsg = errorsObj.join(', ');
          } else if (typeof errorsObj === 'object') {
            const allErrors: string[] = [];
            Object.keys(errorsObj).forEach(key => {
              const fieldErrors = errorsObj[key];
              if (Array.isArray(fieldErrors)) {
                allErrors.push(...fieldErrors);
              } else if (typeof fieldErrors === 'string') {
                allErrors.push(fieldErrors);
              }
            });
            errorMsg = allErrors.length > 0 ? allErrors.join(', ') : 'Erro de validação';
          }
        } else if (err?.error?.message) {
          errorMsg = err.error.message;
        } else if (err?.message) {
          errorMsg = err.message;
        }
        
        console.error('❌ Showing error message:', errorMsg);
        this.errorMessage.set(errorMsg);
      }
    });
  }
}

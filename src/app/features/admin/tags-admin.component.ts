import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagService, Tag } from '../../core/services/tag.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-tags-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Gestão de Tags</h1>
      <button (click)="openCreateTag()" class="mb-4 px-4 py-2 bg-green-600 text-white rounded">Criar Nova Tag</button>
      <table class="min-w-full bg-white border">
        <thead>
          <tr>
            <th class="px-4 py-2 border">Label</th>
            <th class="px-4 py-2 border">Código</th>
            <th class="px-4 py-2 border">Cor</th>
            <th class="px-4 py-2 border">Ativo</th>
            <th class="px-4 py-2 border">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let tag of tags()">
            <td class="border px-4 py-2">{{ tag.label }}</td>
            <td class="border px-4 py-2">{{ tag.code }}</td>
            <td class="border px-4 py-2"><span [style.background]="tag.color" class="inline-block w-6 h-6 rounded-full"></span></td>
            <td class="border px-4 py-2">{{ tag.active ? 'Sim' : 'Não' }}</td>
            <td class="border px-4 py-2">
              <button (click)="editTag(tag)">Editar</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div *ngIf="showCreate">
        <h2 class="text-xl font-bold mt-6 mb-2">Nova Tag</h2>
        <form (ngSubmit)="createTag()">
          <input [(ngModel)]="newTag.label" name="label" placeholder="Label" required class="border px-2 py-1 mr-2" />
          <input [(ngModel)]="newTag.code" name="code" placeholder="Código" required class="border px-2 py-1 mr-2" />
          <input [(ngModel)]="newTag.color" name="color" placeholder="Cor (hex)" class="border px-2 py-1 mr-2" />
          <button type="submit" class="bg-blue-600 text-white px-4 py-1 rounded">Salvar</button>
          <button type="button" (click)="showCreate=false" class="ml-2">Cancelar</button>
        </form>
      </div>
    </div>
  `
})
export class TagsAdminComponent implements OnInit {
  private tagService = inject(TagService);
  private route = inject(ActivatedRoute);
  tags = signal<Tag[]>([]);
  showCreate = false;
  newTag: Partial<Tag> = {};

  ngOnInit() {
    this.loadTags();
  }

  loadTags() {
    const workspaceId = this.route.snapshot.queryParamMap.get('workspaceId') || '';
    this.tagService.list(workspaceId).subscribe(tags => this.tags.set(tags));
  }

  openCreateTag() {
    this.showCreate = true;
    this.newTag = {};
  }

  createTag() {
    this.tagService.create(this.newTag as any).subscribe(() => {
      this.showCreate = false;
      this.loadTags();
    });
  }

  editTag(tag: Tag) {
    // Implementar edição se necessário
  }
}

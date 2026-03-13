import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../data-access/product.service';
import { ProductImageUploadResponse } from '../../data-access/catalog.models';

@Component({
  selector: 'app-product-image-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-image-upload.component.html',
  styleUrls: ['./product-image-upload.component.scss']
})
export class ProductImageUploadComponent {
  @Input() productId!: string;
  @Output() imageUploaded = new EventEmitter<ProductImageUploadResponse>();
  @Output() uploadError = new EventEmitter<string>();

  private productService = inject(ProductService);

  uploading = false;
  uploadProgress = 0;
  errorMessage: string | null = null;
  previewUrl: string | null = null;

  // Constantes de validação (devem bater com o backend)
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Reset
    this.errorMessage = null;
    this.previewUrl = null;

    // Validar tipo
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      this.errorMessage = 'Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.';
      this.uploadError.emit(this.errorMessage);
      input.value = ''; // Reset input
      return;
    }

    // Validar tamanho
    if (file.size > this.MAX_FILE_SIZE) {
      this.errorMessage = `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 5MB.`;
      this.uploadError.emit(this.errorMessage);
      input.value = '';
      return;
    }

    // Preview local
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);

    // Upload
    this.upload(file);

    // Reset input para permitir re-upload do mesmo arquivo
    input.value = '';
  }

  private upload(file: File): void {
    this.uploading = true;
    this.uploadProgress = 0;

    this.productService.uploadImage(this.productId, file).subscribe({
      next: (response) => {
        this.uploading = false;
        this.previewUrl = null;
        this.imageUploaded.emit(response);
      },
      error: (err) => {
        this.uploading = false;
        this.previewUrl = null;
        this.errorMessage = err.message || 'Erro ao enviar imagem. Tente novamente.';
        this.uploadError.emit(this.errorMessage!);
      }
    });
  }
}

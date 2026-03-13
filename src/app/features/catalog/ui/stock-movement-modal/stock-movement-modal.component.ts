import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../data-access';
import { StockMovementType } from '../../data-access/stock-movement.models';
import { ToastService } from '../../../../shared/services/toast.service';
import { PaymentMethod } from '../../../sales/data-access/sales.models';

export interface StockMovementFormData {
  type: StockMovementType;
  quantity: number;
  adjustmentMode: 'increase' | 'decrease';
  observation?: string;
  paymentMethod?: PaymentMethod;
}

@Component({
  selector: 'app-stock-movement-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-movement-modal.component.html',
})
export class StockMovementModalComponent implements OnInit {
  @Input() product!: Product;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<StockMovementFormData>();

  private toast = inject(ToastService);

  isOpen = signal(false);
  saving = signal(false);

  // Form fields
  type = signal<StockMovementType>('ENTRADA');
  quantity = signal<number>(1);
  adjustmentMode = signal<'increase' | 'decrease'>('increase');
  observation = signal<string>('');
  paymentMethod = signal<PaymentMethod>('PIX');

  readonly paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
    { value: 'PIX', label: 'PIX' },
    { value: 'CARTAO', label: 'Cartão' },
    { value: 'DINHEIRO', label: 'Dinheiro' },
    { value: 'TRANSFERENCIA', label: 'Transferência' },
    { value: 'OUTRO', label: 'Outro' },
  ];

  readonly typeOptions: Array<{ value: StockMovementType; label: string; description: string }> = [
    { value: 'ENTRADA', label: 'Entrada', description: 'Adicionar produtos ao estoque' },
    { value: 'VENDA', label: 'Venda', description: 'Remover produtos por venda' },
    { value: 'AJUSTE', label: 'Ajuste', description: 'Corrigir quantidade (aumentar ou diminuir)' },
  ];

  ngOnInit(): void {
    // Abre o modal automaticamente
    setTimeout(() => this.isOpen.set(true), 10);
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as StockMovementType;
    this.type.set(value);
  }

  onQuantityChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.quantity.set(isNaN(value) ? 0 : value);
  }

  onAdjustmentModeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'increase' | 'decrease';
    this.adjustmentMode.set(value);
  }

  onObservationChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.observation.set(value);
  }

  onPaymentMethodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as PaymentMethod;
    this.paymentMethod.set(value);
  }

  onCancel(): void {
    this.isOpen.set(false);
    setTimeout(() => this.close.emit(), 200);
  }

  onSave(): void {
    // Validação: quantidade deve ser > 0
    if (this.quantity() <= 0) {
      this.toast.showError('A quantidade deve ser maior que zero');
      return;
    }

    const type = this.type();
    const quantity = this.quantity();

    // Validação: VENDA ou AJUSTE-diminuir não pode ser maior que disponível
    if (type === 'VENDA' || (type === 'AJUSTE' && this.adjustmentMode() === 'decrease')) {
      if (quantity > this.product.quantityAvailable) {
        this.toast.showError(
          `Estoque insuficiente. Disponível: ${this.product.quantityAvailable}`
        );
        return;
      }
    }

    this.saving.set(true);

    const formData: StockMovementFormData = {
      type,
      quantity,
      adjustmentMode: this.adjustmentMode(),
      observation: this.observation() || undefined,
      paymentMethod: type === 'VENDA' ? this.paymentMethod() : undefined,
    };

    this.save.emit(formData);
  }

  getTypeDescription(): string {
    const option = this.typeOptions.find((opt) => opt.value === this.type());
    return option?.description || '';
  }

  canSave(): boolean {
    return this.quantity() > 0 && !this.saving();
  }
}

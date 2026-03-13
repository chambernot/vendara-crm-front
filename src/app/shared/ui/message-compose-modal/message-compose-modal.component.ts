import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageStore } from '../../../features/messages/data-access/message.store';
import { CreateMessageDto } from '../../../features/messages/data-access/message.models';
import { SimulatorWhatsAppProvider } from '../../../core/whatsapp-api/simulator-whatsapp-provider.service';

@Component({
  selector: 'app-message-compose-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message-compose-modal.component.html',
})
export class MessageComposeModalComponent {
  private messageStore = inject(MessageStore);
  private simulatorProvider = inject(SimulatorWhatsAppProvider);

  @Input() clientId!: string;
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() messageSent = new EventEmitter<string>();

  textPreview = signal('');
  templateId = signal('');
  provider = signal<'simulator'>('simulator');
  sending = signal(false);

  providers = [
    { value: 'simulator', label: 'Simulador' },
  ];

  onTextChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.textPreview.set(textarea.value);
  }

  onTemplateIdChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.templateId.set(input.value);
  }

  onProviderChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.provider.set(select.value as 'simulator');
  }

  onClose(): void {
    this.close.emit();
    this.reset();
  }

  async onSend(): Promise<void> {
    const text = this.textPreview().trim();
    
    if (!text) {
      alert('Digite uma mensagem');
      return;
    }

    if (!this.clientId) {
      alert('Cliente não identificado');
      return;
    }

    this.sending.set(true);

    try {
      const dto: CreateMessageDto = {
        clientId: this.clientId,
        channel: 'whatsapp',
        provider: this.provider(),
        direction: 'outbound',
        text: text,
        textPreview: text,
        templateId: this.templateId() || undefined,
      };

      const message = this.messageStore.create(dto);

      // Usa o SimulatorWhatsAppProvider para simular o envio com transições realistas
      if (this.provider() === 'simulator') {
        await this.simulatorProvider.simulateSend(message.id);
      } else {
        // TODO: Implementar envio real via Meta API
        console.warn('Envio via Meta ainda não implementado');
      }

      this.messageSent.emit(message.id);
      this.onClose();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      this.sending.set(false);
    }
  }

  private reset(): void {
    this.textPreview.set('');
    this.templateId.set('');
    this.provider.set('simulator');
    this.sending.set(false);
  }
}

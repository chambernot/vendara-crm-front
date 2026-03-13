import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * Evento interno do barramento
 */
interface BusEvent {
  key: string;
  payload?: any;
}

/**
 * Serviço global de barramento de eventos.
 *
 * Permite comunicação desacoplada entre componentes/features
 * sem criar dependências circulares.
 *
 * Uso:
 *   // Emitir
 *   eventBus.emit('followUpUpdated');
 *
 *   // Escutar
 *   eventBus.on('followUpUpdated').subscribe(() => { ... });
 */
@Injectable({
  providedIn: 'root',
})
export class EventBusService implements OnDestroy {
  private bus$ = new Subject<BusEvent>();

  /**
   * Emite um evento global com chave e payload opcional.
   */
  emit(key: string, payload?: any): void {
    this.bus$.next({ key, payload });
  }

  /**
   * Retorna um Observable que emite apenas quando a chave corresponde.
   */
  on<T = void>(key: string): Observable<T> {
    return this.bus$.asObservable().pipe(
      filter((e) => e.key === key),
      map((e) => e.payload as T),
    );
  }

  ngOnDestroy(): void {
    this.bus$.complete();
  }
}

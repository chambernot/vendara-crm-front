import { inject, Injectable } from '@angular/core';
import { Observable, of, delay, map, combineLatest, throwError } from 'rxjs';
import { Consignation, ConsignationListItemVm, ConsignationDetailVm, ConsignationStatus } from './consignations.models';
import { ClientsStore } from '../../clients/data-access/clients.store';
import { CatalogStore } from '../../catalog/data-access/catalog.store';
import { StorageService, STORAGE_KEYS } from '../../../core/storage';
import { TelemetryService } from '../../../core/telemetry';
import { environment } from '../../../../environments/environment';

/**
 * Seed inicial de consignações (apenas primeiro uso)
 */
function seedConsignations(): Consignation[] {
  return [
    {
      id: '1',
      clientId: '1',
      productId: '2',
      status: 'open',
      startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expectedReturnAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Cliente quer avaliar com calma antes de decidir'
    },
    {
      id: '2',
      clientId: '3',
      productId: '6',
      status: 'open',
      startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Presente para aniversário da filha'
    },
    {
      id: '3',
      clientId: '6',
      productId: '11',
      status: 'open',
      startedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      expectedReturnAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Aliança de casamento, aguardando confirmação da noiva'
    },
    {
      id: '4',
      clientId: '1',
      productId: '3',
      status: 'sold',
      startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      salePrice: 120,
      notes: 'Comprou para dar de presente'
    },
    {
      id: '5',
      clientId: '4',
      productId: '8',
      status: 'returned',
      startedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      closedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Cliente não se interessou pelo produto'
    }
  ];
}

@Injectable({
  providedIn: 'root'
})
export class ConsignationsStore {
  private storage = inject(StorageService);
  private clientsStore = inject(ClientsStore);
  private catalogStore = inject(CatalogStore);
  private telemetryService = inject(TelemetryService);

  // Consignations vem do LocalStorage (ou seed se habilitado e vazio)
  private get consignations(): Consignation[] {
    const stored = this.storage.get<Consignation[]>(STORAGE_KEYS.consignations);
    
    // Se existe dados, retorna
    if (stored && stored.length > 0) {
      return stored;
    }
    
    // Se não existe E seed está habilitado, aplica seed
    if (environment.enableSeedData) {
      const seeded = seedConsignations();
      this.storage.set(STORAGE_KEYS.consignations, seeded);
      return seeded;
    }
    
    // Sistema inicia vazio
    return [];
  }

  private set consignations(value: Consignation[]) {
    this.storage.set(STORAGE_KEYS.consignations, value);
  }

  list(): Observable<ConsignationListItemVm[]> {
    return combineLatest([
      of(this.consignations),
      this.clientsStore.getClients(),
      this.catalogStore.getProducts()
    ]).pipe(
      delay(200),
      map(([consignations, clients, products]) => {
        return consignations.map(consignation => {
          const client = clients.find(c => c.id === consignation.clientId);
          const product = products.find(p => p.id === consignation.productId);
          
          const daysOpen = consignation.closedAt 
            ? Math.floor((new Date(consignation.closedAt).getTime() - new Date(consignation.startedAt).getTime()) / (1000 * 60 * 60 * 24))
            : Math.floor((Date.now() - new Date(consignation.startedAt).getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: consignation.id,
            status: consignation.status,
            startedAt: consignation.startedAt,
            daysOpen,
            clientName: client?.name || 'Cliente desconhecido',
            clientScore: client?.score,
            productName: product?.name || 'Produto desconhecido',
            productPrice: product?.price || 0
          };
        });
      })
    );
  }

  getById(id: string): Observable<ConsignationDetailVm | null> {
    const consignation = this.consignations.find(c => c.id === id);
    if (!consignation) {
      return of(null).pipe(delay(200));
    }

    return combineLatest([
      this.clientsStore.getClients(),
      this.catalogStore.getProducts()
    ]).pipe(
      delay(200),
      map(([clients, products]) => {
        const client = clients.find(c => c.id === consignation.clientId);
        const product = products.find(p => p.id === consignation.productId);

        if (!client || !product) {
          return null;
        }

        const daysOpen = consignation.closedAt 
          ? Math.floor((new Date(consignation.closedAt).getTime() - new Date(consignation.startedAt).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - new Date(consignation.startedAt).getTime()) / (1000 * 60 * 60 * 24));

        return {
          consignation,
          client: {
            id: client.id,
            name: client.name,
            whatsapp: client.whatsapp,
            score: client.score
          },
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            status: product.status,
            material: product.material,
            type: product.type
          },
          daysOpen
        };
      })
    );
  }

  create(input: { 
    clientId: string; 
    productId: string; 
    notes?: string; 
    expectedReturnAt?: string;
  }): Observable<string> {
    return this.catalogStore.getProduct(input.productId).pipe(
      delay(200),
      map(product => {
        if (!product) {
          throw new Error('Produto não encontrado');
        }

        if (product.status !== 'available') {
          throw new Error('Produto não está disponível para consignação');
        }

        const consignations = this.consignations;
        const newId = String(consignations.length + 1);
        const newConsignation: Consignation = {
          id: newId,
          clientId: input.clientId,
          productId: input.productId,
          status: 'open',
          startedAt: new Date().toISOString(),
          expectedReturnAt: input.expectedReturnAt,
          notes: input.notes
        };

        this.consignations = [...consignations, newConsignation]; // Persiste

        // Atualizar status do produto para consigned
        this.catalogStore.setStatus(input.productId, 'consigned').subscribe();

        // Log telemetry
        try {
          this.telemetryService.log('consignation_created', { 
            consignationId: newId, 
            clientId: input.clientId, 
            productId: input.productId 
          });
        } catch {
          // Silent fail
        }

        return newId;
      })
    );
  }

  markSold(id: string, salePrice?: number): Observable<void> {
    return of(void 0).pipe(
      delay(200),
      map(() => {
        const consignations = this.consignations;
        const consignation = consignations.find(c => c.id === id);
        if (!consignation) {
          throw new Error('Consignação não encontrada');
        }

        if (consignation.status !== 'open') {
          throw new Error('Apenas consignações abertas podem ser marcadas como vendidas');
        }

        consignation.status = 'sold';
        consignation.closedAt = new Date().toISOString();
        if (salePrice !== undefined) {
          consignation.salePrice = salePrice;
        }

        this.consignations = consignations; // Persiste

        // Atualizar status do produto para sold
        this.catalogStore.setStatus(consignation.productId, 'sold').subscribe();

        // Log telemetry
        try {
          this.telemetryService.log('consignation_sold', { consignationId: id });
        } catch {
          // Silent fail
        }
      })
    );
  }

  markReturned(id: string): Observable<void> {
    return of(void 0).pipe(
      delay(200),
      map(() => {
        const consignations = this.consignations;
        const consignation = consignations.find(c => c.id === id);
        if (!consignation) {
          throw new Error('Consignação não encontrada');
        }

        if (consignation.status !== 'open') {
          throw new Error('Apenas consignações abertas podem ser marcadas como devolvidas');
        }

        consignation.status = 'returned';
        consignation.closedAt = new Date().toISOString();

        this.consignations = consignations; // Persiste

        // Atualizar status do produto para available
        this.catalogStore.setStatus(consignation.productId, 'available').subscribe();

        // Log telemetry
        try {
          this.telemetryService.log('consignation_returned', { consignationId: id });
        } catch {
          // Silent fail
        }
      })
    );
  }
}

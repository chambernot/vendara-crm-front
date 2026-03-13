import { Injectable } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import { ReportsSummary } from './reports.models';
import { ClientsStore } from '../../clients/data-access/clients.store';
import { CatalogStore } from '../../catalog/data-access/catalog.store';
import { ConsignationsStore } from '../../consignations/data-access/consignations.store';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  constructor(
    private clientsStore: ClientsStore,
    private catalogStore: CatalogStore,
    private consignationsStore: ConsignationsStore
  ) {}

  getSummary(): Observable<ReportsSummary> {
    return combineLatest([
      this.clientsStore.getClients(),
      this.catalogStore.getProducts(),
      this.consignationsStore.list()
    ]).pipe(
      map(([clients, products, consignations]) => {
        // Contagem de consignações por status
        const openConsignations = consignations.filter(c => c.status === 'open').length;
        const soldConsignations = consignations.filter(c => c.status === 'sold').length;
        const returnedConsignations = consignations.filter(c => c.status === 'returned').length;

        // Valor total em consignações abertas
        const openConsignationsValue = consignations
          .filter(c => c.status === 'open')
          .reduce((sum, c) => sum + c.productPrice, 0);

        // Valor total do catálogo disponível
        const totalCatalogValueAvailable = products
          .filter(p => p.status === 'available')
          .reduce((sum, p) => sum + p.price, 0);

        // Top 5 produtos mais parados
        const productsStoppedTop = products
          .filter(p => p.status === 'available') // apenas produtos disponíveis
          .sort((a, b) => b.daysStopped - a.daysStopped)
          .slice(0, 5)
          .map(p => ({
            id: p.id,
            name: p.name,
            daysStopped: p.daysStopped,
            price: p.price
          }));

        // Top 5 clientes com maior score
        const clientsTopScore = clients
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(c => ({
            id: c.id,
            name: c.name,
            score: c.score
          }));

        return {
          openConsignations,
          soldConsignations,
          returnedConsignations,
          openConsignationsValue,
          totalCatalogValueAvailable,
          productsStoppedTop,
          clientsTopScore
        };
      })
    );
  }
}

export interface ReportsSummary {
  openConsignations: number;
  soldConsignations: number;
  returnedConsignations: number;
  openConsignationsValue: number;     // soma do preço do produto nas consignações open
  totalCatalogValueAvailable: number; // soma do preço dos produtos available
  productsStoppedTop: { id: string; name: string; daysStopped: number; price: number }[];
  clientsTopScore: { id: string; name: string; score: number }[];
}

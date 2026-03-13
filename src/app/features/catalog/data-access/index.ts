export * from './catalog.models';
export * from './catalog.store';
export * from './product.service';
export * from './product.service';
export * from './stock-movement.models';
// stock-movement.service não é exportado aqui para evitar dependência circular
// Importe diretamente: import { StockMovementService } from './data-access/stock-movement.service'

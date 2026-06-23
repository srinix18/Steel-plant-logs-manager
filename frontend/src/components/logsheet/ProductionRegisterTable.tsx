import {
  ConcastProductionTable,
  buildEmptyProductionLog,
  getProductionLogConfig,
  parseProductionLog,
  type ConcastProductionTableProps,
} from './ConcastProductionTable';

export function ProductionRegisterTable(props: ConcastProductionTableProps) {
  return <ConcastProductionTable {...props} />;
}

export { buildEmptyProductionLog, getProductionLogConfig, parseProductionLog };

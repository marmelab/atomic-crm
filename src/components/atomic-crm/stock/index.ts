import { StockLevelList } from "./StockLevelList";
import { StockMoveCreate } from "./StockMoveCreate";
import { StockMoveList } from "./StockMoveList";
import { WarehouseCreate, WarehouseEdit, WarehouseList } from "./WarehouseList";

export const stockMoves = { list: StockMoveList, create: StockMoveCreate };
export const stockLevels = { list: StockLevelList };
export const warehouses = {
  list: WarehouseList,
  create: WarehouseCreate,
  edit: WarehouseEdit,
};

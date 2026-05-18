/** Types generated for queries found in "sql/queries.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

/** 'UpsertUserItem' parameters type */
export interface IUpsertUserItemParams {
  amount: number;
  item_id: number;
  wallet: string;
}

/** 'UpsertUserItem' return type */
export type IUpsertUserItemResult = void;

/** 'UpsertUserItem' query type */
export interface IUpsertUserItemQuery {
  params: IUpsertUserItemParams;
  result: IUpsertUserItemResult;
}

const upsertUserItemIR: any = {"usedParamSet":{"wallet":true,"item_id":true,"amount":true},"params":[{"name":"wallet","required":true,"transform":{"type":"scalar"},"locs":[{"a":57,"b":64}]},{"name":"item_id","required":true,"transform":{"type":"scalar"},"locs":[{"a":67,"b":75}]},{"name":"amount","required":true,"transform":{"type":"scalar"},"locs":[{"a":78,"b":85}]}],"statement":"INSERT INTO user_items (wallet, item_id, amount)\nVALUES (:wallet!, :item_id!, :amount!)\nON CONFLICT (wallet, item_id)\nDO UPDATE SET amount = user_items.amount + EXCLUDED.amount"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO user_items (wallet, item_id, amount)
 * VALUES (:wallet!, :item_id!, :amount!)
 * ON CONFLICT (wallet, item_id)
 * DO UPDATE SET amount = user_items.amount + EXCLUDED.amount
 * ```
 */
export const upsertUserItem = new PreparedQuery<IUpsertUserItemParams,IUpsertUserItemResult>(upsertUserItemIR);


/** 'GetItemsByWallet' parameters type */
export interface IGetItemsByWalletParams {
  wallet: string;
}

/** 'GetItemsByWallet' return type */
export interface IGetItemsByWalletResult {
  amount: number;
  item_id: number;
  wallet: string;
}

/** 'GetItemsByWallet' query type */
export interface IGetItemsByWalletQuery {
  params: IGetItemsByWalletParams;
  result: IGetItemsByWalletResult;
}

const getItemsByWalletIR: any = {"usedParamSet":{"wallet":true},"params":[{"name":"wallet","required":true,"transform":{"type":"scalar"},"locs":[{"a":62,"b":69}]}],"statement":"SELECT wallet, item_id, amount\nFROM user_items\nWHERE wallet = :wallet!\nORDER BY item_id ASC"};

/**
 * Query generated from SQL:
 * ```
 * SELECT wallet, item_id, amount
 * FROM user_items
 * WHERE wallet = :wallet!
 * ORDER BY item_id ASC
 * ```
 */
export const getItemsByWallet = new PreparedQuery<IGetItemsByWalletParams,IGetItemsByWalletResult>(getItemsByWalletIR);


/** 'GetAllItems' parameters type */
export type IGetAllItemsParams = void;

/** 'GetAllItems' return type */
export interface IGetAllItemsResult {
  amount: number;
  item_id: number;
  wallet: string;
}

/** 'GetAllItems' query type */
export interface IGetAllItemsQuery {
  params: IGetAllItemsParams;
  result: IGetAllItemsResult;
}

const getAllItemsIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT wallet, item_id, amount FROM user_items ORDER BY wallet, item_id"};

/**
 * Query generated from SQL:
 * ```
 * SELECT wallet, item_id, amount FROM user_items ORDER BY wallet, item_id
 * ```
 */
export const getAllItems = new PreparedQuery<IGetAllItemsParams,IGetAllItemsResult>(getAllItemsIR);



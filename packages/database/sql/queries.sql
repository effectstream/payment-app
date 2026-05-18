/* @name upsertUserItem */
INSERT INTO user_items (wallet, item_id, amount)
VALUES (:wallet!, :item_id!, :amount!)
ON CONFLICT (wallet, item_id)
DO UPDATE SET amount = user_items.amount + EXCLUDED.amount;

/* @name getItemsByWallet */
SELECT wallet, item_id, amount
FROM user_items
WHERE wallet = :wallet!
ORDER BY item_id ASC;

/* @name getAllItems */
SELECT wallet, item_id, amount FROM user_items ORDER BY wallet, item_id;

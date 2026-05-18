CREATE TABLE user_items (
  wallet TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (wallet, item_id)
);

CREATE INDEX idx_user_items_wallet ON user_items (wallet);

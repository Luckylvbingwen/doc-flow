-- patch-002-password-hash.sql
-- 为 doc_users 表增加 password_hash 字段，支持 per-user 密码

ALTER TABLE doc_users
  ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL COMMENT 'bcrypt 密码哈希' AFTER avatar_url;

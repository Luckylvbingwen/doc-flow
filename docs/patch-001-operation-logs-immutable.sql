-- patch-001: 操作日志不可篡改触发器（PRD §6.7）
-- 可重入：DROP IF EXISTS 保证幂等

DROP TRIGGER IF EXISTS trg_operation_logs_no_update;
CREATE TRIGGER trg_operation_logs_no_update
BEFORE UPDATE ON doc_operation_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '操作日志不可修改';
END;

DROP TRIGGER IF EXISTS trg_operation_logs_no_delete;
CREATE TRIGGER trg_operation_logs_no_delete
BEFORE DELETE ON doc_operation_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '操作日志不可删除';
END;

# 后端数据表设计指南：从 PRD 到 SQL

## 文档说明

本文档提供一套从产品需求文档（PRD）/原型出发，系统化设计数据库表结构的标准流程。适用于后端开发人员在接到需求后，快速、规范地输出建表 SQL。

---

## 设计四步法概览

| 步骤 | 任务 | 输入 | 输出 |
| :--- | :--- | :--- | :--- |
| 第一步 | 提取业务实体 | PRD 中的名词 | 表清单 |
| 第二步 | 分析实体属性 | 原型表单/列表/业务规则 | 字段清单 |
| 第三步 | 确定字段元数据 | 字段清单 + 业务约束 | 完整列定义 |
| 第四步 | 确定表间关联 | 实体关系分析 | 外键 + 索引 |

---

## 第一步：提取业务实体 → 确定"有哪些表"

### 方法

扫描 PRD 中的**核心名词**，每个独立的名词通常对应一张表。

### 判断标准

一个名词是否需要独立成表，满足以下任一条件即可：

- 有独立的生命周期（可被创建、修改、删除）
- 有独立的属性集合（包含 2 个及以上专属字段）
- 与其他实体存在业务关联

### 示例

**PRD 描述**："用户可以将多个商品加入购物车，生成订单并支付"

**提取结果**：

| 实体 | 对应表名 | 说明 |
| :--- | :--- | :--- |
| 用户 | user | 已有基础表 |
| 商品 | product | 已有基础表 |
| 购物车 | cart | 用户与商品的关联+数量 |
| 订单 | order | 订单主信息 |
| 订单明细 | order_item | 订单与商品的关联+购买信息 |

---

## 第二步：分析实体属性 → 确定"有哪些字段"

### 字段来源

| 来源 | 说明 | 示例 |
| :--- | :--- | :--- |
| 原型表单 | 输入框、下拉框、复选框 | receiver_name, payment_method |
| 原型列表 | 表格中展示的列 | order_no, total_amount, status |
| 业务规则 | 隐含需求或派生字段 | expire_time（超时自动取消） |

### 示例：订单表 order 字段提取

| 来源 | 提取字段 |
| :--- | :--- |
| 下单用户（当前登录用户） | user_id |
| 收货地址表单 | receiver_name, receiver_phone, receiver_address |
| 支付方式下拉框 | payment_method |
| 订单列表展示 | order_no, total_amount, status, create_time |
| 业务规则：30分钟未支付自动取消 | expire_time |

---

## 第三步：确定字段元数据 → 给字段加"约束"

### 元数据项说明

| 元数据项 | 说明 | 常用值示例 |
| :--- | :--- | :--- |
| 数据类型 | 存储的数据类型 | VARCHAR, INT, BIGINT, DECIMAL, DATETIME, TEXT, LONGTEXT |
| 长度/精度 | 字符串长度或小数精度 | VARCHAR(64), DECIMAL(12,2) |
| 是否可空 | NOT NULL 或 NULL | 业务必填字段设 NOT NULL |
| 默认值 | 不传值时自动填充 | DEFAULT 0, DEFAULT CURRENT_TIMESTAMP |
| 唯一约束 | 不允许重复 | UNIQUE |
| 枚举值 | 字段的取值范围 | TINYINT + COMMENT 说明 |
| 注释 | 字段的业务含义 | COMMENT '用户手机号' |

### 示例：订单表 DDL

CREATE TABLE `order` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `order_no` VARCHAR(32) NOT NULL COMMENT '订单号',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
    `receiver_name` VARCHAR(64) NOT NULL COMMENT '收货人姓名',
    `receiver_phone` CHAR(11) NOT NULL COMMENT '收货人手机号',
    `receiver_address` VARCHAR(255) NOT NULL COMMENT '收货地址',
    `total_amount` DECIMAL(12,2) NOT NULL COMMENT '订单总金额',
    `payment_method` TINYINT NOT NULL DEFAULT 1 COMMENT '支付方式：1-微信 2-支付宝 3-银行卡',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '订单状态：0-待支付 1-已支付 2-已发货 3-已完成 4-已取消',
    `expire_time` DATETIME NOT NULL COMMENT '订单过期时间',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_no` (`order_no`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

---

## 第四步：确定表间关联 → 设计"外键 + 索引"

### 关系类型与设计方式

| 关系类型 | 设计方式 | 示例 |
| :--- | :--- | :--- |
| 1 对 N | 在"N"的一方添加外键字段 | order.user_id → user.id |
| 1 对 1 | 任意一方添加外键 + 唯一约束 | user_account.user_id UNIQUE → user.id |
| N 对 N | 创建中间关联表 | user_role：user_id, role_id，联合唯一 |

### 示例：订单明细表（N 对 1）

CREATE TABLE `order_item` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL COMMENT '订单ID（关联order表）',
    `product_id` BIGINT UNSIGNED NOT NULL COMMENT '商品ID（关联product表）',
    `product_name` VARCHAR(255) NOT NULL COMMENT '商品名称（冗余，防止商品改名后订单里名字变化）',
    `price` DECIMAL(10,2) NOT NULL COMMENT '购买时的单价',
    `quantity` INT NOT NULL COMMENT '购买数量',
    `subtotal` DECIMAL(12,2) NOT NULL COMMENT '小计（price × quantity）',
    PRIMARY KEY (`id`),
    KEY `idx_order_id` (`order_id`),
    KEY `idx_product_id` (`product_id`)
);

---

## 完整示例：从 PRD 到 SQL

### PRD 描述

"用户可以发布文章，文章有标题、正文、分类。发布后默认为草稿状态，管理员可以审核通过。用户可以对自己发布的文章进行点赞。"

### Step 1：提取实体

- 用户（已有 user 表，本文忽略建表）
- 文章 → article
- 点赞记录 → article_like

### Step 2：提取属性

- 文章：标题、正文、分类、状态、作者ID、发布时间、更新时间、点赞数（冗余）
- 点赞记录：文章ID、用户ID、点赞时间

### Step 3 + Step 4：完整 DDL

-- 文章表
CREATE TABLE `article` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '文章ID',
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '作者ID（关联user表）',
    `title` VARCHAR(200) NOT NULL COMMENT '文章标题',
    `content` LONGTEXT NOT NULL COMMENT '正文内容',
    `category` VARCHAR(50) DEFAULT NULL COMMENT '分类',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0-草稿 1-待审核 2-已发布 3-已驳回',
    `like_count` INT NOT NULL DEFAULT 0 COMMENT '点赞数（冗余，方便列表展示）',
    `publish_time` DATETIME DEFAULT NULL COMMENT '发布时间',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_status_publish` (`status`, `publish_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章表';

-- 点赞记录表
CREATE TABLE `article_like` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `article_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL COMMENT '点赞的用户ID',
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_article_user` (`article_id`, `user_id`),
    KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章点赞记录表';

---

## 设计检查清单

设计完成后，请逐项确认：

- [ ] 每张表都有自增主键 id
- [ ] 每张表都有 create_time 和 update_time
- [ ] 字段类型选择合理（金额用 DECIMAL，手机号用 CHAR(11)，状态用 TINYINT）
- [ ] 枚举字段用 COMMENT 明确标注所有取值含义
- [ ] 唯一约束已添加（单字段或联合唯一）
- [ ] 常用查询条件已添加索引
- [ ] 冗余设计已考虑（如订单明细冗余商品名）
- [ ] 表名和字段名统一规范（蛇形命名、单数形式）

---

## 常见字段类型速查表

| 业务含义 | 推荐类型 | 示例 |
| :--- | :--- | :--- |
| 主键ID | BIGINT UNSIGNED AUTO_INCREMENT | id |
| 关联外键 | BIGINT UNSIGNED | user_id |
| 短字符串（≤255） | VARCHAR(n) | title VARCHAR(200) |
| 长文本 | TEXT / LONGTEXT | content LONGTEXT |
| 固定长度字符串 | CHAR(n) | mobile CHAR(11) |
| 金额 | DECIMAL(12,2) | price DECIMAL(10,2) |
| 数量/计数 | INT | like_count INT |
| 状态/枚举 | TINYINT + COMMENT | status TINYINT |
| 时间 | DATETIME | create_time DATETIME |
| 布尔值 | TINYINT(1) | is_deleted TINYINT(1) DEFAULT 0 |
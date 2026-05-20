import { Server } from '@hocuspocus/server';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
const JWT_SECRET = process.env.JWT_SECRET ?? 'please-set-a-strong-random-secret-here-min-32';
const PORT = parseInt(process.env.HOCUSPOCUS_PORT ?? '1234', 10);
const DATABASE_URL = process.env.DATABASE_URL ?? '';
// ─── MySQL 连接池（生产级：连接复用、超时、重试） ───
let pool;
function getPool() {
    if (!pool) {
        if (!DATABASE_URL) {
            throw new Error('[hocuspocus] DATABASE_URL 未配置');
        }
        // 从 prisma 格式 mysql://user:pass@host:port/db 解析
        const url = new URL(DATABASE_URL);
        pool = mysql.createPool({
            host: url.hostname,
            port: parseInt(url.port || '3306', 10),
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.slice(1),
            waitForConnections: true,
            connectionLimit: 10,
            idleTimeout: 60000,
            enableKeepAlive: true,
            keepAliveInitialDelay: 30000,
        });
    }
    return pool;
}
/**
 * 校验用户对文档的编辑权限
 *
 * 判定逻辑（满足任一即通过）：
 * 1. 用户是文档归属人 (owner_user_id)
 * 2. 用户在文档所属组中角色为管理员(1)或可编辑(2)
 * 3. 用户拥有文档级权限 permission <= 2 (管理员或可编辑)
 * 4. 用户是 super_admin / company_admin 角色（系统管理员穿透）
 */
async function canEditDocument(userId, documentId) {
    const db = getPool();
    // 单条 SQL，UNION 三路判定 + 系统角色 bypass，命中任一即返回
    const [rows] = await db.execute(`
    SELECT 1 AS has_access FROM doc_documents
    WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL AND doc_type = 2
    UNION ALL
    SELECT 1 FROM doc_group_members gm
    INNER JOIN doc_documents d ON d.group_id = gm.group_id
    WHERE d.id = ? AND gm.user_id = ? AND gm.deleted_at IS NULL AND gm.role IN (1, 2)
      AND d.deleted_at IS NULL AND d.doc_type = 2
    UNION ALL
    SELECT 1 FROM doc_document_permissions dp
    INNER JOIN doc_documents d ON d.id = dp.document_id
    WHERE dp.document_id = ? AND dp.user_id = ? AND dp.deleted_at IS NULL AND dp.permission <= 2
      AND d.deleted_at IS NULL AND d.doc_type = 2
    UNION ALL
    SELECT 1 FROM doc_user_roles ur
    INNER JOIN doc_roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND r.code IN ('super_admin', 'company_admin')
    LIMIT 1
  `, [documentId, userId, documentId, userId, documentId, userId, userId]);
    return rows.length > 0;
}
/**
 * 从房间名解析文档 ID
 * 格式: doc-{id}
 */
function parseDocumentId(documentName) {
    const match = documentName.match(/^doc-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
}
const MAX_CONNECTIONS = 50;
const server = Server.configure({
    port: PORT,
    timeout: 5000,
    async onAuthenticate({ token, documentName }) {
        if (!token)
            throw new Error('缺少 token');
        // 1. JWT 校验
        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        }
        catch {
            throw new Error('token 无效或已过期');
        }
        // 2. 解析文档 ID
        const documentId = parseDocumentId(documentName);
        if (!documentId) {
            throw new Error(`房间名格式错误: ${documentName}`);
        }
        // 3. 文档级编辑权限校验
        const allowed = await canEditDocument(payload.id, documentId);
        if (!allowed) {
            throw new Error('无权编辑此文档');
        }
        return { userId: payload.id, userName: payload.name };
    },
    async onConnect({ documentName, context }) {
        // 并发连接数上限
        const totalConns = Array.from(server.documents.values())
            .reduce((sum, doc) => sum + doc.getConnectionsCount(), 0);
        if (totalConns >= MAX_CONNECTIONS) {
            throw new Error('服务器连接数已达上限，请稍后再试');
        }
        const ctx = context;
        console.log(`[hocuspocus] 用户 ${ctx.userName}(${ctx.userId}) 已加入房间 ${documentName}`);
    },
    async onDisconnect({ documentName, context }) {
        const ctx = context;
        console.log(`[hocuspocus] 用户 ${ctx.userName}(${ctx.userId}) 已离开房间 ${documentName}`);
    },
});
// ─── 内部管理 HTTP 端点（Docker 网络内部通信） ───
import { createServer } from 'node:http';
const INTERNAL_SECRET = process.env.HOCUSPOCUS_INTERNAL_SECRET ?? JWT_SECRET;
const MGMT_PORT = parseInt(process.env.HOCUSPOCUS_MGMT_PORT ?? '1235', 10);
const mgmtServer = createServer(async (req, res) => {
    // POST /close-room  body: { documentName, reason? }
    if (req.method === 'POST' && req.url === '/close-room') {
        // 验证内部密钥
        const authHeader = req.headers['x-internal-secret'];
        if (authHeader !== INTERNAL_SECRET) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '未授权' }));
            return;
        }
        let body = '';
        for await (const chunk of req)
            body += chunk;
        try {
            const { documentName, reason } = JSON.parse(body);
            if (!documentName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'documentName 必填' }));
                return;
            }
            // 获取该文档的所有连接并逐一关闭
            const connections = server.documents.get(documentName);
            const closedCount = connections?.getConnectionsCount() ?? 0;
            if (connections) {
                connections.getConnections().forEach((conn) => {
                    conn.close();
                });
                // 从内存中卸载文档
                server.documents.delete(documentName);
            }
            console.log(`[hocuspocus] 房间 ${documentName} 已关闭(${closedCount} 个连接)，原因: ${reason ?? '未知'}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, closedCount }));
        }
        catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '请求体解析失败' }));
        }
        return;
    }
    // GET /health
    if (req.method === 'GET' && req.url === '/health') {
        const docCount = server.documents.size;
        const connCount = Array.from(server.documents.values())
            .reduce((sum, doc) => sum + doc.getConnectionsCount(), 0);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', documents: docCount, connections: connCount }));
        return;
    }
    res.writeHead(404);
    res.end();
});
server.listen().then(() => {
    console.log(`[hocuspocus] 协同服务已启动，端口 ${PORT}`);
    mgmtServer.listen(MGMT_PORT, () => {
        console.log(`[hocuspocus] 管理端点已启动，端口 ${MGMT_PORT}`);
    });
});

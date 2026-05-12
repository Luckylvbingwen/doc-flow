import { Server } from '@hocuspocus/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET ?? 'please-set-a-strong-random-secret-here-min-32'
const PORT = parseInt(process.env.HOCUSPOCUS_PORT ?? '1234', 10)

interface JwtPayload { id: number; name: string }

const server = Server.configure({
  port: PORT,

  async onAuthenticate({ token }) {
    if (!token) throw new Error('缺少 token')
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
      return { userId: payload.id, userName: payload.name }
    } catch {
      throw new Error('token 无效')
    }
  },

  async onConnect({ documentName, context }) {
    console.log(`[hocuspocus] ${(context as { userName: string }).userName} → 房间 ${documentName}`)
  },
})

server.listen().then(() => {
  console.log(`[hocuspocus] 协同服务已启动，端口 ${PORT}`)
})

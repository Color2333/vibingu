/**
 * SSE 流式代理 Route Handler
 * 
 * 为什么需要这个：Next.js 的 rewrites() 代理会缓冲整个响应体，
 * 无法实时传递 SSE 事件。这里用 Route Handler 手动代理，
 * 通过 ReadableStream 实现真正的逐事件流式传输。
 */

import { NextRequest } from 'next/server';

// 后端地址（服务端变量，不暴露到客户端）
const BACKEND_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export const runtime = 'nodejs';
// 禁用 body 自动解析，我们要原样转发 FormData
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 读取原始 FormData 并转发给后端
    const formData = await request.formData();

    // 转发认证头（如果有）
    const headers: Record<string, string> = {};
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // 调用后端 SSE 端点
    const backendResponse = await fetch(`${BACKEND_URL}/api/feed/stream`, {
      method: 'POST',
      body: formData,
      headers,
      // @ts-expect-error Node.js fetch supports duplex
      duplex: 'half',
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => '');
      return new Response(errorText || 'Backend error', {
        status: backendResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!backendResponse.body) {
      return new Response(
        JSON.stringify({ detail: '后端未返回响应流' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 将后端的 SSE 流直接透传给浏览器
    // 使用 TransformStream 确保每个 chunk 立即 flush
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // 在后台持续读取后端流并逐块写入客户端
    (async () => {
      const reader = backendResponse.body!.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (err) {
        console.error('[SSE Proxy] Stream error:', err);
      } finally {
        try { writer.close(); } catch { /* ignore */ }
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[SSE Proxy] Error:', err);
    return new Response(
      JSON.stringify({ detail: '代理连接失败' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

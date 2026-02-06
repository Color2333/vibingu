/**
 * Chat SSE 流式代理 Route Handler
 * 
 * Next.js 的 rewrites() 代理会缓冲整个响应体，
 * 导致流式输出变成"等半天一次性出来"。
 * 这里用 Route Handler 手动代理，实现逐 token 流式传输。
 */

import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 读取 JSON body 并转发
    const body = await request.text();

    // 转发请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/chat/stream`, {
      method: 'POST',
      body,
      headers,
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

    // 将后端 SSE 流直接透传给浏览器
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      const reader = backendResponse.body!.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (err) {
        console.error('[Chat SSE Proxy] Stream error:', err);
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
    console.error('[Chat SSE Proxy] Error:', err);
    return new Response(
      JSON.stringify({ detail: '代理连接失败' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

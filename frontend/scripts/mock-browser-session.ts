import { NextRequest } from "next/server";

type AuthRoute = typeof import("../src/app/api/auth/[action]/route");

/** Run client API calls against the real Next auth route with a small cookie jar. */
export async function withMockBrowserSession<T>(run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const priorMockFlag = process.env.NEXT_PUBLIC_USE_MOCK;
  process.env.NEXT_PUBLIC_USE_MOCK = "true";
  const route: AuthRoute = await import("../src/app/api/auth/[action]/route");
  const { SESSION_COOKIE_NAME } = await import("../src/lib/session-constants");
  let cookie: string | null = null;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
      dispatchEvent: () => true,
    },
  });
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost:3000");
    if (!url.pathname.startsWith("/api/auth/")) return originalFetch(input, init);
    const action = url.pathname.split("/").at(-1) ?? "";
    const headers = new Headers(init?.headers);
    if (cookie) headers.set("cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
    const request = new NextRequest(url, {
      method: init?.method ?? "GET",
      headers,
      ...(init?.body === undefined || init.body === null ? {} : { body: init.body as BodyInit }),
    });
    const context = { params: Promise.resolve({ action }) };
    const response = init?.method === "DELETE"
      ? await route.DELETE(request, context)
      : init?.method === "GET"
        ? await route.GET(request, context)
        : await route.POST(request, context);
    const session = response.cookies.get(SESSION_COOKIE_NAME);
    if (session?.maxAge === 0) cookie = null;
    else if (session?.value) cookie = session.value;
    return new Response(await response.text(), { status: response.status, headers: response.headers });
  };

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (priorMockFlag === undefined) delete process.env.NEXT_PUBLIC_USE_MOCK;
    else process.env.NEXT_PUBLIC_USE_MOCK = priorMockFlag;
  }
}

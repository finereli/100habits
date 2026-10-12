import { Router } from '$shared/lib/router.svelte'

export type Route = { view: 'home' } | { view: 'about' } | { view: 'habit'; id: string }

export const router = new Router<Route>({
  home: '/',
  parse(path) {
    const h = path.match(/^\/h\/([\w-]+)$/)
    if (h) return { view: 'habit', id: h[1] }
    if (path === '/about') return { view: 'about' }
    return { view: 'home' }
  },
})

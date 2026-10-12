// Who is signed in, via login.finereli.com (shared/lib/finereli-login.ts).
// Signing in is optional: the app works the same signed out, and signing in
// only adds sync.

import { FinereliLogin, type LoginUser } from '$shared/lib/finereli-login'

export const login = new FinereliLogin({ storageKey: '100shots.login' })

class Account {
  user = $state<LoginUser | null>(login.user)
  constructor() {
    login.onChange((u) => (this.user = u))
  }
}

export const account = new Account()

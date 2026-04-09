# CDR App — Web (Next.js)

Frontend que substitui o sidebar do Apps Script. Login Supabase + form de registro.

## Como rodar local

```bash
cd output/cdr-app/web
npm install      # já feito no scaffold
npm run dev
```

Abre em http://localhost:3000 — vai redirecionar pra `/login`.

## Variáveis de ambiente

`.env.local` (já criado):

```
NEXT_PUBLIC_SUPABASE_URL=https://lhjhsuwwbfkzvgmtzmrj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

## Estrutura

```
src/
├── middleware.ts                 # Protege rotas (redireciona pro /login)
├── lib/supabase/
│   ├── client.ts                 # Browser client
│   ├── server.ts                 # Server client (RSC + actions)
│   └── middleware.ts             # Refresh de sessão no edge
└── app/
    ├── layout.tsx
    ├── page.tsx                  # → redirect /novo
    ├── login/
    │   └── page.tsx              # Form de login
    └── novo/
        ├── page.tsx              # Server component (busca o sdr)
        ├── form.tsx              # Client component (form interativo)
        └── actions.ts            # Server action: addRegistro, signOut
```

## Próximos passos

- Tela `/bi`
- Tela `/frio-quente`
- Deploy Vercel

Déploiement Supabase + Vercel
==============================

1) Migration SQL
   - Ouvre Supabase → SQL Editor, colle le fichier supabase/migrations/001_multiplayer.sql, Exécuter.
   - OU ajoute DATABASE_URL (Settings → Database → URI) dans .env.local puis : npm run db:apply

2) Vercel (variables d’environnement)
   - Projet → Settings → Environment Variables
   - Ajoute NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (mêmes valeurs que .env.local)
   - Environnements : Production, Preview, Development
   - Redéploie.

3) Lier la CLI (optionnel)
   - npx vercel link
   - Puis : npx vercel env add NEXT_PUBLIC_SUPABASE_URL production --value "..." --yes

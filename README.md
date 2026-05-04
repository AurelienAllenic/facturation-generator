# FacturaPro

Application web de gestion de factures moderne, construite avec React, Vite et Tailwind CSS.

![FacturaPro](https://img.shields.io/badge/React-19-61dafb?logo=react) ![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss) ![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript)

---

## Fonctionnalités

- **Création de factures** : formulaire complet avec infos émetteur, client, liste d'articles dynamique
- **Calculs automatiques** : total HT, TVA optionnelle (taux paramétrable), total TTC en temps réel
- **TVA non applicable** : mention légale *art. 293 B du CGI* ajoutée automatiquement si TVA désactivée
- **Numérotation automatique** : format `FAC-ANNÉE-0001`, incrémentée à chaque nouvelle facture
- **Statuts** : Brouillon / Envoyée / Payée avec badges colorés
- **Aperçu & impression** : rendu fidèle de la facture, export PDF via `window.print()` avec styles `@media print` dédiés
- **Historique** : toutes les factures accessibles depuis la barre latérale et le tableau de bord
- **Persistance** : données sauvegardées dans le `localStorage` — survivent aux rafraîchissements et fermetures
- **Design responsive** : sidebar masquée en menu burger sous 768 px, cartes adaptées sur mobile
- **Multi-devises** : EUR, USD, GBP, CHF

---

## Stack technique

| Outil | Rôle |
|---|---|
| [React 19](https://react.dev) | UI & gestion d'état (`useState`, `useEffect`) |
| [Vite 8](https://vite.dev) | Bundler & serveur de développement |
| [Tailwind CSS 4](https://tailwindcss.com) | Stylisation utilitaire |
| [TypeScript 6](https://www.typescriptlang.org) | Typage statique |
| `localStorage` | Persistance des données côté client |

---

## Structure du projet

```
src/
├── types/
│   └── invoice.ts          # Interfaces TypeScript (Invoice, InvoiceItem, InvoiceParty)
├── utils/
│   └── calculations.ts     # Calculs HT/TVA/TTC, formatage, génération d'IDs
├── hooks/
│   └── useInvoices.ts      # Hook personnalisé — lecture/écriture LocalStorage
├── components/
│   ├── Sidebar.tsx          # Navigation latérale avec liste des factures
│   ├── Dashboard.tsx        # Tableau de bord (stats + liste complète)
│   ├── InvoiceForm.tsx      # Formulaire de création / modification
│   └── InvoicePreview.tsx   # Aperçu imprimable de la facture
├── App.tsx                  # Orchestration des vues
├── main.tsx                 # Point d'entrée React
├── index.css               # Tailwind + variables CSS + styles @media print
└── vite-env.d.ts           # Types Vite (CSS imports, etc.)
```

---

## Installation & lancement

### Prérequis

- [Node.js](https://nodejs.org) **v18+**
- [npm](https://npmjs.com) v9+ (inclus avec Node)

### Cloner et démarrer

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-utilisateur/facturation-generator.git
cd facturation-generator

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

L'application est accessible sur **http://localhost:5173**

### Autres commandes

```bash
# Build de production
npm run build

# Prévisualiser le build de production localement
npm run preview
```

---

## Déploiement sur Vercel

Le fichier `vercel.json` est déjà inclus et configure le routage SPA (redirection vers `index.html`).

```bash
# Via la CLI Vercel
npm i -g vercel
vercel
```

Ou connectez simplement le dépôt GitHub à [vercel.com](https://vercel.com) — le build se lance automatiquement.

---

## Utilisation

### Créer une facture

1. Cliquez sur **Nouvelle facture** (sidebar ou tableau de bord)
2. Renseignez les informations de l'émetteur et du client
3. Ajoutez vos articles avec description, quantité et prix unitaire
4. Activez ou désactivez la TVA selon votre situation
5. Ajoutez des notes ou conditions de paiement si nécessaire
6. Cliquez sur **Aperçu** pour visualiser, ou **Finaliser & Envoyer** pour sauvegarder

### Exporter en PDF

Depuis l'aperçu, cliquez sur **Imprimer / PDF** — la boîte de dialogue d'impression du navigateur s'ouvre. Choisissez *Enregistrer en PDF* comme destination.

### Marquer une facture comme payée

Depuis l'aperçu d'une facture envoyée, cliquez sur **Marquer payée ✓**.

---

## Licence

MIT — libre d'utilisation, de modification et de distribution.

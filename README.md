# 🕸️ Trust Circles | On-chain crowdlending & mutual insurance

**Trust Circles** is a decentralized collaborative finance protocol built for **Aleph Hackathon 2026**. Communities create shared capital pools for peer-to-peer lending (crowdlending) or mutual coverage (insurance), governed entirely by smart contracts on **Avalanche Fuji**.

**Team:** Favio Montealegre, Ingrid Orellana · Cochabamba, Bolivia 🇧🇴

---

## 🇺🇸 English

### 🌟 Vision: trust-based credit & coverage

Traditional credit is often exclusive and slow. **Trust Circles** decentralizes risk and lowers the barrier to capital in Web3:

- **Digital mutualism** — groups align around a shared financial goal or risk.
- **Reputation as signal** — successful cycles strengthen an on-chain **reputation score**, turning social trust into a verifiable financial signal.

### 🚀 Live demo & on-chain addresses

The **live web app** and **demo recording** are provided with our **Aleph Hackathon 2026** submission (Vercel + video link).

| Resource | Details |
| -------- | ------- |
| **Web application** | Avalanche Fuji · Next.js dApp (submission materials) |
| **TrustCircleFactory (Fuji)** | `0x5dFB63e77BE1346761Cd20fBa9c23551f3DE9A36` |
| **ReputationManager (Fuji)** | `0xF0F8634CEB71ee407C9ebE5F510dA92d252653f8` |

_Addresses are also in `deployments/fuji.json` at the repository root._

### 🛠️ Tech stack

- **Chain:** Avalanche Fuji testnet (sub-second finality).
- **Contracts:** factory pattern; independent `TrustCircle.sol` instances per circle.
- **Frontend:** Next.js (App Router), Tailwind CSS, Shadcn/UI.
- **Web3:** Wagmi v2, Viem, RainbowKit.

### 🏗️ Protocol overview

1. **Dynamic factory** — deploys parameterized circle contracts (e.g. minimum contribution).
2. **Governance tiers** — trust level adjusts quorum (e.g. 50%–80%) and voting windows.
3. **Automated execution** — funds move only after on-chain approval from circle members.

### 📦 Run locally

The repository is a **monorepo**. The dApp is in `UI/trust-circles-fe`.

**Requirements:** Node.js 18+, npm or pnpm, a wallet on **Avalanche Fuji**.

From the repository root (after cloning from GitHub):

```bash
cd UI/trust-circles-fe
npm install
```

Create `UI/trust-circles-fe/.env.local` with a [WalletConnect Cloud](https://cloud.walletconnect.com/) project ID:

```env
NEXT_PUBLIC_WC_PROJECT_ID=<your_project_id>
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Production (Vercel):** set **Root Directory** to `UI/trust-circles-fe` and configure the same `NEXT_PUBLIC_*` environment variables in the project settings.

### 🧪 How to exercise the flow (crowdlending)

1. **Wallet A** — connect and create a new circle via the factory.
2. **Wallet B** (separate browser or incognito) — connect and **contribute** AVAX to the pool.
3. **Wallet B** — submit a **funds request** (loan or insurance-style claim).
4. **Wallet A** — vote in favor and **execute** once quorum is met.

### 🧠 Engineering highlights & future work

- **Next.js + Web3** — wallet UI runs on the client to avoid hydration mismatches and keep connections stable in production.
- **Repayment model (v2)** — repayments are currently reflected through contributions; a dedicated debt ledger and automated reputation rules for defaults are planned.
- **Avalanche scale-out** — a dedicated **Subnet** could support privacy-sensitive circles (e.g. ZK-oriented designs) and optional custom gas tokens.

---

## 🇪🇸 Español

### 🌟 Visión: crédito y cobertura basados en confianza

El crédito tradicional suele ser excluyente y lento. **Trust Circles** descentraliza el riesgo y acerca el capital en Web3:

- **Mutualismo digital** — grupos alineados con una meta financiera o un riesgo común.
- **Reputación como señal** — los ciclos exitosos refuerzan un **reputation score** on-chain y convierten la confianza social en una señal verificable.

### 🚀 Demo en vivo y direcciones on-chain

La **aplicación desplegada** y la **grabación de demo** se entregan con la **postulación al Hackathon Aleph 2026** (Vercel + enlace de video).

| Recurso | Detalle |
| ------- | ------- |
| **Aplicación web** | Avalanche Fuji · dApp Next.js (materiales de envío) |
| **TrustCircleFactory (Fuji)** | `0x5dFB63e77BE1346761Cd20fBa9c23551f3DE9A36` |
| **ReputationManager (Fuji)** | `0xF0F8634CEB71ee407C9ebE5F510dA92d252653f8` |

_Las direcciones también están en `deployments/fuji.json` en la raíz del repositorio._

### 🛠️ Stack tecnológico

- **Red:** Avalanche Fuji (testnet, finalidad sub-segundo).
- **Contratos:** patrón Factory; instancias independientes de `TrustCircle.sol` por círculo.
- **Frontend:** Next.js (App Router), Tailwind CSS, Shadcn/UI.
- **Web3:** Wagmi v2, Viem, RainbowKit.

### 🏗️ Resumen del protocolo

1. **Factory dinámica** — despliega contratos de círculo parametrizados (p. ej. aporte mínimo).
2. **Niveles de gobernanza** — el nivel de confianza ajusta quórum y ventanas de votación.
3. **Ejecución automática** — los fondos solo se mueven tras la aprobación on-chain de los miembros.

### 📦 Ejecución local

El repositorio es un **monorepo**. La dApp está en `UI/trust-circles-fe`.

**Requisitos:** Node.js 18+, npm o pnpm, wallet en **Avalanche Fuji**.

Desde la raíz del repositorio (tras clonar desde GitHub):

```bash
cd UI/trust-circles-fe
npm install
```

Crea `UI/trust-circles-fe/.env.local` con un project ID de [WalletConnect Cloud](https://cloud.walletconnect.com/):

```env
NEXT_PUBLIC_WC_PROJECT_ID=<tu_project_id>
```

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

**Producción (Vercel):** define **Root Directory** como `UI/trust-circles-fe` y configura las mismas variables de entorno `NEXT_PUBLIC_*` en el panel del proyecto.

### 🧪 Cómo probar el flujo (crowdlending)

1. **Wallet A** — conecta y crea un círculo nuevo con la factory.
2. **Wallet B** (otro navegador o incógnito) — conecta y **contribuye** AVAX al pool.
3. **Wallet B** — envía una **solicitud de fondos** (préstamo o reclamo tipo seguro).
4. **Wallet A** — vota a favor y **ejecuta** cuando se cumpla el quórum.

### 🧠 Logros técnicos y trabajo futuro

- **Next.js + Web3** — la UI de wallet en el cliente evita problemas de hidratación y mantiene conexiones estables en producción.
- **Modelo de repago (v2)** — hoy el repago se refleja vía contribuciones; se planifica un registro de deuda y reglas automáticas de reputación ante impagos.
- **Escalado en Avalanche** — una **Subnet** dedicada podría servir a círculos con requisitos de privacidad (p. ej. enfoques ZK) y tokens de gas opcionales.

---

**Evento / Event:** Aleph Hackathon 2026

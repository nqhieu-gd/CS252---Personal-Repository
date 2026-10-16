# Exercise 3: Individual Proposal for Course Project

**Student**: Nguyen Quang Hieu - 25125043 
**Project Title:** Pokémon Champion AI Assistant: Context-Aware Team Building & Dynamic Meta Counter-Strategist  

---

## 1. Project Summary & Vision

Competitive Pokémon (such as VGC and Smogon formats) is a complex, high-dimensional strategy game centered around team synergy, type coverage, meta-game trends, and micro-adjustments. While existing tools (like Showdown calculators or Smogon strategy pages) offer raw data or static usage statistics, they lack intelligent synthesis and fail to dynamically adapt to user constraints or weekly meta shifts.

The **Pokémon Champion AI Assistant** is an intelligent decision-support system designed to assist competitive players in building optimized 6-Pokémon teams. By combining **static game rules** with **frequently updated meta intelligence**, the assistant evaluates synergistic core combinations, resolves mechanical conflicts, and devises creative anti-meta counter-strategies (such as specific EV adjustments to survive key threats).

---

## 2. System Inputs and Outputs

```
+-----------------------------------------------------------------------+
|                              USER INPUT                               |
| - Team Theme: Sun / Rain / Sand / Trick Room / Balance / Core-Centric |
| - Core Pokémon: At least 1 mandatory anchor species                   |
| - Supporting Pokémon: Optional pre-selected team members             |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                   POKÉMON CHAMPION AI ASSISTANT                       |
|  - Validates type & weather synergy                                   |
|  - Queries static mechanics & weekly meta stats                       |
|  - Detects anti-synergies / conflicting cores                         |
|  - Optimizes items, moves, and EV spreads against key threats         |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                             SYSTEM OUTPUT                             |
| - Option A: Complete 6-Pokémon team centered around Primary Core      |
| - Option B (If conflict exists): Alternative branched team proposal   |
| - Detailed tactical breakdown, EV spreads, and anti-threat notes      |
+-----------------------------------------------------------------------+
```

### 2.1 Inputs
* **Team Theme:** Desired archetype (e.g., Sun, Rain, Sand, Trick Room, All-Rounder/Balance, or built around a single specific Pokémon).
* **Core Pokémon (Mandatory):** At least 1 non-negotiable anchor Pokémon specified by the user.
* **Supporting Pokémon (Optional):** Pre-selected complementary team members chosen by the user.

### 2.2 Outputs
* **Recommended Team Formations:** A full 6-Pokémon competitive team setup complete with Held Items, Abilities, Natures, Movepools, and custom EV/IV distributions.
* **Branched Conflict Solutions:** In cases where user-selected core Pokémon contradict each other, the AI generates separate team options for each core rather than failing or returning a flawed build.
* **Tactical Justifications:** Explanations for specific move choices, item choices, and bulk/offensive thresholds built to counter popular meta threats.

---

## 3. Data Classification Architecture

To ensure speed and accuracy, the system categorizes all game data into two distinct layers:

| Data Category | Mutability | Examples / Components | Update Frequency | System Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Static Knowledge Base** | **Unchanged (Deterministic)** | Base Stats, Movepools, Abilities, Dual-Type interaction matrices, standard game rules. | Fixed (Per Generation / Game Update) | Enforces legal moves, stat limits, and fundamental type weaknesses/resistances. |
| **Dynamic Meta Intelligence** | **Subject to Change** | Top usage percentages, dominant playstyles, common leads, top offensive threats, Mega Pokémon usage. | Weekly / Monthly updates | Informs counter-meta adjustments, popular matchup expectations, and tier viability. |
| **Adaptive Tech Data** | **Fluid / Situational** | Non-standard EV spreads, specific damage benchmark calculations, defensive "tech" moves. | Continuous / On-Demand | Generates custom survival spreads (e.g., surviving a specific meta attack to reverse KO). |

---

## 4. Key Functional Features & Logic

### 4.1 Intelligent Core Conflict Resolution
A major challenge in automated team builders is handling conflicting user constraints. 
* **Example Conflict:** A user requests both **Mega Charizard Y** (which sets *Drought/Sun*) and **Pelipper** (which sets *Drizzle/Rain*) as core Pokémon.
* **AI Handling:** Rather than blending two mutually destructive weather conditions into a single dysfunctional team, the system identifies the conflict, alerts the user, and generates **multiple distinct team options**:
  * **Branch 1:** A Sun-focused team maximizing Mega Charizard Y with Chlorophyll supporters.
  * **Branch 2:** A Rain-focused team maximizing Pelipper with Swift Swim supporters.

### 4.2 Meta-Aware "Anti-Threat" EV Engineering
Standard team tools default to maximum speed and attack ($252\text{ Atk} / 252\text{ Spe}$). The Pokémon Champion AI Assistant goes further by calculating specific survival and KO thresholds based on the active weekly meta data:
* **Scenario:** Dynamic meta data indicates that **Garchomp** is currently a high-usage physical threat in the environment.
* **AI Optimization:** Instead of recommending a glass-cannon build, the AI calculates a custom EV spread for Mega Charizard Y—investing precise HP/Defense EVs so it guaranteed-survives an incoming attack from Garchomp, enabling it to reverse-KO with an ice or fire attack.

---

## 5. Implementation Strategy & Feasibility

1. **Rule Engine & Knowledge Base:** Hard-coded relational logic for type matrices, weather interactions, speed tiers, and move synergy.
2. **Meta Ingestion Pipeline:** Automated scrapers/API connectors pulling weekly usage logs from ladder statistical sources (e.g., Smogon usage stats / VGC tournament data).
3. **LLM Synergy & Context Layer:** A Retrieval-Augmented Generation (RAG) agent that interprets user requests, queries the static and dynamic database, and synthesizes team proposals with human-readable tactical advice.

---

## 6. Novelty & Course Project Differentiation

* **Independent Scope:** Moves beyond simple lookup tables or static pokedexes by providing adaptive, real-time counter-strategy generation.
* **Decision Support Focus:** Assists human creativity rather than replacing it—encouraging players to explore novel, effective anti-meta tactics to achieve "Champion" level team design.
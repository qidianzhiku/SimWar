# MOD-04 Official Research Refresh Ledger

## Control

| Field                   | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Mission                 | `SIMWAR-MOD-04-OFFICIAL-RESEARCH-REFRESH-20260821`                 |
| Plan                    | `SIMWAR-MOD-AGT-DUAL-TRACK-PLAN-V1.0-20260820`                     |
| Plan SHA-256            | `EF2104E90C04A811697749388999E31AE27BCFC457D7804FB765A10C68120260` |
| Current master baseline | `b9854f1a8cbebed725caf8f4e1ae4b6409fb4ee2`                         |
| Evidence mode           | `OFFICIAL_PRIMARY_ONLY`                                            |
| Runtime mode            | `PROVIDER_OFF` / `provider_calls=0`                                |
| Refresh date            | `2026-08-21`                                                       |

This ledger records official documentation, official repositories and primary
papers as research evidence. It does not install, upgrade, import or activate
any candidate. `ADOPT_RESEARCH_ONLY` means the pattern may inform an offline
reference harness or shadow comparison; it does not mean the candidate is a
SimWar runtime dependency or a formal result writer.

## Adopt / Reject / Watch matrix

| Candidate                    | Exact source reference                                                                  | Official source and license                                                                                                                                                                                               | Decision              | SimWar use                                                                 | Fallback / reason                                                                                              | Recheck      |
| ---------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------ |
| PyBLP                        | `v1.2.0@6190bb9c0c3b93521c4fdb9693f31261b3067bd2`                                       | [PyBLP 1.2.0 docs](https://pyblp.readthedocs.io/en/stable/); [official repository](https://github.com/jeffgortmaker/pyblp); MIT                                                                                           | `ADOPT_RESEARCH_ONLY` | Offline BLP/RCNL reference and differential harness candidate              | Existing Core/toy-logit path remains authoritative; no dependency upgrade or official write                    | `2026-09-21` |
| Generative Agents paper/repo | `arXiv:2304.03442`; `StanfordHCI/genagents@96854071ef4c2d79c93144c973c7820722d52bab`    | [primary paper](https://arxiv.org/abs/2304.03442); [official research repo](https://github.com/StanfordHCI/genagents); MIT for repo                                                                                       | `ADOPT_RESEARCH_ONLY` | Memory/reflection/retrieval research pattern for future AGT/MOD evaluation | Deterministic advisory/fixed mock path; paper behavior is not a business truth model                           | `2026-09-21` |
| Concordia                    | `v2.4.0@702998f57da71f87bf4e607abc1325ee51cca21f`                                       | [official repository](https://github.com/google-deepmind/concordia); Apache-2.0                                                                                                                                           | `ADOPT_RESEARCH_ONLY` | Generative social-simulation architecture comparison                       | Provider-off rule/core simulation; Concordia requires an LLM API and is not an official writer                 | `2026-09-21` |
| AgentSociety                 | `main@13e28b5e67a2a8f2f43d640ebf27859126da622e`                                         | [official repository](https://github.com/tsinghua-fib-lab/AgentSociety); Apache-2.0 except commercial folder                                                                                                              | `WATCH`               | Compare population/social-agent evaluation patterns only                   | Exact release and commercial-folder applicability need further review; no runtime import                       | `2026-09-21` |
| AnyLogic                     | `8.9.8`, released 2026-02-26                                                            | [official download/system requirements](https://www.anylogic.com/downloads/); [official license agreement](https://www.anylogic.com/upload/license_agreements/software-licensing-agreement-for-anylogic.pdf); proprietary | `REJECT`              | System-dynamics/ABM research vocabulary only                               | Commercial licensed product is not a SimWar dependency; use pure shadow transition functions                   | `2026-09-21` |
| Capsim                       | `UNKNOWN`                                                                               | [official terms](https://www.capsim.com/terms); proprietary platform/IP                                                                                                                                                   | `WATCH`               | Business-simulation product-pattern comparison                             | No exact release or redistributable runtime verified; do not import content/platform                           | `2026-09-21` |
| Cesim                        | `UNKNOWN`                                                                               | [official Cesim Firm page](https://www.cesim.com/india/simulations/cesim-firm); commercial service                                                                                                                        | `WATCH`               | Course/simulation UX and scenario-pattern comparison                       | No exact software release/license or source runtime verified                                                   | `2026-09-21` |
| Forio                        | `EULA revised 2024-01-01`; product version `UNKNOWN`                                    | [official EULA](https://forio.com/eula); proprietary/commercial terms                                                                                                                                                     | `REJECT`              | Commercial simulation delivery pattern only                                | EULA is revocable/non-transferable and permits provider-side changes; no runtime dependency                    | `2026-09-21` |
| Qwen3-8B                     | `Qwen/Qwen3-8B` model card observed `2026-08-21`                                        | [official model card](https://huggingface.co/Qwen/Qwen3-8B); Apache-2.0                                                                                                                                                   | `WATCH`               | Candidate for future provider-neutral benchmark only                       | Exact weight revision, local hardware/SLO and provider activation policy still require a separate bounded gate | `2026-09-21` |
| DeepSeek-V3                  | `deepseek-ai/deepseek-v3@9b4e9788e4a3a731f7567338ed15d3ec549ce03b`                      | [official repository/model license](https://github.com/deepseek-ai/DeepSeek-V3); code MIT, weights under Model License                                                                                                    | `WATCH`               | Candidate benchmark task family only                                       | Model-license review, hardware budget and provider policy remain open; no provider call                        | `2026-09-21` |
| MiniCPM5-1B                  | `openbmb/MiniCPM@719e4fcfabff9b9c16f179c3f2986dfbd6c6047f`; model `openbmb/MiniCPM5-1B` | [official model card](https://huggingface.co/openbmb/MiniCPM5-1B); Apache-2.0                                                                                                                                             | `WATCH`               | Small-model/local-resource benchmark candidate                             | Source states on-device capability, but SimWar has no verified local SLO or activation token                   | `2026-09-21` |

## Claim treatment

- An official page can establish what a vendor or project states; it does not
  establish a SimWar performance SLO, calibration result, safety guarantee or
  production suitability.
- A repository license and a model-weights license are separate facts. The
  DeepSeek entry therefore records MIT code plus a separate Model License.
- `main@SHA` is an exact readback identity, not a promise that the upstream
  project will remain stable. A new upstream commit reopens the candidate.
- Commercial platforms are useful research references but cannot be imported
  as a second simulation kernel, Course authority, Settlement writer or
  Enterprise State writer.
- The source pages' marketing terms such as “SOTA”, “state-of-the-art”,
  “optimal” or “recommended” are not copied into SimWar SLOs.

## Gate decision

`RESEARCH_READY_WITH_LIMITS` is satisfied for the bounded research refresh:
each candidate has an official source, exact reference or explicit
`UNKNOWN`, license disposition, purpose, Adopt/Reject/Watch decision, fallback
and expiry. Dependency installation, dependency upgrade, Provider activation,
model deployment and formal writer changes remain outside this task.

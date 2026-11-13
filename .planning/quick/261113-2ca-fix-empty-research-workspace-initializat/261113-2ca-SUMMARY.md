# Research and memory UI trial

The approved hosted UI run found and corrected an empty-workspace initialization exception and a minor cross-view stale notice. Both corrections have focused shipped-client regression coverage and are deployed on `juno.agentschool.io` with the existing named `/data` storage.

Full-flow UI testing passed on `64ad951`: live search → explicit memory → refresh, note corrections/history/filtering, saved defaults, protected-workspace recovery/isolation, keyboard/hash navigation, 390px controls and verified Browser lab replay. A targeted final run on `18bcdf9` confirmed that deleting the last research receipt clears the stale Memory notice while preserving saved memory/defaults and the lab receipt. Report, recording and screenshots were delivered in the session. See `261113-2ca-VERIFICATION.md` for revision-specific evidence and limits.

Final implementation: `18bcdf9c229a331c5043766433c146b10816d0e4`; Coolify deployment `jfdtc6bmvami8yqfavmgerzy`. Local syntax/build, 54 unit tests and 19 integration tests passed; final implementation CI passed. Documentation commits follow separately. Jack's own trial remains pending; neither recorded UI verification nor these bounded tasks complete a roadmap phase.

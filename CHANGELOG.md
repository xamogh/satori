# Changelog

## [1.1.0](https://github.com/xamogh/satori/compare/v1.0.0...v1.1.0) (2026-02-12)


### Features

* **auth:** add local mode and onboarding IPC primitives ([e45587e](https://github.com/xamogh/satori/commit/e45587ee477d381e91b5010186783dd0d1b07a0c))
* better ui, layout, font packaging etc.. ([e208e96](https://github.com/xamogh/satori/commit/e208e96e6b2f700af87598fa36c757d1deba932f))
* create a proper effect-ts baseline ([8f3cff4](https://github.com/xamogh/satori/commit/8f3cff40477abaf3805eac0a7b5d6a1714482c9a))
* **desktop:** add admin data layer ([2da5bf5](https://github.com/xamogh/satori/commit/2da5bf5c0b27c2e169236ebb2beb1370cfb9f4b8))
* **desktop:** add admin people/events UI ([2105fae](https://github.com/xamogh/satori/commit/2105faee8de4debc9f5e7f11d5d046371d22be34))
* **desktop:** align event day lifecycles ([aecf583](https://github.com/xamogh/satori/commit/aecf583b55c55b39cb67e9e4961a442f1f82975b))
* **desktop:** attribute attendance check-ins ([a84d1e7](https://github.com/xamogh/satori/commit/a84d1e704c0953987da13a17304dba6ec6bfd626))
* **desktop:** build event detail ([c8ba875](https://github.com/xamogh/satori/commit/c8ba875944be8260e1b1e5e0fa49e250f46f574b))
* **desktop:** expand event forms ([de9157d](https://github.com/xamogh/satori/commit/de9157d891b451dae37d2fef29fb2485533886f3))
* **desktop:** make IPC errors Effect-native ([75aceef](https://github.com/xamogh/satori/commit/75aceef0f2d2111608c8b847338f1a793f080ac5))
* **desktop:** manage group members ([bf047fc](https://github.com/xamogh/satori/commit/bf047fc266039d621f8866d8d61b463c865f32f4))
* **desktop:** wire local auth flow into app shell ([93fc9bf](https://github.com/xamogh/satori/commit/93fc9bf016149e662147428f6e25a56127a83bd9))
* **dev:** bootstrap local Postgres with compose and seeded admin user ([0487b62](https://github.com/xamogh/satori/commit/0487b6257fad34e0b8d849997ca1bc210dfc9c2a))
* **domain:** add admin entity schemas ([efd66b5](https://github.com/xamogh/satori/commit/efd66b5f9b130c94daa6299538d2caeb92b3db85))
* follow standard electron app and safety protocols ([1b7f9d0](https://github.com/xamogh/satori/commit/1b7f9d0566c0bc0d678612a39ebbade08b248852))
* initialize basic electron app with auth ([750d8b1](https://github.com/xamogh/satori/commit/750d8b1237cf617cb74ad0d48d26f72967baaf92))
* **ipc:** add admin entity routes ([001889b](https://github.com/xamogh/satori/commit/001889bb64e8f7dc6e88f28bc410f3b6086a293a))
* **onboarding:** add local-first mode selection screens ([c39af6e](https://github.com/xamogh/satori/commit/c39af6e90c27725f512b5d287b25b19fc585ab1a))
* **server:** add admin sync models ([e667088](https://github.com/xamogh/satori/commit/e667088d76a9ab753248d7b4685e4bbf13196a97))
* use effect service syntax ([5f8a15d](https://github.com/xamogh/satori/commit/5f8a15dd512dd26c396fdc698454a492407d63dc))
* use tanstack form and effect schema for validation ([bdd9896](https://github.com/xamogh/satori/commit/bdd9896bef2ad4c2b6d59f798d8ec049f659932c))


### Bug Fixes

* **auth:** prevent immediate lock for long-lived local sessions ([c9bbbe9](https://github.com/xamogh/satori/commit/c9bbbe9c3878ede4de7736a315ca7f0e558dd2cb))
* **release:** allow release-please token fallback and document required permissions ([a2d9258](https://github.com/xamogh/satori/commit/a2d925846f45ad55f12d7d982436ad36c388db16))


### Performance Improvements

* **desktop:** move local SQLite to worker thread ([6555ca1](https://github.com/xamogh/satori/commit/6555ca1e1aeee57acddcc98161e4b1e2ee5d6431))

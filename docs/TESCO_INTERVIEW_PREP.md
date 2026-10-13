# Tesco Interview Prep — MOI Platform (Manufacturing Operations Intelligence)

Grounded in the actual codebase as of 2026-09-14. Every number below was pulled from your code, not guessed. Where the system has a real gap, I've said so — an interviewer at this level will probe past the confident answer, and "I know it's a gap, here's why and here's the fix" beats a bluff every time.

**Verified real numbers (memorize these, they're your credibility anchor):**
- **96** SQLAlchemy models in `app/db/models.py`
- **307** total routes = 159 GET + 87 POST + 39 PATCH + 14 DELETE + 6 PUT + **2 WebSocket** endpoints, across 30 router files
- **13** roles in `UserRole` enum (10 active + 3 legacy migration aliases)
- **5-tier** role hierarchy (platform_admin → ceo → hod → supervisor → worker) crossed with a **4-level org hierarchy** (organisation → plant → department → process)
- **211** foreign keys, **99** `relationship()` declarations, **33** unique constraints
- **44** service modules, ~496 functions — this is where your business logic lives, not the routers
- Stack: **FastAPI + SQLAlchemy 2.0 (async) + asyncpg + PostgreSQL 16**, plus a legacy **MongoDB/Beanie** layer still wired in for a handful of old models
- **JWT**: HS256, single access token, 24h expiry, no refresh token yet
- **WebSockets**: raw FastAPI `WebSocket`, in-memory per-process connection manager, no Redis pub/sub
- **No CI/CD pipeline**, **no automated test suite** (one manual DB script), Docker Compose with 3 services (postgres, backend, frontend)

---

## How to use this document

For each question: **[Explain]** is the concept so you actually understand it, **[Answer]** is the stitched thing to say out loud. Say the Answer in your own words — don't recite it. Sub-questions an interviewer would naturally chain into are nested under each topic.

---

## 1. Architecture

### Q: What are the frontend/backend/database components?

**[Explain]** You have three deployable units: a React/Vite web frontend, a React Native/Expo mobile app, and a FastAPI backend, all talking to one PostgreSQL database (with a small legacy MongoDB layer). This is a classic 3-tier architecture, but you have *two* clients hitting the same API — that's worth highlighting because it's why your API had to be strictly resource-oriented (REST) rather than page-shaped.

**[Answer]** "It's a three-tier system: a FastAPI backend exposing a REST + WebSocket API, a React/Vite web client and a React Native mobile client as two separate frontends against the same API, and PostgreSQL as the system of record. The backend is organized in layers — routers handle HTTP concerns, a service layer (44 modules) holds business logic, and SQLAlchemy models represent the schema. There's also a legacy MongoDB/Beanie layer from an earlier version of the project that a few old modules still import — it's not on the critical path anymore, but it's still initialized at startup, which is technical debt I'd clean up."

**Sub-Q: Why two frontends instead of one?**
[Answer] "Shop-floor operators use the mobile app for real-time entry at the machine; supervisors, HODs, and admins use the web app for dashboards, reporting, and configuration. Different usage contexts, same API — that's exactly the value of a backend-agnostic REST layer instead of server-rendered pages."

### Q: How does a request flow through the system?

**[Explain]** Trace one concrete request end to end: client → FastAPI router → dependency injection (`CurrentUser`, `DbSession`) → service layer → SQLAlchemy query → Postgres → Pydantic response model → JSON back to client.

**[Answer]** "Say a supervisor hits `GET /api/v1/process-runs/mine`. FastAPI resolves two dependencies first: `get_current_user`, which decodes the JWT and loads the `User` row, and `get_db`, which hands out an async SQLAlchemy session. The route handler calls into a service function, which applies role-based scoping — [see `access_scope.py`](../backend/app/services/access_scope.py) — builds a `select()` query scoped to that user's department, executes it against Postgres via asyncpg, and returns ORM objects. FastAPI then serializes them through a Pydantic response model, which is also where field-level validation and shape enforcement happens, and returns JSON."

**Sub-Q: Where does validation happen in that flow?**
[Answer] "Twice — incoming request bodies are validated by Pydantic models at the router boundary (type coercion, required fields, enum membership) before the handler even runs; and role/data-access validation happens explicitly in the service layer via functions like `assert_can_access_process`, because that's business logic, not shape validation, and doesn't belong in Pydantic."

### Q: Why FastAPI?

**[Explain]** Async I/O for a DB-bound app, native Pydantic validation, automatic OpenAPI docs, dependency injection for auth/session wiring, and it's genuinely fast to iterate in for a solo/small-team build.

**[Answer]** "Three reasons. First, the app is I/O-bound — most of the work is waiting on Postgres — so async request handling with `asyncpg` lets one process serve many concurrent requests without threads blocking on DB calls. Second, FastAPI's dependency injection is what makes the auth/RBAC layer clean — `CurrentUser` and `DbSession` are just typed dependencies I compose into every route instead of repeating boilerplate. Third, Pydantic-based validation and auto-generated OpenAPI docs meant the two frontend teams could work against a live, accurate API contract without me hand-writing docs."

**Sub-Q: What would you pick if you were not using Python?**
[Answer] "For this I/O-bound, DB-heavy profile, Node/NestJS or Go would be reasonable alternatives — Go especially for the WebSocket layer, since goroutines handle many long-lived connections more cheaply than Python's async event loop under real concurrency. I'd stick with FastAPI for the CRUD-heavy REST surface either way, since the productivity win from Pydantic + automatic validation is large for a schema this wide."

### Q: Why PostgreSQL?

**[Explain]** You have deeply relational data — org → plant → department → process → run, with 96 tables and 211 FKs. That screams relational, not document. ACID transactions matter because operational events, workflow transitions, and financial cost calculations all need consistency guarantees a document store doesn't give you for free.

**[Answer]** "The domain is inherently relational — a process run belongs to a process, which belongs to a department, which belongs to a plant, which belongs to an organisation, and workflow transitions, cost calculations, and audit logs all need to join across that hierarchy reliably. With 96 tables and 211 foreign keys, referential integrity isn't optional — I need the database to reject an orphaned `ProcessRun` pointing at a deleted `Process`, not discover it at 2am from a broken dashboard. Postgres also gives me real transactions, which matters for something like a workflow state transition that has to update the run's status *and* write an audit log *and* fire a notification atomically — if one fails, I need the whole thing to roll back."

**Sub-Q: You also have MongoDB in the stack — why not go all-document?**
[Explain — be honest here, this is the kind of thing a good interviewer will notice from your framing and probe] "That's actually legacy — the project started on MongoDB/Beanie for a handful of models (`User`, `Organisation`, `Department`, `Template`, `Record`), and was migrated to Postgres as the schema matured and the relational structure became obvious. A few old modules still import the Beanie models and the app still calls `init_beanie` at startup, but it's not load-bearing anymore — it's on my list to remove. It's a good real example of 'we learned the data was relational after the fact' — which is honestly a common trajectory."

**Sub-Q: Why not use Postgres JSONB instead of some of these enum/relational tables?**
[Answer] "I do use JSONB in a couple of places — `OperationalEvent.payload`, for instance, which needs to be schema-flexible because event types vary. But for anything I need to query, filter, join, or enforce a foreign key on — like a process run's department — a real column with a real constraint is strictly better than digging into a JSON blob at query time."

### Q: Why WebSockets?

Covered in depth in section 5 — see below.

---

## 2. Database

### Q: Why relational DB?

Same core answer as "Why PostgreSQL" above — lead with referential integrity and joins across the org hierarchy, not "it's what I know."

### Q: How did you design the 96 models?

**[Explain]** Your schema clusters into a few natural domains — walk through them so you can name the clusters fluently:
- **Org hierarchy / masters**: `Organisation`, `Plant`, `Department`, `Process`, `AssetGroup`, `Shift`, `Grade`, `Material`, `Customer`, `Product` — mostly reference/master data with unique constraints scoping codes to their parent (e.g. `uq_plant_org_code`).
- **Templates & dynamic forms**: `Template`, `TemplateVersion` (with `TemplateVersionAudit`), sections/fields — this is a metadata-driven form builder so shop-floor logging forms can change without a code deploy.
- **Process execution**: `ProcessInstance`, `ProcessRun`, `WorkflowTransitionLog`, `OperationalEvent`, `RunRemark` — the operational core, workflow-state-machine driven.
- **Maintenance**: `MaintenanceIssue`, `MaintenanceWorkOrder`, `MaintenanceWorkOrderTransition`, PM programs.
- **Workforce/HR**: attendance, leave, payroll, contractors.
- **Finance**: `CostCalculation`, `CostLineItem`, cost mappings.
- **Analytics/reporting**: `FactProcessRun`, `AggShiftKPI`, `MLFeatureSnapshot`, `PulseSnapshot`, `OEESnapshot` — pre-aggregated tables, i.e. a lightweight star-schema pattern for dashboards so you're not aggregating raw event tables on every dashboard load.
- **Messaging/notifications/audit**: `Message`, `MessageRecipient`, `UserNotification`, `AuditLog`.

**[Answer]** "I didn't design 96 tables up front — the schema grew domain by domain as features shipped: masters and org hierarchy first, then the dynamic template/form engine, then process execution with its workflow state machine, then maintenance, workforce, and finance modules layered on the same org hierarchy. The pattern that holds it together is that almost every table scopes back to `organisation_id` → `plant_id` → `department_id`, which is also exactly what the RBAC scoping layer keys off. The one deliberate design decision I'd call out is the analytics layer — tables like `FactProcessRun` and `AggShiftKPI` are pre-computed/denormalized on purpose, a small star-schema pattern, so dashboards don't have to aggregate raw `OperationalEvent` rows live."

**Sub-Q: Isn't 96 tables too many? Would you consolidate?**
[Answer] "Some of it is genuinely necessary — normalization means a process run's cost calculation, its remarks, and its workflow transitions really are separate concerns with separate lifecycles. But there's real duplication I'd refactor: `PulseSnapshot`, `DepartmentPulse`, and `AssetPulse` look like they could collapse into one polymorphic snapshot table with a type discriminator instead of three near-identical tables. That's the kind of thing that happens when features ship domain-by-domain without a later consolidation pass — I'd flag it as tech debt, not defend it as intentional."

### Q: Relationships/foreign keys

**[Answer]** "211 foreign keys, 99 explicit `relationship()` declarations for ORM-level traversal. The core hierarchy chain — Organisation → Plant → Department → Process → ProcessRun — is enforced with FKs at every level, which is what lets the RBAC layer do things like `query.where(Plant.organisation_id == user.organisation_id)` and trust the join is valid. I use `ondelete` behavior deliberately in places — for something like `AuditLog`, I don't want a cascade delete wiping history if the parent record is removed."

### Q: Indexes

**[Explain — this is a real gap, own it]** Your models have 33 `UniqueConstraint`s (which auto-create a unique index in Postgres), but a grep for explicit `Index(...)` on hot lookup/filter columns comes back empty. That's a legitimate finding — Postgres does auto-index primary keys and FK columns aren't auto-indexed by default (unlike some other DBs), and 211 FKs with no explicit index on the FK column side is a real potential bottleneck for joins and deletes.

**[Answer]** "Indexing today mostly comes from the 33 unique constraints — things like `(plant_id, code)` on assets or `(organisation_id, code)` on grades, which Postgres backs with a unique index automatically. What I don't have yet is deliberate secondary indexing on foreign key columns or on common filter columns like `ProcessRun.created_at` or `OperationalEvent.occurred_at` for time-range queries. That's an honest gap — Postgres doesn't auto-index FK columns, so as the `OperationalEvent` and `AuditLog` tables grow, joins and filtered scans on those will degrade. If I were hardening this for scale, that's the first thing I'd add, backed by `EXPLAIN ANALYZE` on the actual slow queries rather than indexing speculatively."

### Q: Transactions

**[Answer]** "SQLAlchemy's async session gives me a transaction per unit of work by default — I `commit()` at the end of a service method, and if anything raises before that, the session rolls back. The clearest example is the seed/startup path in `main.py`: multiple seed functions run against one session and commit together, so a partial seed failure doesn't leave the org hierarchy half-created. The pattern I use in request handlers is: do all the writes for one logical operation — e.g. update a `ProcessRun`'s state *and* write a `WorkflowTransitionLog` row — inside the same session, and only commit once, so a failure partway through rolls back both."

### Q: Normalization

**[Answer]** "The transactional schema — process runs, workflow logs, cost line items — is normalized to 3NF: no repeated groups, and derived values aren't stored redundantly. The exception is intentional: the analytics tables (`FactProcessRun`, `AggShiftKPI`, `OEESnapshot`) are deliberately denormalized, because they exist specifically to avoid re-aggregating normalized data on every dashboard request. That's a conscious normalize-for-correctness, denormalize-for-read-speed split, not an oversight."

### Q: What queries were expensive?

**[Explain]** Be honest that you haven't done a formal profiling pass — that's fine, but have a *plausible, specific* answer ready given what you know about the schema: multi-level joins for RBAC scoping (org→plant→department→process, 3-4 joins deep) run on every list endpoint, and analytics aggregation across `OperationalEvent`/`ProcessRun` for dashboards.

**[Answer]** "The most expensive pattern structurally is the RBAC scoping itself — for a supervisor-tier user, `apply_process_list_scope` does two joins (Process → Department → Plant) just to check organisation membership, and that runs on every list-type request, not just the ones that need it. The other likely hot spot is anything aggregating over `OperationalEvent` or `ProcessRun` directly for dashboards before it hits the pre-aggregated `FactProcessRun`/`AggShiftKPI` tables — which is exactly why those pre-aggregation tables exist. I haven't done a formal `EXPLAIN ANALYZE` pass yet — that's the next concrete step I'd take before scaling: log slow queries via `pg_stat_statements`, find the real outliers, then index or restructure specifically for those instead of guessing."

---

## 3. API Design

### Q: How did you structure 307 endpoints?

**[Answer]** "By resource domain, one router file per domain — 30 router modules (auth, process_runs, departments, finance, maintenance, workforce, pulse, etc.), mounted under a common `/api/v1` prefix via a central `api_router`. Within a router, endpoints follow REST resource conventions: `/process-runs`, `/process-runs/{run_id}`, `/process-runs/{run_id}/remarks`, `/process-runs/{run_id}/transitions/history`. Breaking it down by domain rather than one giant router was a deliberate choice — it maps directly to how the service layer is organized (44 service modules), so a router file and its matching service file cover the same bounded piece of the domain."

### Q: REST principles

**[Answer]** "Resources are nouns, HTTP verbs carry the action — 159 GET for reads, 87 POST for creation, 39 PATCH for partial updates, 14 DELETE, 6 PUT. Nesting reflects real ownership — `/process-instances/{instance_id}/runs` because a run only exists in the context of an instance — but I stop nesting past 2 levels to avoid the URL becoming unreadable; a resource with its own strong identity, like a `ProcessRun`, gets addressed directly as `/process-runs/{run_id}` even though it's owned by an instance."

**Sub-Q: Where does your API break strict REST?**
[Answer] "The WebSocket endpoints obviously aren't RESTful — they're persistent connections, not request/response. And some action-oriented endpoints, like a workflow transition trigger, are POSTs to a sub-resource rather than a pure state PATCH, because the action has side effects (audit log write, notification) beyond just updating a field — I chose to model it as an explicit action endpoint rather than force it into a PATCH that hides what's really happening."

### Q: Authentication vs authorization

**[Explain]** This is a classic pairable question — know the one-liner cold: authentication = who you are, authorization = what you're allowed to do. Then map it directly to your code.

**[Answer]** "Authentication is `get_current_user` in `deps.py` — decode the JWT, confirm the signature and expiry, look up the `User` row, confirm they're active. That answers 'who is this.' Authorization is everything downstream of that: `require_roles(...)` dependencies gate entire endpoints by role, and functions like `assert_can_access_process` or `apply_run_query_scope` in `access_scope.py` gate *which rows* that authenticated user can see or touch, based on role tier plus their organisation/plant/department/process assignment. So authentication happens once per request as a dependency; authorization happens both at the route level (role check) and at the query level (row-level scoping)."

### Q: Error handling

**[Answer]** "FastAPI's `HTTPException` for expected failure states — 401 for missing/invalid/expired tokens, 403 for role or scope violations (e.g. `assert_can_access_process` raises 403 with a specific message like 'Cannot access processes outside your department'), 404 for missing resources, 400 for invalid input combinations like `validate_user_scope` rejecting a Supervisor without a `process_id`. I keep the 403 messages specific rather than generic — 'Access denied' everywhere would make debugging RBAC issues in production much harder."

**Sub-Q: What about unhandled exceptions — a DB connection drop, an unexpected None?**
[Answer, honest] "Those fall through to FastAPI's default 500 handler today. I don't yet have a global exception handler that normalizes error response shape or logs structured context — that's a real gap for production readiness. I'd add a middleware-level handler that catches unhandled exceptions, logs them with request context, and returns a consistent error envelope instead of leaking a stack trace shape."

### Q: Validation

**[Answer]** "Pydantic models on every request body handle type/shape validation automatically — required fields, enum membership (I have dozens of `enum.Enum` types like `ProcessRunOutcome`, `MaintenanceIssueStatus`), UUID format. Business-rule validation that Pydantic can't express — like 'a Supervisor must have an organisation, department, *and* process assigned' — lives explicitly in service functions like `validate_user_scope`, which raise a 400 with a specific message per role. That split is deliberate: shape validation at the boundary, domain rule validation in the service layer."

### Q: Pagination

**[Explain — another honest gap, own it directly]** Most list endpoints don't take `limit`/`offset` — they return the fully-scoped result set, sometimes filtered by a boolean flag like `active_only`. This is a real weakness at scale.

**[Answer]** "Honestly, this is a gap today — most list endpoints return the full RBAC-scoped result set rather than a paginated page; a couple take a boolean filter like `active_only` but not `limit`/`offset`. It's worked so far because the RBAC scoping already narrows most result sets to one department or plant, which keeps them small in practice. But it's not correct for scale — I'd add cursor-based or offset pagination on the highest-traffic list endpoints (`process-runs`, `operational-events`) before this went to a much larger customer, and I'd prioritize cursor-based over offset for the time-ordered event feeds specifically, since offset pagination degrades on large tables."

### Q: Status codes

**[Answer]** "200 for successful reads, 201 would be correct for creation but I should double check I'm consistently returning that rather than defaulting to 200 on POST — [worth verifying before the interview, see note below]. 204 for deletes with no body. 400 for bad input/business-rule violations, 401 for auth failures, 403 for authorization/scope failures, 404 for missing resources, 422 automatically from FastAPI when Pydantic validation fails on the request body."

*(Note to self before the interview: quickly check whether your POST endpoints actually declare `status_code=201` — if FastAPI's default 200 is used everywhere, say so honestly rather than claiming 201.)*

---

## 4. RBAC

This is genuinely the most sophisticated part of your system — spend real prep time here, it's your strongest section.

### Q: How do you determine what a user can access?

**[Explain]** Two orthogonal axes combine: **role tier** (what class of action you can take) and **org-hierarchy scope** (which rows you can see, based on your assigned `organisation_id`/`plant_id`/`department_id`/`process_id`). Neither alone is enough — a Supervisor role means nothing without knowing *which* department; an organisation_id means nothing without knowing whether the role is allowed to write.

**[Answer]** "Access is the intersection of two things. First, role tier — `PLATFORM_ADMIN_ROLES`, `CEO_ROLES`, `HOD_ROLES`, `SUPERVISOR_ONLY_ROLES`, `WORKER_ROLES`, plus side-branches for `MAINTENANCE` and `HR` — which determines *what kind* of action is even possible, checked via `require_roles(...)` at the route level. Second, hierarchical scope — every user has an `organisation_id`, and depending on role, a `plant_id`, `department_id`, or `process_id` — which determines *which rows* they can see, applied via functions like `apply_run_query_scope` that literally add `.where()` clauses to the SQLAlchemy query based on the caller's assignment. So a Supervisor role alone grants nothing — it's 'Supervisor role, scoped to department X' that lets someone see department X's process runs and nothing else. I also build cumulative tier sets — `SUPERVISOR_TIER_ROLES = HOD_TIER_ROLES | SUPERVISOR_ONLY_ROLES` — so a check for 'supervisor tier or above' automatically includes every role above it in the hierarchy, rather than hardcoding a role list at every check site."

### Q: Why 13 roles?

**[Answer]** "Really it's 10 functioning roles — `SUPER_ADMIN`, `CEO`, `HR`, `HOD`, `ORG_ADMIN`, `PLANT_ADMIN`, `SUPERVISOR`, `WORKER`, `MAINTENANCE`, `MAINTENANCE_MANAGER` — plus 3 legacy aliases (`ADMIN`, `DEPARTMENT`, `MEMBER`) kept for backward compatibility during a role-naming migration, mapped onto the current roles via a `role_key()` function so old data doesn't break. The 10 real roles map onto two structures: a vertical management chain (super admin → org admin/CEO → plant admin/HOD → supervisor → worker) mirroring the actual organisation hierarchy, and two cross-cutting functional roles — HR and Maintenance — that don't sit in the vertical chain at all, because HR needs org-wide visibility regardless of plant, and Maintenance needs to be scoped by *division/category*, not by department, since a maintenance technician might service equipment across multiple departments."

**Sub-Q: Why keep legacy aliases instead of migrating the data and deleting them?**
[Answer, honest] "Because at the time, migrating every existing user row's role value in production carried more risk than mapping old values forward in code. It's the pragmatic call for a live system, but it's debt — the `role_key()` mapping function existing at all is a sign this should eventually get a real data migration and the aliases removed."

### Q: How does the 5-level hierarchy interact with permissions?

**[Explain]** Clarify there are actually *two* hierarchies at play and they're not the same axis — that's the sophisticated insight to surface:
1. **Role tier hierarchy** (5 levels): platform_admin > ceo > hod > supervisor > worker (maintenance/HR sit outside this, scoped differently)
2. **Org data hierarchy** (4 levels): organisation > plant > department > process

**[Answer]** "They're two separate hierarchies that compose. The role tier — platform admin down to worker — determines the *ceiling* of what you're allowed to do: a platform admin bypasses scoping entirely, a CEO-tier role is scoped to their organisation, HOD-tier to their department, supervisor to their department or process, worker to just their own submissions. The org hierarchy — organisation → plant → department → process — is the *scope* that tier gets applied within. So `apply_run_query_scope` reads almost like a ladder: platform admin, no filter; CEO tier, filter by `organisation_id`; HOD tier, filter by `department_id`; supervisor, filter by `department_id` and optionally `process_id`. Each step down the role ladder narrows the org-hierarchy filter one level deeper. That's why I keep them as separate concepts in code instead of collapsing them into one permission table — a Supervisor's org_id, plant_id, department_id, and process_id are all independently meaningful, and different endpoints scope on different combinations of them."

### Q: What happens when someone changes role?

**[Explain]** Be honest about what you can verify from the code: `validate_user_scope` runs at role-assignment time to enforce that the *new* role has the required scope fields (a promotion to HOD requires `department_id` to already be set, for instance). There's no visible "revoke existing sessions on role change" logic — worth flagging as a gap, because it's a real security question they may probe.

**[Answer]** "When a user's role is changed, `validate_user_scope` runs to make sure the new role's required fields are present — you can't set someone to Supervisor without an `organisation_id`, `department_id`, *and* `process_id`, for example, or the assignment is rejected with a 400. What the system does *not* currently do is invalidate that user's existing JWT — since I'm not tracking token state server-side (no refresh tokens or a revocation list), a demoted user's existing access token keeps working with the old role's claims until it naturally expires, up to 24 hours later. That's a real gap I'd flag proactively: for anything security-sensitive, role changes should either be reflected in the token on next refresh, or I'd need a short-lived access token plus a server-tracked refresh token I can revoke on role change."

---

## 5. WebSockets

### Q: Why not normal HTTP polling?

**[Answer]** "For the operational event feed — `/ws/process-runs/{run_id}` — a supervisor watching a live process run needs near-real-time visibility into new events without hammering the API every second from every connected client. A WebSocket keeps one open connection and pushes updates, which is both lower latency and lower server load than N clients polling every few seconds."

**Sub-Q honest follow-up (an interviewer who reads the code carefully might ask this):** *"But your run_events_ws handler sleeps 30 seconds and re-fetches — isn't that just polling over a WebSocket?"*
[Answer, own it] "Fair catch — that specific endpoint is a hybrid: on connect, it pushes the last 20 events immediately, then falls back to polling the run's current state every 30 seconds over the open connection, rather than a true push-on-change model. The `ConnectionManager.broadcast()` method exists for real pub/sub push, and there's a second channel — `/ws/plants/{plant_id}/runs` — set up to use it, but nothing in the codebase currently calls `broadcast()` to push events as they happen. So today it's 'a WebSocket connection with server-side polling inside it,' not full event-driven push. The next step to make it real push would be calling `manager.broadcast()` from wherever `OperationalEvent` rows are actually created, so a new event fires immediately instead of waiting for the next 30-second tick."

### Q: Connection lifecycle

**[Answer]** "Client connects with the JWT as a query parameter — `?token=...` — since browsers can't set custom headers on a WebSocket handshake. The server decodes it with the same `decode_access_token` function used for REST auth; if it fails, the socket closes immediately with code 4001. On success, `ConnectionManager.connect()` accepts the handshake and appends the socket to a list keyed by channel — `plant:{id}` or `run:{id}`. The server then loops on `receive_text()` (or the 30s sleep loop for the run channel) until a `WebSocketDisconnect` is raised, at which point `disconnect()` removes it from the channel's list."

### Q: How do you broadcast updates?

**[Answer, honest]** "The mechanism is `ConnectionManager.broadcast(channel, message)` — it iterates every socket registered under a channel and sends the message, swallowing exceptions per-socket so one dead connection doesn't break the broadcast for everyone else. In practice today, only the plant-runs channel is wired for true broadcast; the run-events channel pushes state on a timer instead of on an actual broadcast call, which — as above — is something I'd fix by wiring event creation to call `broadcast()` directly."

### Q: What happens if a client disconnects?

**[Answer]** "FastAPI raises `WebSocketDisconnect` inside the receive loop, which is caught, and `ConnectionManager.disconnect()` removes that socket from its channel's list. No reconnection or message-replay state is kept server-side — if the client reconnects, it gets a fresh snapshot (the last 20 events, current state) rather than exactly what it missed. For most operational dashboards that's an acceptable trade-off since the snapshot-on-connect covers it, but it does mean there's no guaranteed delivery — if a client's connection blips and they don't reconnect, whatever streamed while they were down is gone unless they re-fetch the underlying resource over REST."

### Q: How would you scale WebSockets across multiple backend instances?

**[Explain]** This is the key scaling weakness to be upfront about: `ConnectionManager.active` is an in-memory Python dict on one process. Run two backend replicas behind a load balancer, and a broadcast on instance A never reaches a client connected to instance B.

**[Answer]** "Honestly, today it wouldn't scale past one instance — `ConnectionManager` holds connections in an in-memory dict, so if I ran two backend replicas behind a load balancer, a broadcast fired on instance A never reaches a client whose socket landed on instance B. The standard fix is to move the fan-out to Redis pub/sub: each instance subscribes to the relevant channel on connect, and instead of iterating a local list, `broadcast()` publishes to Redis and every subscribed instance relays to its own locally-connected sockets. That decouples 'who's connected to me' from 'who needs this message.' I'd also want sticky sessions or a channel-aware load balancer so reconnect storms don't all pile onto one instance, though with Redis pub/sub in place, sticky sessions become a nice-to-have rather than a requirement."

---

## 6. JWT

### Q: Authentication flow

**[Answer]** "`POST /api/v1/auth/login` takes email/password, `AuthService.login` verifies the password with `passlib`'s bcrypt-based `verify_password`, and on success calls `create_access_token(subject=user.id)`, which encodes a JWT with `sub` (the user ID) and `exp` using `python-jose`, signed HS256 with a server-side secret. The client stores that token and sends it as `Authorization: Bearer <token>` on every subsequent request; `get_current_user` decodes and verifies it on each request via the `CurrentUser` dependency."

### Q: Access/refresh tokens

**[Answer, honest]** "There's currently only a single access token — no refresh token. `ACCESS_TOKEN_EXPIRE_MINUTES` is set to 24 hours. That's a real gap for a production system: a long-lived access token with no refresh mechanism means I either accept a 24-hour exposure window if a token leaks, or I have to force full re-login more often, and there's no way to revoke a single compromised token early short of rotating the whole signing secret. If I were hardening this, I'd add a short-lived access token (say 15 minutes) plus a longer-lived, server-tracked refresh token that can be individually revoked — which also solves the 'role change should take effect quickly' gap from the RBAC section."

### Q: Token expiry

**[Answer]** "24 hours (`ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24`), enforced by the `exp` claim, checked automatically by `jose.jwt.decode` — an expired token raises `JWTError`, which `decode_access_token` catches and returns `None`, which `get_current_user` turns into a 401."

### Q: Where tokens are stored

**[Answer]** "On the web frontend, `localStorage` — the API client reads `access_token` from `localStorage` on every request via an axios interceptor, and clears it on a 401. That's a known trade-off: `localStorage` is simple but vulnerable to XSS reading the token directly, versus an `httpOnly` cookie which isn't readable by JS but needs CSRF protection instead. I haven't checked the mobile app's exact storage mechanism, but Expo apps typically use `SecureStore` for this, which is the safer choice since it's OS-level encrypted storage rather than a JS-accessible store."

### Q: Authorization middleware

**[Answer]** "It's not global middleware — it's per-route dependency injection. `CurrentUser` (identity) and role-gated dependencies like `SupervisorUser`/`CeoUser`/`PlatformAdminUser` (built from `require_roles(...)`) are declared as FastAPI `Depends()` on whichever routes need them, rather than a single blanket middleware checking every request. I like that better than global middleware here because different endpoints genuinely need different minimum roles, and FastAPI's dependency system makes the required role visible right in the route signature instead of buried in a separate middleware config."

---

## 7. Scaling

### Q: If 10× users arrive, what breaks first?

**[Explain]** Reason through it in the order things would actually fail, based on what you've confirmed exists (and doesn't) in the code:
1. **No pagination** — list endpoints returning full result sets get slower and heavier per-request as data volume grows with usage.
2. **In-memory WebSocket state** — can't horizontally scale past one instance without a Redis-backed pub/sub rewrite.
3. **No caching layer at all** — every read hits Postgres directly, no Redis/CDN in front of anything.
4. **Missing indexes on FK/filter columns** — joins that were fine at low row counts degrade as tables grow.
5. **Single Postgres instance** (per docker-compose) — no read replicas, no connection pooling layer like PgBouncer visible.

**[Answer]** "In order, I think the pagination gap breaks first — list endpoints returning unbounded result sets get linearly heavier as data grows, and that's a code-level fix, not an infra one, so it'd show up as slow response times before anything else falls over. Second, the WebSocket layer is currently in-memory per-process, so I literally can't add a second backend replica for the WebSocket feature without a rewrite — that's a hard wall, not a gradual degradation. Third, there's no caching layer anywhere — every single read, including data that barely changes like org/plant/department masters, goes straight to Postgres — so connection pool exhaustion on the DB is a real risk under 10x concurrent load. And fourth, I don't have explicit indexes beyond what the unique constraints provide, so query latency would climb as the biggest tables — `OperationalEvent`, `AuditLog`, `WorkflowTransitionLog` — grow. My priority order to fix would be: add pagination and DB connection pooling first since they're cheap and immediately impactful, then indexes guided by real `EXPLAIN ANALYZE` data, then Redis for both caching and WebSocket pub/sub, and only reach for read replicas or sharding once single-instance Postgres is actually proven to be the bottleneck rather than assumed."

### Q: Database bottleneck?

[Answer] "Most likely, yes, eventually — one Postgres instance, no visible read replica or PgBouncer-style pooling in the docker-compose. Each FastAPI async worker holds its own connection pool via SQLAlchemy's `async_sessionmaker`; scale to multiple backend instances and you multiply that pool count against Postgres's `max_connections` ceiling. PgBouncer in transaction-pooling mode in front of Postgres would be the first infra addition before reaching for read replicas."

### Q: API servers?

[Answer] "The stateless REST endpoints scale horizontally fine behind a load balancer — that part of the design is sound because auth is per-request via JWT, not session-based. The WebSocket endpoints are the exception, as discussed."

### Q: WebSocket connections?

[Answer] "Bounded today by one process's memory and file descriptor limits, and not distributable across replicas without the Redis pub/sub change described above."

### Q: Caching?

[Answer, honest] "There is none right now — no Redis, no in-memory cache, no HTTP caching headers that I've seen. The highest-value first target would be the org hierarchy master data — organisations, plants, departments, processes — which changes rarely but gets read on nearly every scoped query. Caching that in Redis with a short TTL or explicit invalidation on write would cut a meaningful fraction of DB load without touching business logic."

### Q: Load balancer?

[Answer] "Not present in the current docker-compose — it's direct container-to-container. For horizontal scaling I'd put nginx or a cloud load balancer in front of multiple backend replicas, with sticky sessions or Redis-backed WebSocket routing so a client's WS connection lands consistently."

---

## 8. Testing / Deployment / Monitoring

**[Explain — be direct about this section, it's the biggest gap and the one most worth having a real plan for rather than a bluff]**

### Q: Unit tests / integration tests

**[Answer, honest]** "This is the weakest part of the project today, and I'll say that directly — there's one manual script (`scripts/test_db.py`) rather than an automated pytest suite. Given the size of the RBAC and access-scoping logic in particular, that's exactly the kind of pure-function logic that's cheap to unit test and high-value to have covered — `is_hod_tier`, `can_message`, `validate_user_scope` are all deterministic functions with no I/O, so they'd take an afternoon to cover well and would catch regressions in the part of the system where a bug means a data leak, not just a broken feature. If I were prioritizing test-writing time: RBAC/scope functions first, workflow state transition logic second, then integration tests against a test Postgres container for the request-flow-through-the-service-layer path."

### Q: CI/CD

**[Answer, honest]** "There's no CI/CD pipeline in this repo currently — no GitHub Actions workflow, nothing automated on push. I have Docker and docker-compose, which is the right foundation — the next concrete step is a GitHub Actions workflow that builds the backend image, runs whatever test suite exists against a Postgres service container, and only then builds/pushes on merge to main."

### Q: Logging

[Answer] "Application-level, via Python's standard logging inside services — I don't have a structured/centralized logging setup (e.g. JSON logs shipped to something like ELK or Datadog) yet. For a real production deployment I'd want structured logs with request IDs so I can trace a single request across the router → service → DB layers, especially useful given how much of the interesting logic (RBAC decisions) currently just raises an `HTTPException` with a message and nothing else logged."

### Q: Monitoring

[Answer, honest] "Not set up yet — no Prometheus/Grafana, no APM. Given the analytics tables already in the schema (`FactProcessRun`, `AggShiftKPI`), the domain metrics side is halfway there; what's missing is infra-level monitoring — request latency, error rate, DB connection pool saturation, WebSocket connection counts. `pg_stat_statements` for slow-query monitoring would be the first thing I'd turn on since it directly informs the indexing work discussed earlier."

### Q: Docker

[Answer] "Docker Compose with three services — `postgres` (official Postgres 16 image, health-checked), `backend` (built from a Dockerfile, waits on Postgres's healthcheck via `depends_on: condition: service_healthy`), and `frontend` (built and served, presumably via nginx based on the Dockerfile pattern). No Redis or reverse proxy container yet — those are the natural next additions alongside the caching/WebSocket scaling work."

### Q: Cloud

[Answer, honest — answer based on what's actually deployable, don't invent a cloud story you haven't built]" I don't have a cloud deployment configured yet — it's currently Docker Compose, which is the right shape to lift into a managed environment. For a next step I'd target a managed Postgres (RDS/Cloud SQL) instead of a self-hosted container, and run the backend on a container platform like ECS/Cloud Run behind a load balancer, since the app is already stateless aside from the WebSocket connection-manager issue."

---

## 9. "What did YOU personally build?"

**[Explain]** For a project this size, they will absolutely test whether you can go deep on *specific* pieces rather than describe the whole thing at a high level forever. Pick 2-3 pieces you can go genuinely deep on — I'd suggest the RBAC/access-scope layer (`access_scope.py`) and the workflow/process-run state machine, since those are the most technically interesting and specific parts of this codebase, backed by real code you can point to.

**[Answer — adapt to what you actually wrote; don't claim authorship of what a tool generated for you]** "I'll speak to the parts I can go deep on. The access-control layer in `access_scope.py` is mine — designing the two-axis model of role tier crossed with org-hierarchy scope, and writing the tier-set composition (`SUPERVISOR_TIER_ROLES = HOD_TIER_ROLES | SUPERVISOR_ONLY_ROLES`) so a permission check for 'supervisor or above' doesn't need a hardcoded role list. I can walk through exactly how `apply_run_query_scope` or `assert_can_access_process` decide what a given role/scope combination can see, because I designed those rules against the actual org structure — organisation → plant → department → process — not against an abstract permission-string system. I can also go deep on the process-run workflow: how a `ProcessInstance` spawns a `ProcessRun`, how state transitions are validated and logged to `WorkflowTransitionLog`, and where I'd add real event-driven WebSocket broadcasting instead of the current polling fallback."

**Be ready for:** "Walk me through the code for X" as a live follow-up. If they ask you to open a specific file and explain a specific function, that's the moment this whole document was built for — you should be able to explain `access_scope.py` line by line without notes.

---

## Fast-recall cheat sheet (say these numbers cold)

| Fact | Number |
|---|---|
| Models (SQLAlchemy) | 96 |
| Total routes | 307 (159 GET / 87 POST / 39 PATCH / 14 DELETE / 6 PUT / 2 WS) |
| Router files | 30 |
| Service modules | 44 |
| Roles | 13 (10 active + 3 legacy aliases) |
| Role tiers | 5 (platform_admin → ceo → hod → supervisor → worker) |
| Org hierarchy depth | 4 (organisation → plant → department → process) |
| Foreign keys | 211 |
| ORM relationships | 99 |
| Unique constraints | 33 |
| Explicit secondary indexes | 0 (gap — only unique-constraint-backed indexes exist) |
| JWT expiry | 24h, HS256, no refresh token (gap) |
| Test coverage | 1 manual script, no automated suite (gap) |
| CI/CD | None (gap) |
| Docker services | 3 (postgres, backend, frontend) — no Redis/LB yet |

## The one meta-point to land

If there's one thing to make sure comes across: **you know exactly where the honest gaps are** (pagination, indexes, refresh tokens, WebSocket scaling, tests, CI/CD, caching) **and you have a specific, reasoned next step for each one** — that reads as far stronger engineering judgment to an interviewer than a system with no visible flaws, because no real system has no flaws, and pretending otherwise is the tell that you don't actually understand your own code.

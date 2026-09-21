# Scalability

This is a "how would this grow" document — nothing below is implemented, and most of it shouldn't be until there's an actual reason for it. The point of writing this down is to show the path exists and where the first real bottlenecks would show up, not to build the path prematurely.

## Where it stands today

Comfortably fine for the scale this was built for — a handful of tenants, each with a normal-sized team, normal order volume. The backend is already stateless in the way that matters most for scaling: nothing about a request depends on which instance handled the previous one. Session state doesn't exist (JWTs are self-contained), and permission/dashboard caching lives in Redis rather than in-process. 
The one exception, and it's a real one, is the SSE connection registry — it currently lives in memory on whichever instance accepted the connection, which means running more than one backend instance today would silently break real-time notifications for anyone connected to a different instance than the one that received their event. That's the first thing that would need fixing before running more than one instance, not the hundredth.

## Getting to a handful of instances

Once there's a reason to run more than one backend process — more traffic than one instance comfortably handles, or just wanting redundancy — the path is a standard one: put a load balancer in front, run several identical stateless instances behind it, and fix the SSE registry problem before doing so. The fix is to move connection tracking out of process memory and into something shared — Redis pub/sub is the natural choice, since Redis is already a dependency. Each instance subscribes to a channel per organization; when any instance's RabbitMQ consumer receives an event, it publishes to that channel, and whichever instances have open SSE connections for that organization forward it to their clients. This is exactly the kind of change the `NotificationPushPort` interface was written to make painless — it's a new adapter, not a rewrite of anything that calls it.

The outbox relay already assumes multiple instances might run it concurrently (`SELECT ... FOR UPDATE SKIP LOCKED` is specifically there so two instances polling at the same time don't double-publish an event), so that part doesn't need to change at all.

Database connection pooling matters more as instance count grows — each instance holds its own pool, and Postgres has a hard ceiling on total connections. HikariCP (Spring Boot's default) is already in use; the main adjustment at this stage is tuning pool size per instance down as instance count goes up, so the total across all instances stays under the database's limit, and considering something like PgBouncer in front of Postgres if connection count becomes the actual constraint rather than query throughput.

## Read-heavy load

Dashboard summaries, product/warehouse/inventory listings — these are read far more often than they're written, and Postgres read replicas are the standard answer once the primary starts feeling read pressure. This needs a bit of care given how central "read your own writes" correctness is here: an order that was just created needs to show up in that organization's order list immediately, not after replication lag catches up. The safe approach is routing anything tenant-critical (an order just placed, inventory just adjusted) to the primary, and routing broader listing/reporting queries to a replica — which is also exactly the kind of query that benefits most from not competing with write traffic on the same node.

The Redis caching that's already in place (dashboard summaries, resolved permissions) does a lot of this work today without needing a replica at all, and would matter even more at higher scale — the 60-second TTL and explicit eviction-on-write pattern already used for the dashboard is the same shape that'd extend to caching product/warehouse listings if those started showing up as hot paths.

## Increasing the number of postgres Instances

This is further out than anything above, and worth being honest that it changes the nature of the system rather than just scaling it. If a single tenant organization somehow grew large enough that its own data no longer fit comfortably on one machine — which would be an unusual amount of data for what this system models — partitioning `orders` and `audit_logs` by time range (they're naturally append-heavy and old rows are read far less often than recent ones) would be the first move, since Postgres native partitioning handles that well without touching application code.

Sharding by `organization_id` is the other natural axis, precisely because that's already the boundary every query filters on — a tenant's data never needs to join across a shard boundary. This is a genuinely large undertaking (routing logic, cross-shard admin queries for the platform owner, migration of existing data) and isn't something to reach for without very concrete evidence a single, well-tuned Postgres instance is the actual bottleneck, which for this domain would take a lot of tenants at real scale to hit.

## Caching and the edge

Redis clustering (rather than a single instance) is the straightforward next step if Redis itself became a bottleneck or a single point of failure worth avoiding — Redis Cluster or a managed equivalent, sharding cache keys across nodes. Nothing about the current caching strategy assumes a single Redis instance in a way that would make this hard; keys are already namespaced per organization.

A CDN in front of the frontend's static assets (the built JS/CSS bundle) is close to free to add and worth doing well before any of the backend-scaling steps above — it's serving the same handful of files to everyone, there's no reason those should ever hit the origin server after the first request in a region.

## The message queue and async processing

RabbitMQ with one exchange and one queue is deliberately minimal right now because there's exactly one consumer. If notification volume grew enough to need it, splitting into per-event-type queues (or several consumer instances competing for the same queue) would let notification processing scale independently of everything else — nothing about the current `EventPublisher`/`MessageBrokerPort` split assumes a single queue, so this is a broker-side and consumer-side change, not an application rewrite.

The outbox relay's one-second poll interval is a reasonable default; if event volume grew enough that polling became the bottleneck rather than the broker itself, `LISTEN`/`NOTIFY` on the outbox table (or just running more relay instances, which the row-locking already supports safely) would remove that latency without a design change.

## Observability

Right now, the honest answer is: not much beyond application logs and Actuator's health endpoint. Structured logging with request correlation IDs is worth doing before scaling out matters much, purely because debugging a problem across several instances without a way to trace one request through all of them is genuinely painful — that's an operational necessity more than a scaling one, and it's called out in `KNOWN_LIMITATIONS.md` as something not yet in place. Beyond that, the standard next steps are what you'd expect: metrics (request latency, queue depth, cache hit rate) exported somewhere like Prometheus, and distributed tracing once there are enough hops between services that a log line in one place doesn't tell the whole story. None of this is hard to add later — Spring Boot's Actuator already exposes the hooks most of these tools plug into — it's just explicitly not where the effort went for this pass, per the assignment's own guidance not to over-invest in observability infrastructure early.

## Rate limiting

Not implemented, documented as an intended strategy. When it's needed, the natural place to add it is at the API gateway/load-balancer layer rather than in application code, so it protects the backend before a request even reaches it.


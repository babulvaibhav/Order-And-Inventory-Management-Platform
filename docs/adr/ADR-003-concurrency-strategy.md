# ADR-003: Atomic conditional updates instead of application-level locking

## Status

Accepted

## Context

Preventing overselling under concurrent requests is called out as one of the most heavily-weighted things this project gets evaluated on, so it's worth being deliberate about the mechanism rather than picking something that looks right and hoping.

The obvious-looking approach — read the current available quantity, check in application code whether it's enough, then write the new quantity — has a race condition between the read and the write. Two requests can both read the same "5 available" before either writes anything back, both conclude there's enough stock, and both proceed. This isn't a rare edge case under real concurrent load; it's the default outcome once two requests land close enough together, which is exactly the scenario the assignment's mandatory concurrency test is built to trigger (100 concurrent requests against 10 units of stock).

The standard fixes for this are optimistic locking (a version column, retry on conflict) or pessimistic locking (`SELECT ... FOR UPDATE`, holding a row lock across the check and the write). Both work, but both also mean the application still has to coordinate the check and the write itself, with a retry loop or an explicit lock scope to get right.

## Decision

Push the check into the same atomic statement as the write, letting the database do both in one indivisible operation:

```sql
UPDATE inventory
SET available_quantity = available_quantity - :quantity,
    reserved_quantity = reserved_quantity + :quantity
WHERE id = :id AND organization_id = :organizationId
  AND available_quantity >= :quantity;
```

The database only applies this update if the row still satisfies the condition at the moment it runs, and it evaluates that condition and performs the write as one operation under the row's own lock — there's no gap between "check" and "write" for a second transaction to land in. The application code doesn't need a retry loop or an explicit lock; it just checks how many rows the update affected. One means it succeeded. Zero means the condition failed — insufficient stock, or a nonexistent/wrong-tenant row — and the application responds with a specific `INSUFFICIENT_INVENTORY` error rather than a generic failure.

The same pattern applies everywhere something needs to change conditionally under concurrency: releasing a reservation only succeeds if there's enough reserved quantity to release, and an order's status transition (`UPDATE orders SET status = :new WHERE id = :id AND status = :expected`) only succeeds if the order is still in the status the caller expected — which is what stops two simultaneous cancel requests for the same order from both passing a plain read-then-check and both releasing the same stock twice.

For operations that touch more than one row — a multi-item order reserving several inventory rows, or a transfer touching a source and a destination — the rows are sorted into a consistent order before anything gets locked, specifically so two transactions touching the same two rows in opposite orders can't deadlock waiting on each other.

## Consequences

The mandatory concurrency test (100 concurrent requests against 10 units of stock) passes because there is genuinely no window in which two requests can both believe they've reserved the same unit — not because the test happens not to trigger the race, but because the race doesn't exist at the database level. This is verifiable by inspection of the SQL, not just by the test passing once.

The cost is that this pattern needs to be applied consistently everywhere a similar check-then-write matters, and a future change that reverts to a plain read-then-write for a new operation would silently reintroduce the exact problem this solves. That's a discipline to maintain, not something enforced automatically by the framework — worth flagging honestly rather than pretending the pattern makes the whole codebase race-proof by default.

#!/usr/bin/env bash
# Live version of the assignment's concurrency scenario (section 8):
# stock = 1, many people try to buy it at the same moment, exactly one should win.
#
# Needs: the backend running on localhost:8080, curl, and node (only used to read JSON).
# Usage: bash scripts/demo-concurrency.sh [number-of-parallel-buyers]

API="${API:-http://localhost:8080/api/v1}"
BUYERS="${1:-10}"
EMAIL="${DEMO_EMAIL:-admin@uphead.com}"
PASSWORD="${DEMO_PASSWORD:-adminPassword}"

json() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log($1)})"; }

TOKEN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | json "j.accessToken")
AUTH="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

WAREHOUSE=$(curl -s "$API/warehouses" -H "$AUTH" | json "j.content[0].id")
CUSTOMER=$(curl -s "$API/customers" -H "$AUTH" | json "j.content[0].id")
SKU="DEMO-$(date +%s)"

PRODUCT=$(curl -s -X POST "$API/products" -H "$AUTH" -H "$CT" \
  -d "{\"sku\":\"$SKU\",\"name\":\"Last Unit Demo\",\"description\":\"concurrency demo\",\"price\":10}" | json "j.id")
INVENTORY=$(curl -s -X POST "$API/inventory" -H "$AUTH" -H "$CT" \
  -d "{\"warehouseId\":\"$WAREHOUSE\",\"productId\":\"$PRODUCT\",\"quantity\":1}" | json "j.id")

echo "Product $SKU now has exactly 1 unit in stock."
echo "Sending $BUYERS orders for that 1 unit, all at the same time..."
echo

for i in $(seq 1 "$BUYERS"); do
  curl -s -o /dev/null -w "buyer $i -> HTTP %{http_code}\n" -X POST "$API/orders" -H "$AUTH" -H "$CT" \
    -d "{\"customerId\":\"$CUSTOMER\",\"items\":[{\"productId\":\"$PRODUCT\",\"warehouseId\":\"$WAREHOUSE\",\"quantity\":1}]}" &
done
wait

echo
echo "Stock afterwards:"
curl -s "$API/inventory/$INVENTORY" -H "$AUTH" | json "'available=' + j.availableQuantity + '  reserved=' + j.reservedQuantity"

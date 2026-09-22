# 好测试与坏测试

## 好测试

**集成式**：通过真实接口测试，而不是内部部分的 mock。

```typescript
// 好：测试可观察行为
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

特征：

- 测试用户/调用方关心的行为
- 只使用公共 API
- 在内部重构中存活
- 描述 WHAT，而不是 HOW
- 每个测试一个逻辑断言

## 坏测试

**实现细节测试**：耦合到内部结构。

```typescript
// 坏：测试实现细节
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

红旗：

- Mock 内部协作者
- 测试私有方法
- 断言调用次数/顺序
- 重构时测试坏了但行为没变
- 测试名描述 HOW 而不是 WHAT
- 通过外部手段而非接口验证

```typescript
// 坏：绕过接口验证
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// 好：通过接口验证
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

**同义反复测试**：期望值重述了实现，所以测试按构造就通过。

```typescript
// 坏：期望值按代码的计算方式重新计算
test("calculateTotal sums line items", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// 好：期望值是一个独立的、已知的字面量
test("calculateTotal sums line items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

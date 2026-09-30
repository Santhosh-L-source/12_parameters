const { createBreaker, getBreaker } = require('../src/resilience/circuitBreaker');

describe('Circuit Breaker', () => {
  it('should create and cache a breaker by name', () => {
    const fn = async () => 'ok';
    const breaker = createBreaker('test-platform', fn);
    expect(breaker).toBeDefined();
    expect(getBreaker('test-platform')).toBe(breaker);
  });

  it('should return cached breaker on second create', () => {
    const fn1 = async () => 'one';
    const fn2 = async () => 'two';
    const b1 = createBreaker('cached-test', fn1);
    const b2 = createBreaker('cached-test', fn2);
    expect(b1).toBe(b2);
  });

  it('should pass through successful calls', async () => {
    const fn = async (x) => x * 2;
    const breaker = createBreaker('pass-through', fn);
    const result = await breaker.fire(5);
    expect(result).toBe(10);
  });

  it('should propagate errors', async () => {
    const fn = async () => {
      throw new Error('boom');
    };
    const breaker = createBreaker('error-test', fn);
    await expect(breaker.fire()).rejects.toThrow('boom');
  });
});

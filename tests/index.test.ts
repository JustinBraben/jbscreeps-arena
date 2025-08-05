import { hello, add } from '../src/common/hello';

describe('testing hello', () => {
  test('hello should result in Hello, World!', () => {
    expect(hello()).toBe("Hello, World!");
  });
});

describe('testing index file', () => {
  test('empty string should result in zero', () => {
    expect(add('')).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { processInput, tokenize, formatTokens, ToolResult, Dialect } from '../src/tool.ts';

describe('SQL Formatter', () => {
  it('formats a simple SELECT query', () => {
    const input = 'select id, name from users where active = true;';
    const result = processInput(input);
    expect(result.success).toBe(true);
    expect(result.data).toContain('SELECT');
    expect(result.data).toContain('FROM');
    expect(result.data).toContain('WHERE');
    expect(result.data).toContain('id, name');
    expect(result.data).toContain('users');
    expect(result.data).toContain('active = true');
  });

  it('preserves comments and string literals', () => {
    const input = "select 'hello world', id from users; -- comment\n/* multi\nline */";
    const result = processInput(input);
    expect(result.success).toBe(true);
    expect(result.data).toContain("'hello world'");
    expect(result.data).toContain('-- comment');
    expect(result.data).toContain('/* multi');
    expect(result.data).toContain('line */');
  });

  it('handles nested subqueries with indentation', () => {
    const input = 'select * from (select id from users where active = true) as sub;';
    const result = processInput(input);
    expect(result.success).toBe(true);
    // Check that there is indentation for subquery
    expect(result.data).toMatch(/\n\s+SELECT/);
    expect(result.data).toMatch(/\n\s+FROM/);
  });

  it('returns error for empty input', () => {
    const result = processInput('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('tokenizes keywords, identifiers, strings, comments', () => {
    const tokens = tokenize("SELECT 'test', id FROM users;");
    const types = tokens.map(t => t.type);
    expect(types).toContain('keyword');
    expect(types).toContain('string');
    expect(types).toContain('identifier');
    expect(types).toContain('punctuation');
  });
});


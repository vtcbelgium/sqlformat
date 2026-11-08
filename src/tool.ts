/**
 * SQL Formatter & Dialect Beautifier - Pure TypeScript Domain Module
 * Tokenizes and beautifies SQL queries with uppercase keywords, dialect rules,
 * indentation levels, subquery nesting, and preserved comments/string literals.
 */

export interface ToolResult {
  success: boolean;
  data: string;
  error?: string;
  warnings?: string[];
}

export type Dialect = 'postgresql' | 'mysql' | 'sqlite' | 'bigquery';

export interface FormatOptions {
  dialect: Dialect;
  indentSize: number;
  uppercaseKeywords: boolean;
}

const DEFAULT_OPTIONS: FormatOptions = {
  dialect: 'postgresql',
  indentSize: 2,
  uppercaseKeywords: true,
};

// Keyword sets per dialect (subset for demonstration)
const KEYWORDS: Record<Dialect, Set<string>> = {
  postgresql: new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
    'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT', 'UPDATE', 'DELETE', 'INTO', 'VALUES', 'SET',
    'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER',
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE',
    'IS', 'NULL',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'DISTINCT', 'AS', 'ON', 'USING',
    'UNION', 'INTERSECT', 'EXCEPT',
    'WITH', 'RECURSIVE',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'CHECK',
    'BEGIN', 'COMMIT', 'ROLLBACK',
  ]),
  mysql: new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT', 'UPDATE', 'DELETE', 'INTO', 'VALUES', 'SET',
    'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER',
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
    'IS', 'NULL',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'DISTINCT', 'AS', 'ON', 'USING',
    'UNION', 'INTERSECT', 'EXCEPT',
    'WITH', 'RECURSIVE',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'CHECK',
    'BEGIN', 'COMMIT', 'ROLLBACK',
  ]),
  sqlite: new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT', 'UPDATE', 'DELETE', 'INTO', 'VALUES', 'SET',
    'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER',
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
    'IS', 'NULL',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'DISTINCT', 'AS', 'ON', 'USING',
    'UNION', 'INTERSECT', 'EXCEPT',
    'WITH', 'RECURSIVE',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'CHECK',
    'BEGIN', 'COMMIT', 'ROLLBACK',
  ]),
  bigquery: new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
    'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT', 'UPDATE', 'DELETE', 'INTO', 'VALUES', 'SET',
    'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER',
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
    'IS', 'NULL',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'DISTINCT', 'AS', 'ON', 'USING',
    'UNION', 'INTERSECT', 'EXCEPT',
    'WITH', 'RECURSIVE',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'CHECK',
    'BEGIN', 'COMMIT', 'ROLLBACK',
    'PARTITION BY', 'CLUSTER BY',
  ]),
};

// Token types
export type TokenType =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'whitespace'
  | 'number'
  | 'unknown';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Tokenizes SQL input preserving strings, comments, and structure
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;
  const len = input.length;

  while (i < len) {
    const char = input[i];
    const startColumn = column;

    // Whitespace
    if (/\s/.test(char)) {
      let value = '';
      while (i < len && /\s/.test(input[i])) {
        value += input[i];
        if (input[i] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
        i++;
      }
      tokens.push({ type: 'whitespace', value, line, column: startColumn });
      continue;
    }

    // Single-line comment
    if (char === '-' && i + 1 < len && input[i + 1] === '-') {
      let value = '--';
      i += 2;
      column += 2;
      while (i < len && input[i] !== '\n') {
        value += input[i];
        i++;
        column++;
      }
      tokens.push({ type: 'comment', value, line, column: startColumn });
      continue;
    }

    // Multi-line comment
    if (char === '/' && i + 1 < len && input[i + 1] === '*') {
      let value = '/*';
      i += 2;
      column += 2;
      while (i < len && !(input[i] === '*' && i + 1 < len && input[i + 1] === '/')) {
        value += input[i];
        if (input[i] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
        i++;
      }
      if (i + 1 < len) {
        value += '*/';
        i += 2;
        column += 2;
      }
      tokens.push({ type: 'comment', value, line, column: startColumn });
      continue;
    }

    // String literals (single quoted)
    if (char === "'") {
      let value = "'";
      i++;
      column++;
      while (i < len) {
        value += input[i];
        if (input[i] === "'" && (i + 1 >= len || input[i + 1] !== "'")) {
          i++;
          column++;
          break;
        }
        if (input[i] === "'" && input[i + 1] === "'") {
          // Escaped quote
          value += input[i + 1];
          i += 2;
          column += 2;
          continue;
        }
        if (input[i] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
        i++;
      }
      tokens.push({ type: 'string', value, line, column: startColumn });
      continue;
    }

    // Double quoted identifiers (PostgreSQL)
    if (char === '"') {
      let value = '"';
      i++;
      column++;
      while (i < len) {
        value += input[i];
        if (input[i] === '"' && (i + 1 >= len || input[i + 1] !== '"')) {
          i++;
          column++;
          break;
        }
        if (input[i] === '"' && input[i + 1] === '"') {
          value += input[i + 1];
          i += 2;
          column += 2;
          continue;
        }
        if (input[i] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
        i++;
      }
      tokens.push({ type: 'identifier', value, line, column: startColumn });
      continue;
    }

    // Numbers
    if (/\d/.test(char)) {
      let value = '';
      while (i < len && /[\d.]/.test(input[i])) {
        value += input[i];
        i++;
        column++;
      }
      tokens.push({ type: 'number', value, line, column: startColumn });
      continue;
    }

    // Operators and punctuation
    if (/[=<>!+\-*/%,;().]/.test(char)) {
      // Check for multi-char operators
      if (char === '=' && i + 1 < len && input[i + 1] === '=') {
        tokens.push({ type: 'operator', value: '==', line, column: startColumn });
        i += 2;
        column += 2;
      } else if (char === '!' && i + 1 < len && input[i + 1] === '=') {
        tokens.push({ type: 'operator', value: '!=', line, column: startColumn });
        i += 2;
        column += 2;
      } else if (char === '<' && i + 1 < len && input[i + 1] === '=') {
        tokens.push({ type: 'operator', value: '<=', line, column: startColumn });
        i += 2;
        column += 2;
      } else if (char === '>' && i + 1 < len && input[i + 1] === '=') {
        tokens.push({ type: 'operator', value: '>=', line, column: startColumn });
        i += 2;
        column += 2;
      } else if (char === '<' && i + 1 < len && input[i + 1] === '>') {
        tokens.push({ type: 'operator', value: '<>', line, column: startColumn });
        i += 2;
        column += 2;
      } else {
        const type = char === '(' || char === ')' || char === ',' || char === ';' || char === '.' ? 'punctuation' : 'operator';
        tokens.push({ type, value: char, line, column: startColumn });
        i++;
        column++;
      }
      continue;
    }

    // Identifiers and keywords
    let value = '';
    while (i < len && /[a-zA-Z0-9_$]/.test(input[i])) {
      value += input[i];
      i++;
      column++;
    }

    if (value) {
      const upperValue = value.toUpperCase();
      const dialectKeywords = KEYWORDS.postgresql; // Default for tokenization
      const isKeyword = dialectKeywords.has(upperValue) || 
        (value.includes(' ') && dialectKeywords.has(upperValue));
      tokens.push({
        type: isKeyword ? 'keyword' : 'identifier',
        value,
        line,
        column: startColumn,
      });
      continue;
    }

    // Unknown character
    tokens.push({ type: 'unknown', value: char, line, column: startColumn });
    i++;
    column++;
  }

  return tokens;
}

/**
 * Formats tokens into beautified SQL with proper indentation
 */
export function formatTokens(tokens: Token[], options: FormatOptions = DEFAULT_OPTIONS): string {
  const { indentSize, uppercaseKeywords } = options;
  const majorKeywords = new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
    'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'SET',
    'UNION', 'INTERSECT', 'EXCEPT'
  ]);

  let result = '';
  let indentLevel = 0;
  const filtered = tokens.filter(t => t.type !== 'whitespace');
  const getIndent = () => ' '.repeat(indentLevel * indentSize);

  for (let i = 0; i < filtered.length; i++) {
    const token = filtered[i];
    let val = token.value;
    const upper = val.toUpperCase();
    const isKeyword = token.type === 'keyword';

    if (isKeyword && uppercaseKeywords) {
      val = upper;
    }

    if (token.type === 'punctuation' && token.value === '(') {
      result += '(';
      const nextTok = filtered[i + 1];
      if (nextTok && nextTok.type === 'keyword' && nextTok.value.toUpperCase() === 'SELECT') {
        indentLevel++;
        result += '\n' + getIndent();
      }
      continue;
    }

    if (token.type === 'punctuation' && token.value === ')') {
      if (indentLevel > 0) {
        indentLevel--;
        result += '\n' + getIndent();
      }
      result += ')';
      continue;
    }

    if (token.type === 'punctuation' && token.value === ';') {
      result += ';';
      continue;
    }

    if (token.type === 'punctuation' && token.value === ',') {
      result += ', ';
      continue;
    }

    if (token.type === 'operator') {
      result += ` ${val} `;
      continue;
    }

    if (isKeyword && majorKeywords.has(upper)) {
      if (result.length > 0 && !result.endsWith('\n' + getIndent()) && !result.endsWith('\n') && !result.endsWith('(')) {
        result += '\n' + getIndent();
      }
      result += val + ' ';
      continue;
    }

    if (result.length > 0 && !result.endsWith(' ') && !result.endsWith('\n') && !result.endsWith('(')) {
      result += ' ';
    }
    result += val;
  }

  return result.replace(/ +/g, ' ').replace(/\( +/g, '(').trim();
}

/**
 * Main entry point for processing SQL input
 */
export function processInput(input: string): ToolResult {
  if (!input || !input.trim()) {
    return {
      success: false,
      data: '',
      error: 'Input cannot be empty',
    };
  }

  try {
    const tokens = tokenize(input);
    const formatted = formatTokens(tokens, DEFAULT_OPTIONS);
    
    return {
      success: true,
      data: formatted,
    };
  } catch (error) {
    return {
      success: false,
      data: '',
      error: error instanceof Error ? error.message : 'Unknown formatting error',
    };
  }
}


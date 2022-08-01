import { Tsep } from './tsep';
import { TsepError } from './TsepError';
import { Expression } from './types';

describe('tsep', () => {
  it('should work', () => {
    expect(Tsep.create().parse(`foo(123)`)).toEqual({
      arguments: [{ raw: '123', type: 'Literal', value: 123 }],
      callee: { name: 'foo', type: 'Identifier' },
      type: 'CallExpression',
    });
  });
  it('should use separate operator lists', () => {
    expect(
      Tsep.create().addBinaryOp(':', 0, false).parse(`foo:bar(123)`)
    ).toEqual({
      left: { name: 'foo', type: 'Identifier' },
      operator: ':',
      right: {
        arguments: [{ raw: '123', type: 'Literal', value: 123 }],
        callee: { name: 'bar', type: 'Identifier' },
        type: 'CallExpression',
      },
      type: 'BinaryExpression',
    });
    expect(() => Tsep.create().parse(`foo:bar(123)`)).toThrowError(TsepError);
  });

  const defaultParser = Tsep.create();
  const testParser = (expr: string, match: DeepPartial<Expression>) =>
    expect(defaultParser.parse(expr)).toMatchObject(match);

  describe('Expression Parser', () => {
    it('Constants', function () {
      testParser("'abc'", { value: 'abc' });
      testParser('"abc"', { value: 'abc' });
      testParser('123', { value: 123 });
      testParser('12.3', { value: 12.3 });
    });
  });

  describe('Literal Parsing', () => {
    [
      ["'a \\w b'", 'a w b'],
      ["'a \\' b'", "a ' b"],
      ["'a \\n b'", 'a \n b'],
      ["'a \\r b'", 'a \r b'],
      ["'a \\t b'", 'a \t b'],
      ["'a \\b b'", 'a \b b'],
      ["'a \\f b'", 'a \f b'],
      ["'a \\v b'", 'a \v b'],
      ["'a \\ b'", 'a  b'],
    ].forEach((t) =>
      it(`Should parse ${t[0]}`, () => {
        testParser(t[0], { value: t[1], raw: t[0] });
      })
    );
  });

  it('Variables', function () {
    testParser('abc', { name: 'abc' });
    testParser('a.b[c[0]]', {
      property: {
        type: 'MemberExpression',
      },
    });
    testParser('Δέλτα', { name: 'Δέλτα' });
    testParser('a?.b?.(arg)?.[c] ?. d', {
      type: 'MemberExpression',
      optional: true,
    });
  });

  it('Function Calls', function () {
    testParser('a(b, c(d,e), f)', {});
    testParser('a b + c', {});
    testParser("'a'.toString()", {});
    testParser('[1].length', {});
    testParser(';', {});
    // allow all spaces or all commas to separate arguments
    testParser('check(a, b, c, d)', {});
    testParser('check(a b c d)', {});
  });

  it('Arrays', function () {
    testParser('[]', { type: 'ArrayExpression', elements: [] });

    testParser('[a]', {
      type: 'ArrayExpression',
      elements: [{ type: 'Identifier', name: 'a' }],
    });
  });

  describe('Ops', () => {
    const scopedParser = Tsep.create().addBinaryOp('**', 11, true);

    [
      '1',
      '1+2',
      '1*2',
      '1*(2+3)',
      '(1+2)*3',
      '(1+2)*3+4-2-5+2/2*3',
      '1 + 2-   3*	4 /8',
      '\n1\r\n+\n2\n',
      '1 + -2',
      '-1 + -2 * -3 * 2',
      '2 ** 3 ** 4',
      '2 ** 3 ** 4 * 5 ** 6 ** 7 * (8 + 9)',
      '(2 ** 3) ** 4 * (5 ** 6 ** 7) * (8 + 9)',
    ].forEach((expr) =>
      it(`Expr: ${expr.split('\r').join('\\r')}`, () =>
        expect(scopedParser.parse(expr)).toMatchSnapshot())
    );
  });

  it('Custom operators', () => {
    const scopedParser = Tsep.create();

    const testParser = (expr: string, match: DeepPartial<Expression>) =>
      expect(scopedParser.parse(expr)).toMatchObject(match);

    scopedParser.addBinaryOp('^', 10);
    testParser('a^b', {});
    scopedParser.removeBinaryOp('^');

    scopedParser.addBinaryOp('×', 9);
    testParser('a×b', {
      type: 'BinaryExpression',
      left: { name: 'a' },
      right: { name: 'b' },
    });
    scopedParser.removeBinaryOp('×');

    scopedParser.addBinaryOp('or', 1);
    testParser('oneWord ordering anotherWord', {
      type: 'Compound',
      body: [
        {
          type: 'Identifier',
          name: 'oneWord',
        },
        {
          type: 'Identifier',
          name: 'ordering',
        },
        {
          type: 'Identifier',
          name: 'anotherWord',
        },
      ],
    });
    scopedParser.removeBinaryOp('or');

    scopedParser.addUnaryOp('#');
    testParser('#a', {
      type: 'UnaryExpression',
      operator: '#',
      argument: { type: 'Identifier', name: 'a' },
    });
    scopedParser.removeUnaryOp('#');

    scopedParser.addUnaryOp('not');
    testParser('not a', {
      type: 'UnaryExpression',
      operator: 'not',
      argument: { type: 'Identifier', name: 'a' },
    });
    scopedParser.removeUnaryOp('not');

    scopedParser.addUnaryOp('notes');
    testParser('notes', {
      type: 'Identifier',
      name: 'notes',
    });
    scopedParser.removeUnaryOp('notes');
  });

  it('Custom alphanumeric operators', () => {
    const scopedParser = Tsep.create();

    const testParser = (expr: string, match: DeepPartial<Expression>) =>
      expect(scopedParser.parse(expr)).toMatchObject(match);

    scopedParser.addBinaryOp('and', 2);
    testParser('a and b', {
      type: 'BinaryExpression',
      operator: 'and',
      left: { type: 'Identifier', name: 'a' },
      right: { type: 'Identifier', name: 'b' },
    });
    testParser('bands', { type: 'Identifier', name: 'bands' });

    testParser('b ands', { type: 'Compound' });
    scopedParser.removeBinaryOp('and');

    scopedParser.addUnaryOp('not');
    testParser('not a', {
      type: 'UnaryExpression',
      operator: 'not',
      argument: { type: 'Identifier', name: 'a' },
    });
    testParser('notes', { type: 'Identifier', name: 'notes' });
    scopedParser.removeUnaryOp('not');
  });

  it('Custom identifier characters', () => {
    const scopedParser = Tsep.create();

    const testParser = (expr: string, match: DeepPartial<Expression>) =>
      expect(scopedParser.parse(expr)).toMatchObject(match);

    scopedParser.addIdentifierChar('@');
    testParser('@asd', {
      type: 'Identifier',
      name: '@asd',
    });
    scopedParser.removeIdentifierChar('@');
  });

  it('Bad Numbers', () => {
    testParser('1.', { type: 'Literal', value: 1, raw: '1.' });
    expect(() => {
      defaultParser.parse('1.2.3');
    }).toThrowError(TsepError);
  });

  function parseExprThrows(expr: string, name: string) {
    it(name, () => expectParseToThrow(expr));
  }

  function expectParseToThrow(expr: string) {
    expect(() => defaultParser.parse(expr)).toThrowError(TsepError);
  }

  describe('Missing arguments', () => {
    parseExprThrows('check(,)', 'detects missing argument (all)');
    parseExprThrows('check(,1,2)', 'detects missing argument (head)');
    parseExprThrows('check(1,,2)', 'detects missing argument (intervening)');
    parseExprThrows('check(1,2,)', 'detects missing argument (tail)');
    parseExprThrows('check(a, b c d) ', 'spaced arg after 1 comma');
    parseExprThrows('check(a, b, c d)', 'spaced arg at end');
    parseExprThrows('check(a b, c, d)', 'spaced arg first');
    parseExprThrows('check(a b c, d)', 'spaced args first');
  });

  describe('Uncompleted expression-call/array', () => {
    parseExprThrows('myFunction(a,b', 'detects unfinished expression call');
    parseExprThrows('[1,2', 'detects unfinished array');
    parseExprThrows('-1+2-', 'detects trailing operator');
  });

  [
    '!',
    '*x',
    '||x',
    '?a:b',
    '.',
    '()()',
    // '()', should throw 'unexpected )'...
    '() + 1',
  ].forEach((expr) => {
    parseExprThrows(expr, `should throw on invalid expr "${expr}"`);
  });

  describe('Hooks', () => {
    describe('gobble-spaces', () => {
      it('should allow manipulating what is considered whitespace', () => {
        const expr = 'a // skip all this';

        expectParseToThrow(expr);

        const parserInstance = Tsep.create();

        const testParser = (expr: string, match: DeepPartial<Expression>) =>
          expect(parserInstance.parse(expr)).toMatchObject(match);

        parserInstance.hooks.add('gobble-spaces', function () {
          if (this.char === '/' && this.expr.charAt(this.index + 1) === '/') {
            this.index += 2;
            while (!isNaN(this.code)) {
              this.index++;
            }
          }
        });
        testParser('a // skip all this', { type: 'Identifier' });
      });
    });

    describe('gobble-expression', () => {
      it('should accept this.node set by hook', () => {
        const expr = 'fn( 4 * 2';

        expectParseToThrow(expr);

        const parserInstance = Tsep.create();

        const testParser = (expr: string, match: DeepPartial<Expression>) =>
          expect(parserInstance.parse(expr)).toMatchObject(match);

        parserInstance.hooks.add(
          'gobble-expression',
          function (env) {
            if (this.char === 'f') {
              this.index += 9;
              env.node = { type: 'custom' };
            }
          },
          true
        );
        testParser(expr, { type: 'custom' });
      });

      it('should stop at first hook returning a node', () => {
        const expr = 'fn( 4 * 2';

        expectParseToThrow(expr);

        const parserInstance = Tsep.create();

        const testParser = (expr: string, match: DeepPartial<Expression>) =>
          expect(parserInstance.parse(expr)).toMatchObject(match);

        parserInstance.hooks.add(
          'gobble-expression',
          function (env) {
            if (this.char === 'f') {
              this.index += 9;
              env.node = { type: 'custom' };
            }
          },
          true
        );
        parserInstance.hooks.add('gobble-expression', function (env) {
          env.node = { type: 'wrong' };
        });
        testParser(expr, { type: 'custom' });
      });
    });

    describe('after-expression', () => {
      it('should allow altering an expression', () => {
        const parserInstance = Tsep.create();

        const testParser = (expr: string, match: DeepPartial<Expression>) =>
          expect(parserInstance.parse(expr)).toMatchObject(match);

        parserInstance.hooks.add('after-expression', function (env) {
          if (env.node) {
            env.node = { type: 'overruled' };
          }
        });
        testParser('1 + 2', { type: 'overruled' });
      });
    });

    describe('gobble-token', () => {
      it('should allow overriding gobbleToken', () => {
        const expr = '...';
        expectParseToThrow(expr);
        const parserInstance = Tsep.create();

        const testParser = (expr: string, match: DeepPartial<Expression>) =>
          expect(parserInstance.parse(expr)).toMatchObject(match);

        parserInstance.hooks.add('gobble-token', function (env) {
          if ([0, 1, 2].every((i) => this.expr.charAt(i) === '.')) {
            this.index += 3;
            env.node = { type: 'spread' };
          }
        });
        testParser(expr, { type: 'spread' });
      });

      it('should allow manipulating found token', () => {
        const after: (string | undefined)[] = [];
        const parserInstance = Tsep.create();

        parserInstance.hooks.add('after-token', function (env) {
          if (env.node) {
            env.node.type += ':)';
          }
          after.push(env.node?.type);
        });
        parserInstance.parse('a + 1 * !c(3) || d.e');
        expect(after.length).toEqual(4);
        expect(after[0]).toEqual('Identifier:)');
        expect(after[1]).toEqual('CallExpression:)');
        expect(after[2]).toEqual('UnaryExpression:)');
        expect(after[3]).toEqual('MemberExpression:)');
      });

      it('should stop processing hooks at first found node', () => {
        const expr = '...';

        expectParseToThrow(expr);

        const parserInstance = Tsep.create();

        const testParser = (expr: string, match: DeepPartial<Expression>) =>
          expect(parserInstance.parse(expr)).toMatchObject(match);

        parserInstance.hooks.add('gobble-token', function (env) {
          if ([0, 1, 2].every((i) => this.expr.charAt(i) === '.')) {
            this.index += 3;
            env.node = { type: 'spread' };
          }
        });
        parserInstance.hooks.add('gobble-token', function (env) {
          env.node = { type: 'wrong' };
        });
        testParser(expr, { type: 'spread' });
      });
    });
  });
});

type DeepPartial<T> = {
  [K in keyof T]?: DeepPartial<T[K]>;
};

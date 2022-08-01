import Hooks from './hooks';
import Plugins from './plugins';
import { TsepError } from './TsepError';
import {
  ArrayExpression,
  BinaryExpression,
  BinaryOpInfo,
  Expression,
  Identifier,
  Literal,
  Primitive,
} from './types';

export class Tsep {
  static COMPOUND = 'Compound' as const;
  static SEQUENCE_EXP = 'SequenceExpression' as const;
  static IDENTIFIER = 'Identifier' as const;
  static MEMBER_EXP = 'MemberExpression' as const;
  static LITERAL = 'Literal' as const;
  static THIS_EXP = 'ThisExpression' as const;
  static CALL_EXP = 'CallExpression' as const;
  static UNARY_EXP = 'UnaryExpression' as const;
  static BINARY_EXP = 'BinaryExpression' as const;
  static ARRAY_EXP = 'ArrayExpression' as const;

  static TAB_CODE = 9 as const;
  static LF_CODE = 10 as const;
  static CR_CODE = 13 as const;
  static SPACE_CODE = 32 as const;
  static PERIOD_CODE = 46 as const; // '.'
  static COMMA_CODE = 44 as const; // ','
  static SQUOTE_CODE = 39 as const; // single quote
  static DQUOTE_CODE = 34 as const; // double quotes
  static OPAREN_CODE = 40 as const; // (
  static CPAREN_CODE = 41 as const; // )
  static OBRACK_CODE = 91 as const; // [
  static CBRACK_CODE = 93 as const; // ]
  static QUMARK_CODE = 63 as const; // ?
  static SEMCOL_CODE = 59 as const; // ;
  static COLON_CODE = 58 as const; // :

  static create() {
    return new TsepEngine();
  }
}

export class TsepEngine {
  // Operations
  // ----------
  // Use a quickly-accessible map to store all of the unary operators
  // Values are set to `1` (it really doesn't matter)
  unary_ops = new Map<string, number>(
    Object.entries({
      '-': 1,
      '!': 1,
      '~': 1,
      '+': 1,
    })
  );

  // Also use a map for the binary operations but set their values to their
  // binary precedence for quick reference (higher number = higher precedence)
  // see [Order of operations](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence)
  binary_ops = new Map<string, number>(
    Object.entries({
      '||': 1,
      '&&': 2,
      '|': 3,
      '^': 4,
      '&': 5,
      '==': 6,
      '!=': 6,
      '===': 6,
      '!==': 6,
      '<': 7,
      '>': 7,
      '<=': 7,
      '>=': 7,
      '<<': 8,
      '>>': 8,
      '>>>': 8,
      '+': 9,
      '-': 9,
      '*': 10,
      '/': 10,
      '%': 10,
    })
  );

  // sets specific binary_ops as right-associative
  right_associative = new Set();

  // Additional valid identifier chars, apart from a-z, A-Z and 0-9 (except on the starting char)
  additional_identifier_chars = new Set(['$', '_']);

  // Literals
  // ----------
  // Store the values to return for the various literals we may encounter
  literals = new Map<string, Primitive>(
    Object.entries({
      true: true,
      false: false,
      null: null,
    })
  );

  // Except for `this`, which is special. This could be changed to something like `'self'` as well
  this_str = 'this';

  max_unop_len = this.getMaxKeyLen(this.unary_ops.keys());
  max_binop_len = this.getMaxKeyLen(this.binary_ops.keys());

  hooks = new Hooks();

  plugins = new Plugins(this);

  // ==================== CONFIG ================================
  addUnaryOp(op_name: string) {
    this.max_unop_len = Math.max(op_name.length, this.max_unop_len);
    this.unary_ops.set(op_name, 1);
    return this;
  }

  addBinaryOp(
    op_name: string,
    precedence: number,
    isRightAssociative?: boolean
  ) {
    this.max_binop_len = Math.max(op_name.length, this.max_binop_len);
    this.binary_ops.set(op_name, precedence);
    if (isRightAssociative) {
      this.right_associative.add(op_name);
    } else {
      this.right_associative.delete(op_name);
    }
    return this;
  }

  addIdentifierChar(char: string) {
    this.additional_identifier_chars.add(char);
    return this;
  }

  addLiteral(literal_name: string, literal_value: Primitive) {
    this.literals.set(literal_name, literal_value);
    return this;
  }

  removeUnaryOp(op_name: string) {
    this.unary_ops.delete(op_name);
    if (op_name.length === this.max_unop_len) {
      this.max_unop_len = this.getMaxKeyLen(this.unary_ops.keys());
    }
    return this;
  }

  removeAllUnaryOps() {
    this.unary_ops.clear();
    this.max_unop_len = 0;

    return this;
  }

  removeIdentifierChar(char: string) {
    this.additional_identifier_chars.delete(char);
    return this;
  }

  removeBinaryOp(op_name: string) {
    this.binary_ops.delete(op_name);

    if (op_name.length === this.max_binop_len) {
      this.max_binop_len = this.getMaxKeyLen(this.binary_ops.keys());
    }
    this.right_associative.delete(op_name);

    return this;
  }

  removeAllBinaryOps() {
    this.binary_ops.clear();
    this.max_binop_len = 0;

    return this;
  }

  removeLiteral(literal_name: string) {
    this.literals.delete(literal_name);
    return this;
  }

  removeAllLiterals() {
    this.literals.clear();
    return this;
  }
  // ==================== END CONFIG ============================

  /**
   * static top-level parser
   */
  parse(expr: string): Expression | undefined {
    return new TsepParser(this, expr).parse();
  }

  /**
   * Get the longest key length of any object
   */
  getMaxKeyLen(obj: IterableIterator<string>) {
    return Math.max(0, ...[...obj].map((k) => k.length));
  }

  /**
   * `ch` is a character code in the next three functions
   */
  isDecimalDigit(ch: number): boolean {
    return ch >= 48 && ch <= 57; // 0...9
  }

  /**
   * Returns the precedence of a binary operator or `0` if it isn't a binary operator. Can be float.
   */
  binaryPrecedence(op_val: string): number {
    return this.binary_ops.get(op_val) || 0;
  }

  /**
   * Looks for start of identifier
   */
  isIdentifierStart(ch: number): boolean {
    return (
      (ch >= 65 && ch <= 90) || // A...Z
      (ch >= 97 && ch <= 122) || // a...z
      (ch >= 128 && !this.binary_ops.get(String.fromCharCode(ch))) || // any non-ASCII that is not an operator
      this.additional_identifier_chars.has(String.fromCharCode(ch))
    ); // additional characters
  }

  isIdentifierPart(ch: number): boolean {
    return this.isIdentifierStart(ch) || this.isDecimalDigit(ch);
  }
}

export class TsepParser {
  public index = 0;

  get char() {
    return this.expr.charAt(this.index);
  }

  get code() {
    return this.expr.charCodeAt(this.index);
  }

  constructor(private engine: TsepEngine, public expr: string) {}

  /**
   * Run a given hook
   */
  runHook(name: string, node: Expression | undefined): Expression | undefined {
    if (this.engine.hooks.get(name)) {
      const env = { context: this, node };
      this.engine.hooks.run(name, env);
      return env.node || undefined;
    }
    return node || undefined;
  }

  /**
   * Runs a given hook until one returns a node
   */
  searchHook(name: string): Expression | undefined {
    if (this.engine.hooks.get(name)) {
      const env: {
        context: TsepParser;
        node?: Expression;
      } = { context: this };
      this.engine.hooks.get(name).find(function (callback) {
        callback.call(env.context, env);
        return env.node;
      });
      return env.node || undefined;
    }
    return undefined;
  }

  /**
   * Push `index` up to the next non-space character
   */
  gobbleSpaces() {
    let ch = this.code;
    // Whitespace
    while (
      ch === Tsep.SPACE_CODE ||
      ch === Tsep.TAB_CODE ||
      ch === Tsep.LF_CODE ||
      ch === Tsep.CR_CODE
    ) {
      ch = this.expr.charCodeAt(++this.index);
    }
    this.runHook('gobble-spaces', undefined);
  }

  /**
   * Top-level method to parse all expressions and returns compound or single node
   */
  parse() {
    this.runHook('before-all', undefined);
    const nodes = this.gobbleExpressions();

    // If there's only one expression just try returning the expression
    const node =
      nodes.length === 1
        ? nodes[0]
        : {
            type: Tsep.COMPOUND,
            body: nodes,
          };

    return this.runHook('after-all', node);
  }

  /**
   * top-level parser (but can be reused within as well)
   */
  gobbleExpressions(untilICode?: number): Expression[] {
    const nodes: Expression[] = [];
    let ch_i: number;
    let node: Expression | false | undefined;

    while (this.index < this.expr.length) {
      ch_i = this.code;

      // Expressions can be separated by semicolons, commas, or just inferred without any
      // separators
      if (ch_i === Tsep.SEMCOL_CODE || ch_i === Tsep.COMMA_CODE) {
        this.index++; // ignore separators
      } else {
        // Try to gobble each expression individually
        if ((node = this.gobbleExpression())) {
          nodes.push(node);
          // If we weren't able to find a binary expression and are out of room, then
          // the expression passed in probably has too much
        } else if (this.index < this.expr.length) {
          if (ch_i === untilICode) {
            break;
          }
          throw new TsepError('Unexpected "' + this.char + '"', this.index);
        }
      }
    }

    return nodes;
  }

  /**
   * The main parsing function.
   */
  gobbleExpression() {
    const node =
      this.searchHook('gobble-expression') || this.gobbleBinaryExpression();

    this.gobbleSpaces();

    return this.runHook('after-expression', node);
  }

  /**
   * Search for the operation portion of the string (e.g. `+`, `===`)
   * Start by taking the longest possible binary operations (3 characters: `===`, `!==`, `>>>`)
   * and move down from 3 to 2 to 1 character until a matching binary operation is found
   * then, return that binary operation
   */
  gobbleBinaryOp() {
    this.gobbleSpaces();
    let to_check = this.expr.substr(this.index, this.engine.max_binop_len);
    let tc_len = to_check.length;

    while (tc_len > 0) {
      // Don't accept a binary op when it is an identifier.
      // Binary ops that start with a identifier-valid character must be followed
      // by a non identifier-part valid character
      if (
        this.engine.binary_ops.has(to_check) &&
        (!this.engine.isIdentifierStart(this.code) ||
          (this.index + to_check.length < this.expr.length &&
            !this.engine.isIdentifierPart(
              this.expr.charCodeAt(this.index + to_check.length)
            )))
      ) {
        this.index += tc_len;
        return to_check;
      }
      to_check = to_check.substr(0, --tc_len);
    }
    return false;
  }

  /**
   * This function is responsible for gobbling an individual expression,
   * e.g. `1`, `1+2`, `a+(b*2)-Math.sqrt(2)`
   */
  gobbleBinaryExpression(): Expression | undefined {
    let node: BinaryExpression;
    let biop: string | false;
    let prec: number;
    let biop_info: BinaryOpInfo;
    let left: Expression | undefined;
    let right: Expression | undefined;
    let i: number;
    let cur_biop: string;

    // First, try to get the leftmost thing
    // Then, check to see if there's a binary operator operating on that leftmost thing
    // Don't gobbleBinaryOp without a left-hand-side
    left = this.gobbleToken();

    if (!left) {
      return left;
    }

    biop = this.gobbleBinaryOp();

    // If there wasn't a binary operator, just return the leftmost node
    if (!biop) {
      return left;
    }

    // Otherwise, we need to start a stack to properly place the binary operations in their
    // precedence structure
    biop_info = {
      value: biop,
      prec: this.engine.binaryPrecedence(biop),
      right_a: this.engine.right_associative.has(biop),
    };

    right = this.gobbleToken();

    if (!right) {
      throw new TsepError('Expected expression after ' + biop, this.index);
    }

    const stack: (Expression | BinaryOpInfo)[] = [left, biop_info, right];

    // Properly deal with precedence using [recursive descent](http://www.engr.mun.ca/~theo/Misc/exp_parsing.htm)
    while ((biop = this.gobbleBinaryOp())) {
      prec = this.engine.binaryPrecedence(biop);

      if (prec === 0) {
        this.index -= biop.length;
        break;
      }

      biop_info = {
        value: biop,
        prec,
        right_a: this.engine.right_associative.has(biop),
      };

      cur_biop = biop;

      // Reduce: make a binary expression from the three topmost entries.
      const comparePrev = (prev: BinaryOpInfo) =>
        biop_info.right_a && prev.right_a
          ? prec > prev.prec
          : prec <= prev.prec;

      while (
        stack.length > 2 &&
        comparePrev(stack[stack.length - 2] as BinaryOpInfo)
      ) {
        right = stack.pop() as Expression;
        biop = stack.pop()!.value as string;
        left = stack.pop() as Expression;
        node = {
          type: Tsep.BINARY_EXP,
          operator: biop,
          left,
          right,
        };
        stack.push(node);
      }

      const rightNode = this.gobbleToken();

      if (!rightNode) {
        throw new TsepError(
          'Expected expression after ' + cur_biop,
          this.index
        );
      }

      stack.push(biop_info, rightNode);
    }

    i = stack.length - 1;
    node = stack[i] as BinaryExpression;

    while (i > 1) {
      node = {
        type: Tsep.BINARY_EXP,
        operator: stack[i - 1].value as string,
        left: stack[i - 2] as Expression,
        right: node,
      };
      i -= 2;
    }

    return node;
  }

  /**
   * An individual part of a binary expression:
   * e.g. `foo.bar(baz)`, `1`, `"abc"`, `(a % 2)` (because it's in parenthesis)
   */
  gobbleToken(): Expression | undefined {
    let to_check: string;
    let tc_len: number;
    let node: Expression | undefined;

    this.gobbleSpaces();

    node = this.searchHook('gobble-token');

    if (node) {
      return this.runHook('after-token', node);
    }

    const ch = this.code;

    if (this.engine.isDecimalDigit(ch) || ch === Tsep.PERIOD_CODE) {
      // Char code 46 is a dot `.` which can start off a numeric literal
      return this.gobbleNumericLiteral();
    }

    if (ch === Tsep.SQUOTE_CODE || ch === Tsep.DQUOTE_CODE) {
      // Single or double quotes
      node = this.gobbleStringLiteral();
    } else if (ch === Tsep.OBRACK_CODE) {
      node = this.gobbleArray();
    } else {
      to_check = this.expr.substr(this.index, this.engine.max_unop_len);
      tc_len = to_check.length;

      while (tc_len > 0) {
        // Don't accept an unary op when it is an identifier.
        // Unary ops that start with a identifier-valid character must be followed
        // by a non identifier-part valid character
        if (
          this.engine.unary_ops.has(to_check) &&
          (!this.engine.isIdentifierStart(this.code) ||
            (this.index + to_check.length < this.expr.length &&
              !this.engine.isIdentifierPart(
                this.expr.charCodeAt(this.index + to_check.length)
              )))
        ) {
          this.index += tc_len;
          const argument = this.gobbleToken();
          if (!argument) {
            throw new TsepError('missing unaryOp argument', this.index);
          }
          return this.runHook('after-token', {
            type: Tsep.UNARY_EXP,
            operator: to_check,
            argument,
            prefix: true,
          });
        }

        to_check = to_check.substr(0, --tc_len);
      }

      if (this.engine.isIdentifierStart(ch)) {
        node = this.gobbleIdentifier();
        if (
          typeof node['name'] === 'string' &&
          this.engine.literals.has(node['name'])
        ) {
          node = {
            type: Tsep.LITERAL,
            value: this.engine.literals.has(node['name']),
            raw: node['name'],
          };
        } else if (node['name'] === this.engine.this_str) {
          node = { type: Tsep.THIS_EXP };
        }
      } else if (ch === Tsep.OPAREN_CODE) {
        // open parenthesis
        node = this.gobbleGroup() || undefined;
      }
    }

    if (!node) {
      return this.runHook('after-token', undefined);
    }

    node = this.gobbleTokenProperty(node);
    return this.runHook('after-token', node);
  }

  /**
   * Gobble properties of of identifiers/strings/arrays/groups.
   * e.g. `foo`, `bar.baz`, `foo['bar'].baz`
   * It also gobbles function calls:
   * e.g. `Math.acos(obj.angle)`
   */
  gobbleTokenProperty(node: Expression): Expression {
    this.gobbleSpaces();

    let ch = this.code;
    while (
      ch === Tsep.PERIOD_CODE ||
      ch === Tsep.OBRACK_CODE ||
      ch === Tsep.OPAREN_CODE ||
      ch === Tsep.QUMARK_CODE
    ) {
      let optional;
      if (ch === Tsep.QUMARK_CODE) {
        if (this.expr.charCodeAt(this.index + 1) !== Tsep.PERIOD_CODE) {
          break;
        }
        optional = true;
        this.index += 2;
        this.gobbleSpaces();
        ch = this.code;
      }
      this.index++;

      if (ch === Tsep.OBRACK_CODE) {
        node = {
          type: Tsep.MEMBER_EXP,
          computed: true,
          object: node,
          property: this.gobbleExpression(),
        };
        this.gobbleSpaces();
        ch = this.code;
        if (ch !== Tsep.CBRACK_CODE) {
          throw new TsepError('Unclosed [', this.index);
        }
        this.index++;
      } else if (ch === Tsep.OPAREN_CODE) {
        // A function call is being made; gobble all the arguments
        node = {
          type: Tsep.CALL_EXP,
          arguments: this.gobbleArguments(Tsep.CPAREN_CODE),
          callee: node,
        };
      } else if (ch === Tsep.PERIOD_CODE || optional) {
        if (optional) {
          this.index--;
        }
        this.gobbleSpaces();
        node = {
          type: Tsep.MEMBER_EXP,
          computed: false,
          object: node,
          property: this.gobbleIdentifier(),
        };
      }

      if (optional) {
        node['optional'] = true;
      } // else leave undefined for compatibility with esprima

      this.gobbleSpaces();
      ch = this.code;
    }

    return node;
  }

  /**
   * Parse simple numeric literals: `12`, `3.4`, `.5`. Do this by using a string to
   * keep track of everything in the numeric literal and then calling `parseFloat` on that string
   */
  gobbleNumericLiteral(): Literal {
    let number = '',
      ch: string;

    while (this.engine.isDecimalDigit(this.code)) {
      number += this.expr.charAt(this.index++);
    }

    if (this.code === Tsep.PERIOD_CODE) {
      // can start with a decimal marker
      number += this.expr.charAt(this.index++);

      while (this.engine.isDecimalDigit(this.code)) {
        number += this.expr.charAt(this.index++);
      }
    }

    ch = this.char;

    if (ch === 'e' || ch === 'E') {
      // exponent marker
      number += this.expr.charAt(this.index++);
      ch = this.char;

      if (ch === '+' || ch === '-') {
        // exponent sign
        number += this.expr.charAt(this.index++);
      }

      while (this.engine.isDecimalDigit(this.code)) {
        // exponent itself
        number += this.expr.charAt(this.index++);
      }

      if (!this.engine.isDecimalDigit(this.expr.charCodeAt(this.index - 1))) {
        throw new TsepError(
          'Expected exponent (' + number + this.char + ')',
          this.index
        );
      }
    }

    const chCode = this.code;

    // Check to make sure this isn't a variable name that start with a number (123abc)
    if (this.engine.isIdentifierStart(chCode)) {
      throw new TsepError(
        'Variable names cannot start with a number (' +
          number +
          this.char +
          ')',
        this.index
      );
    } else if (
      chCode === Tsep.PERIOD_CODE ||
      (number.length === 1 && number.charCodeAt(0) === Tsep.PERIOD_CODE)
    ) {
      throw new TsepError('Unexpected period', this.index);
    }

    return {
      type: Tsep.LITERAL,
      value: parseFloat(number),
      raw: number,
    };
  }

  /**
   * Parses a string literal, staring with single or double quotes with basic support for escape codes
   * e.g. `"hello world"`, `'this is\nTSEP'`
   */
  gobbleStringLiteral(): Literal {
    let str = '';
    const startIndex = this.index;
    const quote = this.expr.charAt(this.index++);
    let closed = false;

    while (this.index < this.expr.length) {
      let ch = this.expr.charAt(this.index++);

      if (ch === quote) {
        closed = true;
        break;
      } else if (ch === '\\') {
        // Check for all of the common escape codes
        ch = this.expr.charAt(this.index++);

        switch (ch) {
          case 'n':
            str += '\n';
            break;
          case 'r':
            str += '\r';
            break;
          case 't':
            str += '\t';
            break;
          case 'b':
            str += '\b';
            break;
          case 'f':
            str += '\f';
            break;
          case 'v':
            str += '\x0B';
            break;
          default:
            str += ch;
        }
      } else {
        str += ch;
      }
    }

    if (!closed) {
      throw new TsepError('Unclosed quote after "' + str + '"', this.index);
    }

    return {
      type: Tsep.LITERAL,
      value: str,
      raw: this.expr.substring(startIndex, this.index),
    };
  }

  /**
   * Gobbles only identifiers
   * e.g.: `foo`, `_value`, `$x1`
   * Also, this function checks if that identifier is a literal:
   * (e.g. `true`, `false`, `null`) or `this`
   */
  gobbleIdentifier(): Identifier {
    let ch = this.code;
    const start = this.index;

    if (this.engine.isIdentifierStart(ch)) {
      this.index++;
    } else {
      throw new TsepError('Unexpected ' + this.char, this.index);
    }

    while (this.index < this.expr.length) {
      ch = this.code;

      if (this.engine.isIdentifierPart(ch)) {
        this.index++;
      } else {
        break;
      }
    }
    return {
      type: Tsep.IDENTIFIER,
      name: this.expr.slice(start, this.index),
    };
  }

  /**
   * Gobbles a list of arguments within the context of a function call
   * or array literal. This function also assumes that the opening character
   * `(` or `[` has already been gobbled, and gobbles expressions and commas
   * until the terminator character `)` or `]` is encountered.
   * e.g. `foo(bar, baz)`, `my_func()`, or `[bar, baz]`
   */
  gobbleArguments(termination: number): (Expression | undefined)[] {
    const args: (Expression | undefined)[] = [];
    let closed = false;
    let separator_count = 0;

    while (this.index < this.expr.length) {
      this.gobbleSpaces();
      const ch_i = this.code;

      if (ch_i === termination) {
        // done parsing
        closed = true;
        this.index++;

        if (
          termination === Tsep.CPAREN_CODE &&
          separator_count &&
          separator_count >= args.length
        ) {
          throw new TsepError(
            'Unexpected token ' + String.fromCharCode(termination),
            this.index
          );
        }

        break;
      } else if (ch_i === Tsep.COMMA_CODE) {
        // between expressions
        this.index++;
        separator_count++;

        if (separator_count !== args.length) {
          // missing argument
          if (termination === Tsep.CPAREN_CODE) {
            throw new TsepError('Unexpected token ,', this.index);
          } else if (termination === Tsep.CBRACK_CODE) {
            for (let arg = args.length; arg < separator_count; arg++) {
              args.push(undefined);
            }
          }
        }
      } else if (args.length !== separator_count && separator_count !== 0) {
        // NOTE: `&& separator_count !== 0` allows for either all commas, or all spaces as arguments
        throw new TsepError('Expected comma', this.index);
      } else {
        const node = this.gobbleExpression();

        if (!node || node.type === Tsep.COMPOUND) {
          throw new TsepError('Expected comma', this.index);
        }

        args.push(node);
      }
    }

    if (!closed) {
      throw new TsepError(
        'Expected ' + String.fromCharCode(termination),
        this.index
      );
    }

    return args;
  }

  /**
   * Responsible for parsing a group of things within parentheses `()`
   * that have no identifier in front (so not a function call)
   * This function assumes that it needs to gobble the opening parenthesis
   * and then tries to gobble everything within that parenthesis, assuming
   * that the next thing it should see is the close parenthesis. If not,
   * then the expression probably doesn't have a `)`
   */
  gobbleGroup(): Expression | false {
    this.index++;
    const nodes = this.gobbleExpressions(Tsep.CPAREN_CODE);
    if (this.code === Tsep.CPAREN_CODE) {
      this.index++;
      if (nodes.length === 1) {
        return nodes[0];
      } else if (!nodes.length) {
        return false;
      } else {
        return {
          type: Tsep.SEQUENCE_EXP,
          expressions: nodes,
        };
      }
    } else {
      throw new TsepError('Unclosed (', this.index);
    }
  }

  /**
   * Responsible for parsing Array literals `[1, 2, 3]`
   * This function assumes that it needs to gobble the opening bracket
   * and then tries to gobble the expressions as arguments.
   */
  gobbleArray(): ArrayExpression {
    this.index++;

    return {
      type: Tsep.ARRAY_EXP,
      elements: this.gobbleArguments(Tsep.CBRACK_CODE),
    };
  }
}

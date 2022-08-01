export type Primitive = string | number | boolean | RegExp | null | undefined;

export interface Expression {
  type: string;
  [key: string]: Primitive | Expression | Array<Primitive | Expression>;
}

export interface ArrayExpression extends Expression {
  type: 'ArrayExpression';
  elements: (Expression | undefined)[];
}

export interface BinaryExpression extends Expression {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface CallExpression extends Expression {
  type: 'CallExpression';
  arguments: Expression[];
  callee: Expression;
}

export interface Compound extends Expression {
  type: 'Compound';
  body: Expression[];
}

export interface ConditionalExpression extends Expression {
  type: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface Identifier extends Expression {
  type: 'Identifier';
  name: string;
}

export interface Literal extends Expression {
  type: 'Literal';
  value: boolean | number | string | RegExp | null;
  raw: string;
}

export interface MemberExpression extends Expression {
  type: 'MemberExpression';
  computed: boolean;
  object: Expression;
  property: Expression;
  optional?: boolean;
}

export interface ThisExpression extends Expression {
  type: 'ThisExpression';
}

export interface UnaryExpression extends Expression {
  type: 'UnaryExpression';
  operator: string;
  argument: Expression;
  prefix: boolean;
}

export type ExpressionType =
  | 'Compound'
  | 'Identifier'
  | 'MemberExpression'
  | 'Literal'
  | 'ThisExpression'
  | 'CallExpression'
  | 'UnaryExpression'
  | 'BinaryExpression'
  | 'ConditionalExpression'
  | 'ArrayExpression';

export type CoreExpression =
  | ArrayExpression
  | BinaryExpression
  | CallExpression
  | Compound
  | ConditionalExpression
  | Identifier
  | Literal
  | MemberExpression
  | ThisExpression
  | UnaryExpression;

export type BinaryOpInfo = { value: string; prec: number; right_a: boolean };

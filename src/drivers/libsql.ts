import {
  SyntaxKind,
  NodeFlags,
  Node,
  TypeNode,
  factory,
  FunctionDeclaration,
} from "typescript";

import { Parameter, Column, Query } from "../gen/plugin/codegen_pb";
import { argName } from "./utlis";

function funcParamsDecl(iface: string | undefined, params: Parameter[]) {
  let funcParams = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier("database"),
      undefined,
      factory.createTypeReferenceNode(
        factory.createIdentifier("Client"),
        undefined
      ),
      undefined
    ),
  ];

  if (iface && params.length > 0) {
    funcParams.push(
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier("args"),
        undefined,
        factory.createTypeReferenceNode(
          factory.createIdentifier(iface),
          undefined
        ),
        undefined
      )
    );
  }

  return funcParams;
}

export class Driver {
  /**
   * {@link https://github.com/WiseLibs/better-sqlite3/blob/v9.4.1/docs/api.md#binding-parameters}
   * {@link https://github.com/sqlc-dev/sqlc/blob/v1.25.0/internal/codegen/golang/sqlite_type.go}
   */
  columnType(column?: Column): TypeNode {
    if (column === undefined || column.type === undefined) {
      return factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    }

    let typ: TypeNode = factory.createKeywordTypeNode(SyntaxKind.AnyKeyword);
    console.log(column.type.name);
    switch (column.type.name.toLowerCase()) {
      case "int":
      case "integer":
      case "tinyint":
      case "smallint":
      case "mediumint":
      case "bigint":
      case "unsignedbigint":
      case "int2":
      case "int8": {
        // TODO: Improve `BigInt` handling (https://github.com/WiseLibs/better-sqlite3/blob/v9.4.1/docs/integer.md)
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "blob": {
        // TODO: Is this correct or node-specific?
        typ = factory.createTypeReferenceNode(
          factory.createIdentifier("Buffer"),
          undefined
        );
        break;
      }
      case "real":
      case "double":
      case "doubleprecision":
      case "float": {
        typ = factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
        break;
      }
      case "boolean":
      case "bool": {
        typ = factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
        break;
      }
      case "date":
      case "datetime":
      case "timestamp": {
        typ = factory.createTypeReferenceNode(
          factory.createIdentifier("Date"),
          undefined
        );
        break;
      }
      case "text":
      case "varchar":
      case "character":
      case "char":
        typ = factory.createKeywordTypeNode(SyntaxKind.StringKeyword);
        break;
    }

    if (column.notNull) {
      return typ;
    }

    return factory.createUnionTypeNode([
      typ,
      factory.createLiteralTypeNode(factory.createNull()),
    ]);
  }

  preamble(queries: Query[]) {
    const imports: Node[] = [
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              true,
              undefined,
              factory.createIdentifier("Client")
            ),
          ])
        ),
        factory.createStringLiteral("@libsql/client"),
        undefined
      ),
    ];

    return imports;
  }

  toListOfArgs(params: Parameter[]) {
    return params.map((param, i) =>
      factory.createPropertyAccessExpression(
        factory.createIdentifier("args"),
        factory.createIdentifier(argName(i, param.column))
      )
    );
  }

  execDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    params: Parameter[]
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    return factory.createFunctionDeclaration(
      [
        factory.createToken(SyntaxKind.ExportKeyword),
        factory.createToken(SyntaxKind.AsyncKeyword),
      ],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createKeywordTypeNode(SyntaxKind.NumberKeyword),
      ]),
      factory.createBlock(
        [
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier("ret"),
                  undefined,
                  undefined,
                  factory.createAwaitExpression(
                    factory.createCallExpression(
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier("database"),
                        factory.createIdentifier("execute")
                      ),
                      undefined,
                      [
                        factory.createObjectLiteralExpression(
                          [
                            factory.createPropertyAssignment(
                              factory.createIdentifier("sql"),
                              factory.createIdentifier(queryName)
                            ),
                            factory.createPropertyAssignment(
                              factory.createIdentifier("args"),
                              factory.createArrayLiteralExpression(
                                this.toListOfArgs(params),
                                false
                              )
                            ),
                          ],
                          true
                        ),
                      ]
                    )
                  )
                ),
              ],
              NodeFlags.Const |
                // ts.NodeFlags.Constant |
                // NodeFlags.AwaitContext |
                // ts.NodeFlags.Constant |
                // NodeFlags.ContextFlags |
                NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createReturnStatement(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("ret"),
              factory.createIdentifier("rowsAffected")
            )
          ),
        ],
        true
      )
    );
  }

  oneDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[]
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    const retVariable = factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier("ret"),
            undefined,
            undefined,
            factory.createAwaitExpression(
              factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("database"),
                  factory.createIdentifier("execute")
                ),
                undefined,
                [
                  factory.createObjectLiteralExpression(
                    [
                      factory.createPropertyAssignment(
                        factory.createIdentifier("sql"),
                        factory.createIdentifier(queryName)
                      ),
                      factory.createPropertyAssignment(
                        factory.createIdentifier("args"),
                        factory.createArrayLiteralExpression(
                          this.toListOfArgs(params),
                          false
                        )
                      ),
                    ],
                    true
                  ),
                ]
              )
            )
          ),
        ],
        NodeFlags.Const
      )
    );

    const ifNoRows = factory.createIfStatement(
      factory.createBinaryExpression(
        factory.createPropertyAccessExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("ret"),
            factory.createIdentifier("rows")
          ),
          factory.createIdentifier("length")
        ),
        factory.createToken(SyntaxKind.EqualsEqualsEqualsToken),
        factory.createNumericLiteral("0")
      ),
      factory.createBlock(
        [factory.createReturnStatement(factory.createNull())],
        true
      ),
      undefined
    );

    const ifMoreThanOneRow = factory.createIfStatement(
      factory.createBinaryExpression(
        factory.createPropertyAccessExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("ret"),
            factory.createIdentifier("rows")
          ),
          factory.createIdentifier("length")
        ),
        factory.createToken(SyntaxKind.GreaterThanToken),
        factory.createNumericLiteral("1")
      ),
      factory.createBlock(
        [
          factory.createThrowStatement(
            factory.createNewExpression(
              factory.createIdentifier("Error"),
              undefined,
              [
                factory.createBinaryExpression(
                  factory.createStringLiteral(
                    "violated single-row constraint in query [" +
                      queryName +
                      "], expected 1 got "
                  ),
                  factory.createToken(SyntaxKind.PlusToken),
                  factory.createPropertyAccessExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier("ret"),
                      factory.createIdentifier("rows")
                    ),
                    factory.createIdentifier("length")
                  )
                ),
              ]
            )
          ),
        ],
        true
      )
    );

    const resultVariable = factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier("result"),
            undefined,
            undefined,
            factory.createElementAccessExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("ret"),
                factory.createIdentifier("rows")
              ),
              factory.createNumericLiteral("0")
            )
          ),
        ],
        NodeFlags.Const
      )
    );

    const returnStatement = factory.createReturnStatement(
      factory.createAsExpression(
        factory.createAsExpression(
          factory.createIdentifier("result"),
          factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword)
        ),
        factory.createTypeReferenceNode(
          factory.createIdentifier(returnIface),
          undefined
        )
      )
    );

    const block = factory.createBlock(
      [
        retVariable,
        ifNoRows,
        ifMoreThanOneRow,
        resultVariable,
        returnStatement,
      ],
      true
    );

    return factory.createFunctionDeclaration(
      [
        factory.createToken(SyntaxKind.ExportKeyword),
        factory.createToken(SyntaxKind.AsyncKeyword),
      ],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createUnionTypeNode([
          factory.createTypeReferenceNode(
            factory.createIdentifier(returnIface),
            undefined
          ),
          factory.createLiteralTypeNode(factory.createNull()),
        ]),
      ]),
      block
    );
  }

  manyDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    returnIface: string,
    params: Parameter[],
    columns: Column[]
  ) {
    const funcParams = funcParamsDecl(argIface, params);

    return factory.createFunctionDeclaration(
      [
        factory.createToken(SyntaxKind.ExportKeyword),
        factory.createToken(SyntaxKind.AsyncKeyword),
      ],
      undefined,
      factory.createIdentifier(funcName),
      undefined,
      funcParams,
      factory.createTypeReferenceNode(factory.createIdentifier("Promise"), [
        factory.createArrayTypeNode(
          factory.createTypeReferenceNode(
            factory.createIdentifier(returnIface),
            undefined
          )
        ),
      ]),
      factory.createBlock(
        [
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier("result"),
                  undefined,
                  undefined,
                  factory.createAwaitExpression(
                    factory.createCallExpression(
                      factory.createPropertyAccessExpression(
                        factory.createIdentifier("database"),
                        factory.createIdentifier("execute")
                      ),
                      undefined,
                      [
                        factory.createObjectLiteralExpression(
                          [
                            factory.createPropertyAssignment(
                              factory.createIdentifier("sql"),
                              factory.createIdentifier(queryName)
                            ),
                            factory.createPropertyAssignment(
                              factory.createIdentifier("args"),
                              factory.createArrayLiteralExpression(
                                this.toListOfArgs(params),
                                false
                              )
                            ),
                          ],
                          true
                        ),
                      ]
                    )
                  )
                ),
              ],
              NodeFlags.Const |
                // ts.NodeFlags.Constant |
                // NodeFlags.AwaitContext |
                // ts.NodeFlags.Constant |
                // NodeFlags.ContextFlags |
                NodeFlags.TypeExcludesFlags
            )
          ),
          factory.createReturnStatement(
            factory.createAsExpression(
              factory.createAsExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("result"),
                  factory.createIdentifier("rows")
                ),
                factory.createKeywordTypeNode(SyntaxKind.UnknownKeyword)
              ),
              factory.createArrayTypeNode(
                factory.createTypeReferenceNode(
                  factory.createIdentifier(returnIface),
                  undefined
                )
              )
            )
          ),
        ],
        true
      )
    );
  }

  execlastidDecl(
    funcName: string,
    queryName: string,
    argIface: string | undefined,
    params: Parameter[]
  ): FunctionDeclaration {
    throw new Error(
      "better-sqlite3 driver currently does not support :execlastid"
    );
  }
}

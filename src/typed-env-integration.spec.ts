import { EnvBoolean, EnvEnum, EnvFloat, EnvInteger, Environment, EnvNested, EnvString, loadEnvConfig } from './index';
import { resetMetadataStorage } from './metadata-storage';
import { EnvRawObject, Inter, Type } from './types';
import {
  EnvPropConfigError,
  EnvPropDecorationError,
  EnvVarNameDuplicateError,
  NoEnvVarError,
  TypeCastingError,
} from './errors';

describe('Typed Env: Integration test', () => {

  beforeEach(() => {
    resetMetadataStorage();
  });

  it('Should retrieve all simple types from the ENV object', () => {
    // arrange
    enum ETest {
      One = 'one',
      Two = 'two',
    }
    const symbolKey = Symbol('Env Symbol');
    const symbolWithDefaultKey = Symbol('Env Symbol With Default');
    const symbolOptionalKey = Symbol('Env Symbol Optional');

    class Config {
      @EnvInteger()
      public readonly int!: number;

      @EnvInteger()
      public readonly intWithDefault: number = 123;

      @EnvInteger({ optional: true })
      public readonly intOptional?: number;

      @EnvFloat()
      public readonly float!: number;

      @EnvFloat()
      public readonly floatWithDefault: number = 123.45;

      @EnvFloat({ optional: true })
      public readonly floatOptional?: number;

      @EnvString()
      public readonly str!: string;

      @EnvString()
      public readonly strWithDefault: string = 'hello';

      @EnvString({ optional: true })
      public readonly strOptional?: string;

      @EnvBoolean()
      public readonly bool!: boolean;

      @EnvBoolean()
      public readonly boolWithDefault: boolean = true;

      @EnvBoolean({ optional: true })
      public readonly boolOptional?: boolean;

      @EnvEnum({ enum: ETest })
      public readonly enum!: ETest;

      @EnvEnum({ enum: ETest })
      public readonly enumWithDefault: ETest = ETest.One;

      @EnvEnum({ enum: ETest, optional: true })
      public readonly enumOptional?: ETest;

      @EnvInteger({ name: 'SYMBOL' })
      public readonly [symbolKey]!: number;

      @EnvInteger({ name: 'SYMBOL_WITH_DEFAULT' })
      public readonly [symbolWithDefaultKey]: number = 234;

      // TODO: This case doesn't work. It looks like there is a problem with Jest
      //       https://github.com/facebook/jest/issues/8475
      // @EnvInteger({ name: 'SYMBOL_OPTIONAL', optional: true })
      public readonly [symbolOptionalKey]?: number;

      public readonly justValue: string = 'Z-Brain';
    }
    const raw: EnvRawObject = {
      INT: '111',
      FLOAT: '111.222',
      STR: 'welcome',
      BOOL: '0',
      ENUM: 'two',
      SYMBOL: '345',
    };
    const expected: Inter<Config> = {
      int: 111,
      intWithDefault: 123,
      intOptional: undefined,
      float: 111.222,
      floatWithDefault: 123.45,
      floatOptional: undefined,
      str: 'welcome',
      strWithDefault: 'hello',
      strOptional: undefined,
      bool: false,
      boolWithDefault: true,
      boolOptional: undefined,
      enum: ETest.Two,
      enumWithDefault: ETest.One,
      enumOptional: undefined,
      [symbolKey]: 345,
      [symbolWithDefaultKey]: 234,
      // [symbolOptionalKey]: undefined,
      justValue: 'Z-Brain',
    };

    // act
    const config = loadEnvConfig(Config, raw);

    // assert
    expect(config).toEqual(expected);
  }); // END Should retrieve all simple types from the ENV object

  describe('Instantiating', () => {
    it('Should the same object reference in case we are passing an instance instead of a constructor', () => {
      // arrange
      class Config {
        @EnvString()
        public readonly name!: string;
      }
      const config = new Config();
      const raw: EnvRawObject = { NAME: 'hello' };
      const expected: Config = { name: 'hello' };

      // act
      const res = loadEnvConfig(config, raw);

      // assert
      expect(res).toBe(config);
      expect(res).toEqual(expected);
    });

    describe(`@${ Environment.name }() decorator`, () => {
      it(`Should be filled during instantiating without ${ loadEnvConfig.name }() call`, () => {
        // arrange
        const raw: EnvRawObject = { NAME: 'hello' };
        @Environment(() => raw)
        class Config {
          @EnvString()
          public readonly name!: string;
        }
        const expected: Config = { name: 'hello' };

        // act
        const config = new Config();

        // assert
        expect(config).toEqual(expected);
      });

      it('Should use process.env in case rawFactory argument skipped', () => {
        @Environment()
        class Config {
          @EnvString()
          public readonly name!: string;
        }
        const expected: Config = { name: 'hello' };
        process.env.NAME = 'hello';

        // act
        const config = new Config();

        // assert
        expect(config).toEqual(expected);

        // clean up
        const { NAME: deleted, ...env } = process.env; // eslint-disable-line @typescript-eslint/no-unused-vars
        process.env = env;
      });

      it('Should name the class using the original config class name prefixed by double dollar', () => {
        // arrange
        @Environment()
        class Config {
          @EnvString()
          public readonly name: string = '';
        }

        // act
        const config = new Config();

        // assert
        expect(Config.name).toBe('$$Config');
        expect(config.constructor.name).toBe('$$Config');

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(Object.getPrototypeOf(Config.prototype).constructor.name).toBe('Config');
      });

      it('Should pass the wrapped constructor arguments to the original constructor during instantiating', () => {
        // arrange
        const raw: EnvRawObject = { NAME: 'hello' };
        @Environment(() => raw)
        class Config {
          @EnvString()
          public readonly name!: string;

          public readonly fromCtor: string;

          public constructor(
              public readonly arg: string,
          ) {
            this.fromCtor = `${ arg } 2`;
          }

        }
        const expected: Config = {
          name: 'hello',
          arg: 'welcome',
          fromCtor: 'welcome 2',
        };

        // act
        const config = new Config('welcome');

        // assert
        expect(config).toEqual(expected);
      });
    }); // END `@${ Environment.name }() decorator`
  }); // END Instantiating

  describe('Handling array in values', () => {
    it('Should handle arrays of all simple types', () => {
      // arrange
      class Config {

        @EnvInteger()
        public readonly array!: number[];

        // reflect-metadata was unable to reflect Array<...> as an array in the old TS versions
        @EnvInteger()
        public readonly arrayCtor!: Array<number>;

        @EnvInteger()
        public readonly arrayWithDefault: number[] = [1, 2, 3];

        @EnvInteger({ optional: true })
        public readonly arrayOptional!: number[];

        @EnvFloat()
        public readonly floatArray!: number[];

        @EnvString()
        public readonly strArray!: string[];

        @EnvBoolean()
        public readonly boolArray!: boolean[];
      }
      const raw: EnvRawObject = {
        ARRAY: '11,22,33',
        ARRAY_CTOR: '1,2,3',
        FLOAT_ARRAY: '11.22,33.44,55.66',
        STR_ARRAY: 'me,you,we',
        BOOL_ARRAY: 'true,0,false,1',
      };
      const expected: Inter<Config> = {
        array: [11, 22, 33],
        arrayCtor: [1, 2, 3],
        arrayWithDefault: [1, 2, 3],
        arrayOptional: [],
        floatArray: [11.22, 33.44, 55.66],
        strArray: ['me', 'you', 'we'],
        boolArray: [true, false, false, true],
      };

      // act
      const config = loadEnvConfig(Config, raw);

      // assert
      expect(config).toEqual(expected);
    }); // END Should handle arrays of all simple types

    it('Should not split by escaped commas during paring arrays', () => {
      // arrange
      class Config {
        @EnvString()
        public readonly names!: string[];
      }
      const raw: EnvRawObject = {
        NAMES: 'Ivan\\,First,Petro\\,Second',
      };
      const expected: Config = {
        names: ['Ivan,First', 'Petro,Second'],
      };

      // act
      const config = loadEnvConfig(Config, raw);

      // assert
      expect(config).toEqual(expected);
    });

    it('Should handle escaped backslash before commas during paring arrays', () => {
      // arrange
      class Config {
        @EnvString()
        public readonly names!: string[];
      }
      const raw: EnvRawObject = {
        NAMES: 'Ivan\\\\,First,Petro\\,Second',
      };
      const expected: Config = {
        names: ['Ivan\\', 'First', 'Petro,Second'],
      };

      // act
      const config = loadEnvConfig(Config, raw);

      // assert
      expect(config).toEqual(expected);
    });
  }); // END Handling array in values

  it('Should use an array of specified ENV variable names to find existing one', () => {
    // arrange
    class Config {
      @EnvString({ name: ['TEST1', 'TEST2', 'TEST3'] })
      public readonly test!: string;

      // Loader should iterate the array of names in the order from the first to the last
      @EnvInteger({ name: ['FIRST3', 'FIRST2', 'FIRST1'] })
      public readonly first!: number;
    }
    const raw: EnvRawObject = {
      TEST2: 'hello',
      FIRST1: '111',
      FIRST2: '222',
      FIRST3: '333',
    };
    const expected: Inter<Config> = {
      test: 'hello',
      first: 333,
    };

    // act
    const config = loadEnvConfig(Config, raw);

    // assert
    expect(config).toEqual(expected);
  }); // END Should use an array of specified ENV variable names to find existing one

  describe('.allowEmpty flag', () => {
    const rawEmptyStr: EnvRawObject = { NAME: '' };
    const rawSpaceOnlyStr: EnvRawObject = { NAME: '   ' };

    it('Should not allow empty values by default', () => {
      // arrange
      class Config {
        @EnvString()
        public readonly name!: string;
      }

      // act
      const onEmptyCb = () => loadEnvConfig(Config, rawEmptyStr);
      const onSpaceOnlyCb = () => loadEnvConfig(Config, rawSpaceOnlyStr);

      // assert
      expect(onEmptyCb).toThrowError('"NAME" is required');
      expect(onSpaceOnlyCb).toThrowError('"NAME" is required');
    });

    it('Should not allow empty values in case .allowEmpty is true', () => {
      // arrange
      class Config {
        @EnvString({ allowEmpty: true })
        public readonly name!: string;
      }

      // act
      const resOnEmpty = loadEnvConfig(Config, rawEmptyStr);
      const resOnSpaces = loadEnvConfig(Config, rawSpaceOnlyStr);

      // assert
      expect(resOnEmpty).toEqual({ name: '' });
      expect(resOnSpaces).toEqual({ name: '   ' });
    });
  }); // END .allowEmpty flag

  describe('Nested Configs', () => {
    it('Should retrieve DTO metadata on the all inheritance level', () => {
      // arrange
      class Base {
        @EnvString()
        public readonly name!: string;
      }
      class Child extends Base {
        @EnvString()
        public readonly email!: string;
      }
      class Main extends Child {
        @EnvInteger()
        public readonly age!: number;
      }
      const raw: EnvRawObject = {
        NAME: 'welcome',
        EMAIL: 'welcome@mail.com',
        AGE: '25',
      };
      const expected: Main = {
        name: 'welcome',
        email: 'welcome@mail.com',
        age: 25,
      };

      // act
      const config = loadEnvConfig(Main, raw);

      // assert
      expect(config).toEqual(expected);
    });
    it('Should throw a RangeError on to long inheritance chain', () => {
      // arrange
      let ctor = class My {};
      const ACTUAL_LIMIT = 15;
      const LEVEL = 20;

      // making 20-level inheritance (limit is 15)
      for (let i = 1; i <= LEVEL; i++) {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval,no-new-func
        ctor = new Function('Prev', `return class Next${ i } extends Prev {}`)(ctor) as Type<any>;
      }

      // act
      const cb = () => {
        loadEnvConfig(ctor, {});
      };

      // assert
      const exp = expect(cb);
      exp.toThrowError(RangeError);
      exp.toThrowError(String(ACTUAL_LIMIT));
      exp.toThrowError('ENV_CONFIG_MAX_INHERITANCE_LIMIT');
      exp.toThrowError(`Next${ LEVEL - ACTUAL_LIMIT }`);
    });

    it('Should handle simple nested config', () => {
      // arrange
      class NestedConfig {
        @EnvInteger()
        public readonly name!: number;
      }
      class Config {
        @EnvString()
        public readonly name!: string;

        @EnvNested()
        public readonly deep!: NestedConfig;
      }
      const raw: EnvRawObject = {
        NAME: 'car',
        DEEP_NAME: '111',
      };
      const expected: Inter<Config> = {
        name: 'car',
        deep: {
          name: 111,
        },
      };

      // act
      const config = loadEnvConfig(Config, raw);

      // assert
      expect(config).toEqual(expected);
    });

    it('Should handle custom prefix for nested config', () => {
      // arrange
      class NestedConfig {
        @EnvInteger()
        public readonly name!: number;
      }
      class Config {
        @EnvString()
        public readonly name!: string;

        @EnvNested({ prefix: 'MY' })
        public readonly deep!: NestedConfig;
      }
      const raw: EnvRawObject = {
        NAME: 'car',
        MY_NAME: '111',
      };
      const expected: Inter<Config> = {
        name: 'car',
        deep: {
          name: 111,
        },
      };

      // act
      const config = loadEnvConfig(Config, raw);

      // assert
      expect(config).toEqual(expected);
    });

    it('Should not add a name prefix in case the .prefix param assigned with `false`', () => {
      // arrange
      class NestedConfig {
        @EnvInteger()
        public readonly age!: number;
      }
      class Config {
        @EnvString()
        public readonly name!: string;

        @EnvNested({ prefix: false })
        public readonly deep!: NestedConfig;
      }
      const raw: EnvRawObject = {
        NAME: 'car',
        AGE: '111',
      };
      const expected: Inter<Config> = {
        name: 'car',
        deep: {
          age: 111,
        },
      };

      // act
      const config = loadEnvConfig(Config, raw);

      // assert
      expect(config).toEqual(expected);
    });

    it('Should handle multiple nesting and concatenate prefixes', () => {
      // arrange
      class Nested2Config {
        @EnvString({ allowConflictingVarName: true })
        public readonly name!: string;
      }
      class NestedConfig {
        @EnvFloat({ allowConflictingVarName: true })
        public readonly name!: number;

        @EnvNested()
        public readonly nested!: Nested2Config;

        @EnvNested({ prefix: false })
        public readonly noPrefix!: Nested2Config;
      }
      class Config {
        @EnvInteger()
        public readonly name!: number;

        @EnvNested()
        public readonly deep!: NestedConfig;
      }
      const raw: EnvRawObject = {
        NAME: '111',
        DEEP_NAME: '11.22',
        DEEP_NESTED_NAME: 'car',
      };
      const expected: Inter<Config> = {
        name: 111,
        deep: {
          name: 11.22,
          nested: { name: 'car' },
          noPrefix: { name: '11.22' },
        },
      };

      // act
      const config = loadEnvConfig(Config, raw);

      // assert
      expect(config).toEqual(expected);
    });
  }); // END Nested Configs

  describe('Mixed types/Multi-type/Multi-decorator properties', () => {
    describe('GIVEN: 3 decorators added: EnvInteger/EnvBoolean/EnvString', () => {
      it('Should choose the right type by the input data', () => {
        // arrange
        class Config {
          @EnvString()
          @EnvBoolean()
          @EnvInteger()
          public mixed!: number | boolean | string;
        }

        const rawInteger: EnvRawObject = { MIXED: '1234' };
        const rawBoolean: EnvRawObject = { MIXED: 'yes' };
        const rawString: EnvRawObject = { MIXED: 'hello' };

        // act
        const resInteger = loadEnvConfig(Config, rawInteger);
        const resBoolean = loadEnvConfig(Config, rawBoolean);
        const resString  = loadEnvConfig(Config, rawString);

        // assert
        expect(resInteger.mixed).toBe(1234);
        expect(resBoolean.mixed).toBe(true);
        expect(resString.mixed).toBe('hello');
      });
    });

    describe('GIVEN: 2 decorators added: EnvInteger/EnvBoolean', () => {
      it('Should throw an error in case passed string is not an integer & not a boolean-like', () => {
        // arrange
        class Config {
          @EnvBoolean()
          @EnvInteger()
          public mixed!: number | boolean | string;
        }

        const rawString: EnvRawObject = { MIXED: 'hello' };

        // act
        const cb  = () => loadEnvConfig(Config, rawString);

        // assert
        const exp = expect(cb);
        exp.toThrowError('No acceptable value for multi-type field');
        exp.toThrowError('For INTEGER');
        exp.toThrowError('For BOOLEAN');
      });
    });

    describe('GIVEN: 2 decorators added: EnvInteger/EnvNested', () => {
      it('Should throw an error in case passed string is not an integer & not the nested config', () => {
        // arrange
        class NestedConfig {
          @EnvString()
          public name!: string;
        }
        class Config {
          @EnvInteger()
          @EnvNested({ config: NestedConfig })
          public mixed!: number | NestedConfig;
        }

        const rawString: EnvRawObject = { MIXED: 'hello' };

        // act
        const cb  = () => loadEnvConfig(Config, rawString);

        // assert
        const exp = expect(cb);
        exp.toThrowError('No acceptable value for multi-type field');
        exp.toThrowError('For INTEGER');
        exp.toThrowError('For NESTED');
      });

      it('Should make an integer value from integer-like value', () => {
        // arrange
        class NestedConfig {
          @EnvString()
          public name!: string;
        }
        class Config {
          @EnvInteger()
          @EnvNested({ config: NestedConfig })
          public mixed!: number | NestedConfig;
        }

        const rawString: EnvRawObject = { MIXED: '1234' };

        // act
        const res = loadEnvConfig(Config, rawString);

        // assert
        expect(res.mixed).toBe(1234);
      });

      it('Should make a nested-object in case an integer-like ENV variable is absent, a var for nested config exists', () => {
        // arrange
        class NestedConfig {
          @EnvString()
          public name!: string;
        }
        class Config {
          @EnvInteger()
          @EnvNested({ config: NestedConfig })
          public mixed!: number | NestedConfig;
        }

        const rawString: EnvRawObject = { MIXED_NAME: 'hello' };

        // act
        const res = loadEnvConfig(Config, rawString);

        // assert
        expect((res.mixed as NestedConfig).name).toBe('hello');
      });
    });

    describe('Receiving .isArray param to handle arrays in mixed types', () => {
      it('Should handle isArray flag for arrays of simple types', () => {
        // arrange
        class Config {
          @EnvFloat()
          @EnvInteger({ isArray: true })
          @EnvBoolean({ isArray: true })
          public mixed!: boolean[] | number[] | number;
        }
        const rawInt: EnvRawObject = { MIXED: '123,234' };
        const rawBool: EnvRawObject = { MIXED: 'true,false,true' };
        const rawFloat: EnvRawObject = { MIXED: '123.2' };

        // act
        const resInt = loadEnvConfig(Config, rawInt);
        const resBool = loadEnvConfig(Config, rawBool);
        const resFloat = loadEnvConfig(Config, rawFloat);

        // assert
        expect(resInt.mixed).toEqual([123, 234]);
        expect(resBool.mixed).toEqual([true, false, true]);
        expect(resFloat.mixed).toBe(123.2);
      });

      it('Should handle isArray flag for a mix with simple & nested types', () => {
        // arrange
        class NestedConfig {
          @EnvString()
          public name!: string;
        }
        class Config {
          @EnvNested({ config: NestedConfig })
          @EnvBoolean({ isArray: true })
          public mixed!: boolean[] | NestedConfig;
        }
        const rawNested: EnvRawObject = { MIXED_NAME: 'hello' };
        const rawBool: EnvRawObject = { MIXED: 'true,false,true' };

        // act
        const resBool = loadEnvConfig(Config, rawBool);
        const resNested = loadEnvConfig(Config, rawNested);

        // assert
        expect(resBool.mixed).toEqual([true, false, true]);
        expect(resNested.mixed).toEqual({ name: 'hello' });
      });
    });

    describe(`GIVEN: A property with triple-mix type: boolean, string enum & array of string enum values
      THEN: Should cast all of them`, () => {
      // arrange
      /** This is a complex type from TypeORM, it is copy-pasted just to make the test more realistic */
      type LoggerOptions = boolean | 'all' | ('query' | 'schema' | 'error' | 'warn' | 'info' | 'log' | 'migration')[];

      const allowedValues: LoggerOptions = ['query', 'schema', 'error', 'warn', 'info', 'log', 'migration'];
      class Config {
        @EnvBoolean()
        @EnvEnum({ enum: allowedValues, isArray: true })
        @EnvEnum({ enum: ['all'] })
        public logging!: LoggerOptions;
      }

      const rawBool: EnvRawObject = { LOGGING: 'true' };
      const rawAll: EnvRawObject = { LOGGING: 'all' };
      const rawEnum: EnvRawObject = { LOGGING: 'error,warn,info' };

      // act
      const resBool = loadEnvConfig(Config, rawBool);
      const resAll = loadEnvConfig(Config, rawAll);
      const resEnum = loadEnvConfig(Config, rawEnum);

      // assert
      expect(resBool.logging).toBe(true);
      expect(resAll.logging).toBe('all');
      expect(resEnum.logging).toEqual(['error', 'warn', 'info']);
    });
  }); // END Multi-type/Multi-decorator properties

  describe('Freezing config', () => {
    it('Should freeze top level config', () => {
      // arrange
      class Config {
        @EnvString()
        public name!: string;
      }
      const raw: EnvRawObject = {
        NAME: 'hello',
      };
      const config = loadEnvConfig(Config, raw);

      // act
      const cb = () => { config.name = 'test'; };

      // assert
      expect(cb).toThrowError();
    });

    it('Should freeze nested configs', () => {
      // arrange
      class Nested {
        @EnvInteger()
        public age!: number;
      }
      class Config {
        @EnvString()
        public name!: string;

        @EnvNested()
        public readonly deep!: Nested;
      }
      const raw: EnvRawObject = {
        NAME: 'hello',
        DEEP_AGE: '25',
      };
      const config = loadEnvConfig(Config, raw);

      // act
      const cb = () => { config.deep.age = 35; };

      // assert
      expect(cb).toThrowError();
    });
  }); // END Freezing config

  describe('Failed scenarios/Error messages and types testing', () => {
    describe(`${ EnvPropConfigError.name }`, () => {
      it('Should throw the error when a property defined using a symbol and custom name is not defined', () => {
        // arrange
        const key = Symbol('My Key');
        class Config {
          @EnvString()
          public readonly [key]!: string;
        }

        // act
        const cb = () => {
          loadEnvConfig(Config, {});
        };

        // assert
        const exp = expect(cb);
        exp.toThrowError(EnvPropConfigError);
        exp.toThrowError('Config.Symbol(My Key)');
      });

      it('Should throw the error when duplicate names specified in the custom "name" param', () => {
        // arrange
        class Config {
          @EnvString(['AAA', 'BBB', 'AAA', 'CCC'])
          public readonly name!: string;
        }
        const raw: EnvRawObject = { AAA: '111', BBB: '222', CCC: '333' };

        // act
        const cb = () => {
          loadEnvConfig(Config, raw);
        };

        // assert
        expect(cb).toThrowError(/Config\.name.+AAA.+BBB.+CCC/);
      });
    }); // END EnvPropConfigError

    describe(`${ NoEnvVarError.name }`, () => {
      it('Should throw the error when an env variable with the only one name is missed', () => {
        // arrange
        class Config {
          @EnvString()
          public readonly myName!: string;
        }

        // act
        const cb = () => {
          loadEnvConfig(Config, {});
        };

        // assert
        const exp = expect(cb);
        exp.toThrowError(NoEnvVarError);
        exp.toThrowError('Config.myName');
        exp.toThrowError('"MY_NAME"');
      });

      it('Should throw the error when an env variable with multiple one names is missed', () => {
        // arrange
        class Config {
          @EnvString(['one', 'two'])
          public readonly myName!: string;
        }

        // act
        const cb = () => {
          loadEnvConfig(Config, {});
        };

        // assert
        const exp = expect(cb);
        exp.toThrowError(NoEnvVarError);
        exp.toThrowError('Config.myName');
        exp.toThrowError('"ONE"');
        exp.toThrowError('"TWO"');
      });
    }); // END NoEnvVarError

    describe(`${ TypeCastingError.name }`, () => {
      it('Should throw the error on casting being failed', () => {
        // arrange
        enum EKind {
          One = 'one',
          Two = 'two',
        }
        class Config {
          @EnvEnum(EKind)
          public readonly kind!: EKind[];
        }
        const raw: EnvRawObject = {
          KIND: 'three',
        };

        // act
        const cb = () => {
          loadEnvConfig(Config, raw);
        };

        // assert
        const exp = expect(cb);
        exp.toThrowError(TypeCastingError);
        exp.toThrowError('Config.kind');                     // field name
        exp.toThrowError('"KIND"');                          // ENV var name
        exp.toThrowError('Is Array: true');                  // is array flag
        exp.toThrowError(/"One": "one"(.|\n)+"Two": "two"/); // stringified enum
        exp.toThrowError(/\(string\).+"three"/);             // actual value and it's type
        exp.toThrowError(/^[^ ].+\n( {4}[^ ].+\n)*$/g);      // indentation
      });
    }); // END TypeCastingError

    describe(`${ EnvPropDecorationError.name }`, () => {
      it('Should the error on nested config type is not a class and custom type(decorator param) is missed', () => {
        // arrange
        interface NestedInter {
          name: string;
        }

        // act
        const cb = () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          class Config {
            @EnvNested()
            public readonly deep!: NestedInter;
          }
        };

        // assert
        const exp = expect(cb);
        exp.toThrowError(EnvPropDecorationError);
        exp.toThrowError('Config.deep');
        exp.toThrowError(`${ EnvNested.name }`);
      });
    }); // END EnvPropDecorationError

    describe(`${ EnvVarNameDuplicateError.name }`, () => {
      const raw: EnvRawObject = Object.freeze({
        NAME: 'hello',
        MY_NAME: 'welcome',
      });

      it('Should throw the error on duplicate fields being specified', () => {
        // arrange
        class Nested {
          @EnvString()
          public readonly name!: string;
        }
        class Config {
          @EnvString('MY_NAME')
          public readonly name!: string;

          @EnvNested()
          public readonly my!: Nested;
        }

        // act
        const cb = () => {
          loadEnvConfig(Config, raw);
        };

        // assert
        const exp = expect(cb);
        exp.toThrowError('Config.name');
        exp.toThrowError('Nested.name');
        exp.toThrowError('MY_NAME');
        exp.toThrowError('allowConflictingVarName');
      });

      it('Should not throw the error when duplicate fields being specified .allowConflictingVarName = true', () => {
        // arrange
        class Nested {
          @EnvString({ allowConflictingVarName: true })
          public readonly name!: string;
        }
        class Config {
          @EnvString({ name: 'MY_NAME', allowConflictingVarName: true })
          public readonly name!: string;

          @EnvNested()
          public readonly my!: Nested;
        }
        const expected: Config = {
          my: { name: 'welcome' },
          name: 'welcome',
        };

        // act
        const res = loadEnvConfig(Config, raw);

        // assert
        expect(res).toEqual(expected);
      });
    }); // END EnvVarNameDuplicateError

  }); // END Failed scenarios/Error messages and types testing

});

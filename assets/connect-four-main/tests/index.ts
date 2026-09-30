import * as uvu from 'uvu';
import * as assert from 'uvu/assert';

import * as CF from '../src';

const suite = uvu.suite('Core');

suite('Should expose the Connect Four class', () => {
  assert.type(CF.ConnectFour, 'function');
});

suite.run();

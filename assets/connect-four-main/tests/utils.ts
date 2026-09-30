import * as uvu from 'uvu';
import * as assert from 'uvu/assert';
import * as Utils from '../src/utils';
import { ConnectFourGameState, Coordinate } from '../src/data';

function setupCheckForGameEndTests(): void {
  const checkForGameEndSuite = uvu.suite('Utils - checkForGameEnd');

  checkForGameEndSuite('should not detect game win', () => {
    const gameState = new ConnectFourGameState();
    gameState.board = [
      0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 1, 1, 1, 2, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 1, 2,
      2, 1, 1, 1,
    ];
    Utils.checkForGameEnd(gameState, 3, 6);
    assert.equal(gameState.isGameOver, false);
    assert.equal(gameState.winningCells, []);
  });

  checkForGameEndSuite.run();
}

function getArrayIndexFrom2DCoordinateTests(): void {
  const suite = uvu.suite('Utils - getArrayIndexFrom2DCoordinate');

  suite('should return the 0 index for space 0,0', () => {
    const coordinate: Coordinate = { row: 0, col: 0 };
    const results = Utils.getArrayIndexFrom2DCoordinate(coordinate);

    assert.equal(results, 0);
  });

  suite('should return the 1 index for space 0,1', () => {
    const coordinate: Coordinate = { row: 0, col: 1 };
    const results = Utils.getArrayIndexFrom2DCoordinate(coordinate);

    assert.equal(results, 1);
  });

  suite('should return the 6 index for space 0,6', () => {
    const coordinate: Coordinate = { row: 0, col: 6 };
    const results = Utils.getArrayIndexFrom2DCoordinate(coordinate);

    assert.equal(results, 6);
  });

  suite('should return the 7 index for space 1,0', () => {
    const coordinate: Coordinate = { row: 1, col: 0 };
    const results = Utils.getArrayIndexFrom2DCoordinate(coordinate);

    assert.equal(results, 7);
  });

  suite('should return the 40 index for space 5,5', () => {
    const coordinate: Coordinate = { row: 5, col: 5 };
    const results = Utils.getArrayIndexFrom2DCoordinate(coordinate);

    assert.equal(results, 40);
  });

  suite.run();
}

function get2DPosition(): void {
  const suite = uvu.suite('Utils - get2DPosition');

  suite('should return the space 0,0 for index 0', () => {
    const results = Utils.get2DPosition(0);

    assert.equal(results, { col: 0, row: 0 });
  });

  suite('should return the space 0,1 for index 1', () => {
    const results = Utils.get2DPosition(1);

    assert.equal(results, { col: 1, row: 0 });
  });

  suite('should return the space 0,2 for index 2', () => {
    const results = Utils.get2DPosition(2);

    assert.equal(results, { col: 2, row: 0 });
  });

  suite('should return the space 0,6 for index 6', () => {
    const results = Utils.get2DPosition(6);

    assert.equal(results, { col: 6, row: 0 });
  });

  suite('should return the space 1,0 for index 7', () => {
    const results = Utils.get2DPosition(7);

    assert.equal(results, { col: 0, row: 1 });
  });

  suite('should return the space 1,1 for index 8', () => {
    const results = Utils.get2DPosition(8);

    assert.equal(results, { col: 1, row: 1 });
  });

  suite('should return the space 1,5 for index 12', () => {
    const results = Utils.get2DPosition(12);

    assert.equal(results, { col: 5, row: 1 });
  });

  suite('should return the space 1,6 for index 13', () => {
    const results = Utils.get2DPosition(13);

    assert.equal(results, { col: 6, row: 1 });
  });

  suite('should return the space 2,0 for index 14', () => {
    const results = Utils.get2DPosition(14);

    assert.equal(results, { col: 0, row: 2 });
  });

  suite('should return the space 5,5 for index 40', () => {
    const results = Utils.get2DPosition(40);

    assert.equal(results, { col: 5, row: 5 });
  });

  suite.run();
}

setupCheckForGameEndTests();
getArrayIndexFrom2DCoordinateTests();
get2DPosition();

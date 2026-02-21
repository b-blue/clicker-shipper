import { Game } from 'phaser';
import StartGame from './game/main';
import { Boot } from './game/scenes/Boot';
import { MainMenu } from './game/scenes/MainMenu';
import { Preloader } from './game/scenes/Preloader';
import { GameOver } from './game/scenes/GameOver';

const config = {
  scene: [Boot, Preloader, MainMenu, Game, GameOver]
};

document.addEventListener('DOMContentLoaded', () => {

    StartGame('game-container');

});
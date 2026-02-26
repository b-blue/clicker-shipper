import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { DialCalibration } from './scenes/DialCalibration';
import { ItemManual } from './ui/ItemManual';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { Colors } from './constants/Colors';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: Colors.BACKGROUND_DARK,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: true,
        width: '100%',
        height: '100%',
        min: {
            width: 375,
            height: 667
        },
        max: {
            width: 1920,
            height: 1080
        }
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        MainGame,
        DialCalibration,
        ItemManual
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;

import "./styles.css";
import { Game } from "./game/Game.js";

const gameRoot = document.querySelector("#game");
const hudRoot = document.querySelector("#hud");

const game = new Game(gameRoot, hudRoot);
game.start();

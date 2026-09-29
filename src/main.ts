import Phaser from "phaser";
import { createGameConfig } from "./game/gameConfig";
import { syncUiRootToCanvas } from "./game/ui/domOverlay";
import { GameContext } from "./game/GameContext";
import { LocalStoragePersistenceService } from "./persistence/localStorageAdapter";
import { createInitialPlayerSave } from "./domain/character/initialState";
import { ensureCheckpointCharacter } from "./domain/character/save";
import { TOWER } from "./data/floors";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { FloorScene } from "./game/scenes/FloorScene";
import { CombatOverlay } from "./game/scenes/CombatOverlay";
import { DeathScreenScene } from "./game/scenes/DeathScreenScene";
import { WinScreenScene } from "./game/scenes/WinScreenScene";
import { SidePanelScene } from "./game/scenes/SidePanelScene";
import { EventLogScene } from "./game/scenes/EventLogScene";
import { PauseMenuScene } from "./game/scenes/PauseMenuScene";

const persistence = new LocalStoragePersistenceService();
const firstFloor = TOWER.floors[0]!;
const existingSave = persistence.load();
const save = existingSave
  ? ensureCheckpointCharacter(existingSave)
  : createInitialPlayerSave(firstFloor.id, firstFloor.entrance);

const ctx = new GameContext(TOWER, persistence, save);

const game = new Phaser.Game(
  createGameConfig("game-root", [
    MainMenuScene,
    FloorScene,
    CombatOverlay,
    SidePanelScene,
    EventLogScene,
    PauseMenuScene,
    DeathScreenScene,
    WinScreenScene,
  ]),
);

syncUiRootToCanvas(game);

// FR-010: on app start, resume exactly where the player left off — including reopening
// the death screen if they quit while it was showing.
game.registry.set("ctx", ctx);
game.events.once("ready", () => {
  if (existingSave?.isDead) {
    // MainMenuScene auto-starts as the game's first configured scene; game.scene.start()
    // called globally (not from within a scene) doesn't stop it, so it must be stopped
    // explicitly or it keeps rendering underneath DeathScreenScene.
    game.scene.stop("MainMenuScene");
    game.scene.start("DeathScreenScene");
  }
});

// Read-only test hook (002 T038): lets e2e specs assert active scene / GameContext state
// on this canvas-only app without scraping pixels. Not used by any gameplay code path.
(window as unknown as { __game?: Phaser.Game }).__game = game;

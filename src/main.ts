import Phaser from "phaser";
import { createGameConfig } from "./game/gameConfig";
import { syncUiRootToCanvas } from "./game/ui/domOverlay";
import { GameContext } from "./game/GameContext";
import { LocalStoragePersistenceService } from "./persistence/localStorageAdapter";
import { createInitialPlayerSave } from "./domain/character/initialState";
import { ensureCheckpointCharacter } from "./domain/character/save";
import { TOWER } from "./data/floors";
import { BootScene } from "./game/scenes/BootScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { OptionsMenuScene } from "./game/scenes/OptionsMenuScene";
import { FloorScene } from "./game/scenes/FloorScene";
import { CombatOverlay } from "./game/scenes/CombatOverlay";
import { CombatIntroScene } from "./game/scenes/CombatIntroScene";
import { DeathScreenScene } from "./game/scenes/DeathScreenScene";
import { WinScreenScene } from "./game/scenes/WinScreenScene";
import { SidePanelScene } from "./game/scenes/SidePanelScene";
import { EventLogScene } from "./game/scenes/EventLogScene";
import { PauseMenuScene } from "./game/scenes/PauseMenuScene";
import { NpcDialogueScene } from "./game/scenes/NpcDialogueScene";

const persistence = new LocalStoragePersistenceService();
const firstFloor = TOWER.floors[0]!;
const existingSave = persistence.load();
const save = existingSave
  ? ensureCheckpointCharacter(existingSave)
  : createInitialPlayerSave(firstFloor.id, firstFloor.entrance);

const ctx = new GameContext(TOWER, persistence, save);

const game = new Phaser.Game(
  createGameConfig("game-root", [
    BootScene,
    MainMenuScene,
    OptionsMenuScene,
    FloorScene,
    CombatIntroScene,
    CombatOverlay,
    SidePanelScene,
    EventLogScene,
    PauseMenuScene,
    NpcDialogueScene,
    DeathScreenScene,
    WinScreenScene,
  ]),
);

syncUiRootToCanvas(game);

// FR-010: on app start, resume exactly where the player left off — including reopening
// the death screen if they quit while it was showing. BootScene (the first registered scene)
// reads ctx.save.isDead itself and routes accordingly once loading completes.
game.registry.set("ctx", ctx);

// Read-only test hook (002 T038): lets e2e specs assert active scene / GameContext state
// on this canvas-only app without scraping pixels. Not used by any gameplay code path.
(window as unknown as { __game?: Phaser.Game }).__game = game;

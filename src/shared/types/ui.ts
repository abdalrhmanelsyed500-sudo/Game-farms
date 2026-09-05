/**
 * UI mode contracts (Phase 3).
 *
 * Pure enum — no logic, no Phaser. Build mode changes what clicks DO
 * (place buildings instead of farming); the inventory panel is an overlay
 * that coexists with either mode.
 */

/** Top-level interaction mode. */
export enum UiMode {
  /** Default: farming tools act on tiles. */
  Play = 'play',
  /** Clicks place the selected building via the ghost preview. */
  Build = 'build',
}
